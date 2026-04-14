"""
Pulse App — Main FastAPI application
"""

from __future__ import annotations

import uuid
import os
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional

from fastapi import Depends, FastAPI, HTTPException, status, Request, File, UploadFile
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from passlib.context import CryptContext
from geoalchemy2.functions import ST_DWithin, ST_Distance, ST_MakePoint, ST_SetSRID
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from database import create_tables, get_db
from models import Proposal, ProposalStatus, User, UserLocation, Message, DeviceToken, UserBlock, UserReport
from schemas import (
    LocationUpdate, NearbyUser,
    ProposalCreate, ProposalOut, ProposalRespond,
    UserCreate, UserOut,
)
from storage import get_supabase_client
from PIL import Image
import io

logger = logging.getLogger("pulse")

# ═══════════════════════════════════════════════════
# COLOR EXTRACTION
# ═══════════════════════════════════════════════════

def extract_dominant_color(img: Image.Image) -> str:
    """
    Extract dominant color from image and return as hex string.
    Uses quantization to find the most common color.
    """
    # Resize to small size for faster processing
    img_small = img.copy()
    img_small.thumbnail((150, 150))
    
    # Convert to RGB if needed
    if img_small.mode != 'RGB':
        img_small = img_small.convert('RGB')
    
    # Reduce colors to find dominant one
    img_quantized = img_small.quantize(colors=5)
    palette = img_quantized.getpalette()
    color_counts = img_quantized.getcolors()
    
    # Get most common color
    dominant_color_index = max(color_counts, key=lambda x: x[0])[1]
    
    # Get RGB values from palette
    r = palette[dominant_color_index * 3]
    g = palette[dominant_color_index * 3 + 1]
    b = palette[dominant_color_index * 3 + 2]
    
    # Convert to hex
    return f"#{r:02x}{g:02x}{b:02x}"

# ═══════════════════════════════════════════════════
# JWT CONFIG
# ═══════════════════════════════════════════════════

SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET environment variable must be set")

ALGORITHM   = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

PROPOSAL_TTL_MINUTES = 43200  # 30 days
MILES_TO_METRES      = 1609.344


# ═══════════════════════════════════════════════════
# JWT HELPERS
# ═══════════════════════════════════════════════════

def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await db.get(User, uuid.UUID(user_id))
    if user is None:
        raise credentials_exception
    return user


# ═══════════════════════════════════════════════════
# APP
# ═══════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    yield


app = FastAPI(title="Pulse API", version="2.0.0", lifespan=lifespan)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",  # Expo dev
        "http://localhost:19006",  # Expo web
        "https://pulseappv2-production.up.railway.app",  # Production backend
        # Add your production frontend URL here when ready
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════
# AUTH SCHEMAS
# ═══════════════════════════════════════════════════

class TokenOut(BaseModel):
    access_token: str
    token_type:   str
    user:         UserOut


class LoginRequest(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    bio:           Optional[str]       = None
    display_name:  Optional[str]       = None
    avatar_url:    Optional[str]       = None
    photo_urls:    Optional[List[str]] = None
    interest_tags: Optional[List[str]] = None
    looking_for:   Optional[str]       = None
    sexuality:     Optional[str]       = None
    age:           Optional[int]       = None


# ═══════════════════════════════════════════════════
# AUTH ENDPOINTS
# ═══════════════════════════════════════════════════

@app.post("/users", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_user(request: Request, payload: UserCreate, db: AsyncSession = Depends(get_db)):
    # Normalize username
    normalized_username = payload.username.lower().strip()
    
    existing = await db.scalar(select(User).where(User.username == normalized_username))
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken.")

    user_data = payload.model_dump()
    raw_password = user_data.pop("password", None)
    if not raw_password:
        raise HTTPException(status_code=400, detail="Password is required.")

    # Set normalized username
    user_data["username"] = normalized_username
    
    user = User(**user_data)
    user.hashed_password = pwd_context.hash(raw_password)
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id))
    return TokenOut(access_token=token, token_type="bearer", user=user)


