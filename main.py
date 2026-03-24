"""
Pulse App — Main FastAPI application
JWT Authentication added
"""

from __future__ import annotations

import uuid
import os
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from geoalchemy2.functions import ST_DWithin, ST_Distance, ST_MakePoint, ST_SetSRID
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from database import create_tables, get_db
from models import Proposal, ProposalStatus, User, UserLocation, Message
from schemas import (
    LocationUpdate, NearbyUser,
    ProposalCreate, ProposalOut, ProposalRespond,
    UserCreate, UserOut,
)

logger = logging.getLogger("pulse")

# ═══════════════════════════════════════════════════
# JWT CONFIG
# ═══════════════════════════════════════════════════

SECRET_KEY   = os.getenv("JWT_SECRET", "change-this-secret-in-production")
ALGORITHM    = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
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


# ═══════════════════════════════════════════════════
# AUTH SCHEMAS
# ═══════════════════════════════════════════════════

class TokenOut(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


class LoginRequest(BaseModel):
    username: str
    password: str


# ═══════════════════════════════════════════════════
# AUTH ENDPOINTS
# ═══════════════════════════════════════════════════

@app.post("/users", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(User).where(User.username == payload.username))
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken.")

    user_data = payload.model_dump()
    raw_password = user_data.pop("password", None)
    if not raw_password:
        raise HTTPException(status_code=400, detail="Password is required.")

    user = User(**user_data)
    user.hashed_password = pwd_context.hash(raw_password)
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id))
    return TokenOut(access_token=token, token_type="bearer", user=user)


@app.post("/login", response_model=TokenOut)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.username == payload.username.lower()))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    # Temporary: support old accounts without hashed_password
    if user.hashed_password:
        if not pwd_context.verify(payload.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid username or password.")

    token = create_access_token(str(user.id))
    return TokenOut(access_token=token, token_type="bearer", user=user)


@app.get("/users/by-username/{username}", response_model=UserOut)
async def get_user_by_username(username: str, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.username == username.lower()))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


@app.patch("/users/me", response_model=UserOut)
async def update_user(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    allowed = ["interest_tags", "display_name", "bio", "avatar_url",
               "photo_urls", "looking_for", "sexuality", "age"]
    for field in allowed:
        if field in payload:
            setattr(current_user, field, payload[field])
    await db.commit()
    await db.refresh(current_user)
    return current_user


@app.get("/users/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


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
        loc.point = point_expr
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
    latitude: float,
    longitude: float,
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
    results = []
    for row_user, dist_m in rows:
        row_tags = row_user.interest_tags or []
        shared = list(set(caller_tags) & set(row_tags))
        if not shared:
            continue
        results.append(
            NearbyUser(
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
            )
        )
    return results


# ═══════════════════════════════════════════════════
# PROPOSALS
# ═══════════════════════════════════════════════════

@app.post("/propose", response_model=ProposalOut, status_code=status.HTTP_201_CREATED)
async def create_proposal(
    payload: ProposalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
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
    db: AsyncSession = Depends(get_db),
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
    db: AsyncSession = Depends(get_db),
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
    proposal_id: uuid.UUID,
    payload: ProposalRespond,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
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
    id: uuid.UUID
    proposal_id: uuid.UUID
    sender_id: uuid.UUID
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


@app.post("/proposals/{proposal_id}/messages", response_model=MessageOut, status_code=201)
async def send_message(
    proposal_id: uuid.UUID,
    payload: MessageIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
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
    proposal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
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