@app.post("/login", response_model=TokenOut)
@limiter.limit("5/minute")
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.username == payload.username.lower()))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    if user.hashed_password:
        if not pwd_context.verify(payload.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid username or password.")

    token = create_access_token(str(user.id))
    return TokenOut(access_token=token, token_type="bearer", user=user)


@app.get("/users/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.patch("/users/me", response_model=UserOut)
async def update_user(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@app.post("/users/me/photos")
async def upload_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a profile photo (max 6 photos per user)"""
    
    # Validate file type
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, and WebP allowed.")
    
    # Validate file size (10MB max)
    file_content = await file.read()
    if len(file_content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")
    
    # Check photo limit
    if len(current_user.photo_urls) >= 6:
        raise HTTPException(status_code=400, detail="Maximum 6 photos allowed.")
    
    try:
        # Resize and compress image
        img = Image.open(io.BytesIO(file_content))
        
        # Convert RGBA to RGB if needed
        if img.mode == 'RGBA':
            img = img.convert('RGB')
        
        # Resize maintaining aspect ratio
        img.thumbnail((1080, 1080), Image.Resampling.LANCZOS)
        
        # Save to bytes
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG', quality=85, optimize=True)
        img_bytes.seek(0)
        
        # Upload to Supabase Storage
        supabase = get_supabase_client()
        file_path = f"{current_user.id}/{uuid.uuid4()}.jpg"
        
        bucket = supabase.storage.from_("avatar")
        bucket.upload(file_path, img_bytes.getvalue(), {
            "content-type": "image/jpeg",
            "upsert": "false"
        })
        
        # Get public URL
        public_url = bucket.get_public_url(file_path)
        
        # Extract dominant color for holographic shimmer (only for first photo)
        if len(current_user.photo_urls) == 0:
            try:
                dominant_color = extract_dominant_color(img)
                current_user.shimmer_color = dominant_color
                logger.info(f"Extracted shimmer color: {dominant_color} for user {current_user.id}")
            except Exception as e:
                logger.warning(f"Color extraction failed: {e}, using default")
                current_user.shimmer_color = "#FF3C50"
        
        # Add to user's photo_urls
        current_user.photo_urls = current_user.photo_urls + [public_url]
        await db.commit()
        await db.refresh(current_user)
        
        return {"url": public_url, "total_photos": len(current_user.photo_urls), "shimmer_color": current_user.shimmer_color}
    
    except Exception as e:
        logger.error(f"Photo upload failed: {e}")
        raise HTTPException(status_code=500, detail="Photo upload failed")


@app.delete("/users/me/photos")
async def delete_photo(
    photo_url: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a profile photo"""
    if photo_url not in current_user.photo_urls:
        raise HTTPException(status_code=404, detail="Photo not found.")
    
    # Remove from array
    current_user.photo_urls = [url for url in current_user.photo_urls if url != photo_url]
    await db.commit()
    
    # TODO: Delete from Supabase Storage (optional - storage costs are minimal)
    
    return {"message": "Photo deleted", "total_photos": len(current_user.photo_urls)}


@app.get("/users/by-username/{username}", response_model=UserOut)
async def get_user_by_username(username: str, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.username == username.lower()))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


@app.get("/users/{user_id}", response_model=UserOut)
async def get_user_by_id(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


@app.delete("/users/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete user account (App Store requirement)"""
    current_user.deleted_at = datetime.now(timezone.utc)
    await db.commit()


class BlockUserRequest(BaseModel):
    blocked_id: uuid.UUID


@app.post("/users/block", status_code=status.HTTP_201_CREATED)
async def block_user(
    payload: BlockUserRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Block another user"""
    if current_user.id == payload.blocked_id:
        raise HTTPException(status_code=400, detail="Cannot block yourself.")
    
    # Check if already blocked
    existing = await db.scalar(
        select(UserBlock).where(
            UserBlock.blocker_id == current_user.id,
            UserBlock.blocked_id == payload.blocked_id
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="User already blocked.")
    
    block = UserBlock(blocker_id=current_user.id, blocked_id=payload.blocked_id)
    db.add(block)
    await db.commit()
    return {"message": "User blocked successfully"}


class ReportUserRequest(BaseModel):
    reported_id: uuid.UUID
    reason: str = Field(..., min_length=1, max_length=50)
    details: Optional[str] = None


@app.post("/users/report", status_code=status.HTTP_201_CREATED)
async def report_user(
    payload: ReportUserRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Report another user for misconduct"""
    if current_user.id == payload.reported_id:
        raise HTTPException(status_code=400, detail="Cannot report yourself.")
    
    report = UserReport(
        reporter_id=current_user.id,
        reported_id=payload.reported_id,
        reason=payload.reason,
        details=payload.details
    )
    db.add(report)
    await db.commit()
    return {"message": "Report submitted successfully"}


# ═══════════════════════════════════════════════════
# LOCATIONS
# ═══════════════════════════════════════════════════

@app.put("/users/me/location", status_code=status.HTTP_204_NO_CONTENT)
async def update_location(
    payload: LocationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    point_expr = ST_SetSRID(ST_MakePoint(payload.longitude, payload.latitude), 4326)
    loc = await db.scalar(select(UserLocation).where(UserLocation.user_id == current_user.id))
    if loc:
        loc.point      = point_expr
        loc.updated_at = func.now()
    else:
        loc = UserLocation(user_id=current_user.id, point=point_expr)
        db.add(loc)
    await db.commit()


# ═══════════════════════════════════════════════════
# NEARBY
# ═══════════════════════════════════════════════════

@app.get("/nearby", response_model=List[NearbyUser])
async def get_nearby(
    latitude:     float,
    longitude:    float,
    radius_miles: float = 10.0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    caller_tags = current_user.interest_tags or []
    if not caller_tags:
        return []

    radius_m     = radius_miles * MILES_TO_METRES
    caller_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    distance_col = ST_Distance(UserLocation.point, caller_point).label("distance_m")

    stmt = (
        select(User, distance_col)
        .join(UserLocation, UserLocation.user_id == User.id)
        .where(
            User.id != current_user.id,
            ST_DWithin(UserLocation.point, caller_point, radius_m),
        )
        .order_by(distance_col)
    )

    rows = (await db.execute(stmt)).all()
    
    # Separate DOWN TONIGHT users from regular users
    down_tonight_users = []
    regular_users = []
    
    for row_user, dist_m in rows:
        row_tags = row_user.interest_tags or []
        shared   = list(set(caller_tags) & set(row_tags))
        if not shared:
            continue
        
        is_down_tonight = row_user.down_tonight_until is not None and row_user.down_tonight_until > datetime.now(timezone.utc)
        
        nearby_user = NearbyUser(
            id=row_user.id,
            display_name=row_user.display_name,
            avatar_url=row_user.avatar_url,
            photo_urls=row_user.photo_urls or [],
            interest_tags=row_tags,
            shared_tags=shared,
            distance_miles=round(dist_m / MILES_TO_METRES, 2),
            looking_for=row_user.looking_for,
            sexuality=row_user.sexuality,
            age=row_user.age,
            bio=row_user.bio,
            shimmer_color=row_user.shimmer_color or "#FF3C50",
            down_tonight=is_down_tonight,
        )
        
        if is_down_tonight:
            down_tonight_users.append(nearby_user)
        else:
            regular_users.append(nearby_user)
    
    # Return DOWN TONIGHT users first, then regular users
    return down_tonight_users + regular_users


# ═══════════════════════════════════════════════════
# PROPOSALS
# ═══════════════════════════════════════════════════

@app.post("/propose", response_model=ProposalOut, status_code=status.HTTP_201_CREATED)
async def create_proposal(
    payload:      ProposalCreate,
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    if current_user.id == payload.receiver_id:
        raise HTTPException(status_code=400, detail="Cannot propose to yourself.")
    receiver = await db.get(User, payload.receiver_id)
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found.")
    duplicate = await db.scalar(
        select(Proposal).where(
            Proposal.sender_id   == current_user.id,
            Proposal.receiver_id == payload.receiver_id,
            Proposal.status      == ProposalStatus.pending,
        )
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="A pending proposal already exists.")
    now = datetime.now(timezone.utc)
    proposal = Proposal(
        sender_id=current_user.id,
        receiver_id=payload.receiver_id,
        activity_tag=payload.activity_tag,
        message=payload.message,
        status=ProposalStatus.pending,
        created_at=now,
    )
    db.add(proposal)
    await db.commit()
    await db.refresh(proposal)
    return _enrich_proposal(proposal)


@app.get("/proposals/inbox", response_model=List[ProposalOut])
async def get_inbox(
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    stmt = (
        select(Proposal)
        .where(Proposal.receiver_id == current_user.id)
        .order_by(Proposal.created_at.desc())
    )
    proposals = (await db.execute(stmt)).scalars().all()
    return [_enrich_proposal(p) for p in proposals]


@app.get("/proposals/sent", response_model=List[ProposalOut])
async def get_sent(
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    stmt = (
        select(Proposal)
        .where(Proposal.sender_id == current_user.id)
        .order_by(Proposal.created_at.desc())
    )
    proposals = (await db.execute(stmt)).scalars().all()
    return [_enrich_proposal(p) for p in proposals]


@app.post("/proposals/{proposal_id}/respond", response_model=ProposalOut)
async def respond_to_proposal(
    proposal_id:  uuid.UUID,
    payload:      ProposalRespond,
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    proposal = await db.get(Proposal, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")
    if proposal.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your proposal to respond to.")
    if proposal.is_expired:
        proposal.status      = ProposalStatus.expired
        proposal.resolved_at = datetime.now(timezone.utc)
        await db.commit()
        raise HTTPException(status_code=410, detail="Proposal has expired.")
    if proposal.status != ProposalStatus.pending:
        raise HTTPException(status_code=409, detail=f"Proposal is already {proposal.status.value}.")
    proposal.status      = ProposalStatus.accepted if payload.accept else ProposalStatus.declined
    proposal.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(proposal)
    return _enrich_proposal(proposal)


@app.post("/proposals/expire")
async def expire_old_proposals(db: AsyncSession = Depends(get_db)):
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=PROPOSAL_TTL_MINUTES)
    result = await db.execute(
        update(Proposal)
        .where(Proposal.status == ProposalStatus.pending, Proposal.created_at < cutoff)
        .values(status=ProposalStatus.expired, resolved_at=func.now())
        .execution_options(synchronize_session="fetch")
    )
    await db.commit()
    return {"expired": result.rowcount}


def _enrich_proposal(p: Proposal) -> ProposalOut:
    return ProposalOut(
        id=p.id,
        sender_id=p.sender_id,
        receiver_id=p.receiver_id,
        activity_tag=p.activity_tag,
        status=p.status.value,
        message=p.message,
        created_at=p.created_at,
        resolved_at=p.resolved_at,
        expires_at=p.created_at + timedelta(minutes=PROPOSAL_TTL_MINUTES),
    )


# ═══════════════════════════════════════════════════
# MESSAGES
# ═══════════════════════════════════════════════════

class MessageIn(BaseModel):
    content: str


class MessageOut(BaseModel):
    id:          uuid.UUID
    proposal_id: uuid.UUID
    sender_id:   uuid.UUID
    content:     str
    created_at:  datetime

    class Config:
        from_attributes = True


@app.post("/proposals/{proposal_id}/messages", response_model=MessageOut, status_code=201)
async def send_message(
    proposal_id:  uuid.UUID,
    payload:      MessageIn,
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    proposal = await db.get(Proposal, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")
    if proposal.status != ProposalStatus.accepted:
        raise HTTPException(status_code=403, detail="Can only message on accepted proposals.")
    if current_user.id not in (proposal.sender_id, proposal.receiver_id):
        raise HTTPException(status_code=403, detail="Not part of this proposal.")
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    msg = Message(
        proposal_id=proposal_id,
        sender_id=current_user.id,
        content=payload.content.strip(),
        created_at=datetime.now(timezone.utc),
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


@app.get("/proposals/{proposal_id}/messages", response_model=List[MessageOut])
async def get_messages(
    proposal_id:  uuid.UUID,
    current_user: User = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    proposal = await db.get(Proposal, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")
    if current_user.id not in (proposal.sender_id, proposal.receiver_id):
        raise HTTPException(status_code=403, detail="Not part of this proposal.")

    stmt = (
        select(Message)
        .where(Message.proposal_id == proposal_id)
        .order_by(Message.created_at.asc())
    )
    messages = (await db.execute(stmt)).scalars().all()
    return messages
