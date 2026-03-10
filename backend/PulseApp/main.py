"""
Pulse App — Main FastAPI application
"""

from __future__ import annotations

import uuid
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import Depends, FastAPI, HTTPException, status
from geoalchemy2.functions import ST_DWithin, ST_Distance, ST_MakePoint, ST_SetSRID
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import create_tables, get_db
from models import Proposal, ProposalStatus, User, UserLocation
from schemas import (
    LocationUpdate, NearbyUser,
    ProposalCreate, ProposalOut, ProposalRespond,
    UserCreate, UserOut,
)

logger = logging.getLogger("pulse")

PROPOSAL_TTL_MINUTES = 60
MILES_TO_METRES      = 1609.344


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    yield


app = FastAPI(title="Pulse API", version="1.0.0", lifespan=lifespan)


# USERS
@app.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(User).where(User.username == payload.username))
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken.")
    user = User(**payload.model_dump())
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


# LOCATIONS
@app.put("/users/{user_id}/location", status_code=status.HTTP_204_NO_CONTENT)
async def update_location(
    user_id: uuid.UUID,
    payload: LocationUpdate,
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    point_expr = ST_SetSRID(ST_MakePoint(payload.longitude, payload.latitude), 4326)
    loc = await db.scalar(select(UserLocation).where(UserLocation.user_id == user_id))
    if loc:
        loc.point = point_expr
        loc.updated_at = func.now()
    else:
        loc = UserLocation(user_id=user_id, point=point_expr)
        db.add(loc)
    await db.commit()


# NEARBY
@app.get("/nearby", response_model=List[NearbyUser])
async def get_nearby(
    latitude: float,
    longitude: float,
    user_id: uuid.UUID,
    radius_miles: float = 10.0,
    db: AsyncSession = Depends(get_db),
):
    current_user = await db.get(User, user_id)
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found.")

    caller_tags = current_user.interest_tags or []
    if not caller_tags:
        return []

    radius_m     = radius_miles * MILES_TO_METRES
    caller_point = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    distance_col = ST_Distance(UserLocation.point, caller_point).label("distance_m")

    # Get all users within radius, filter tags in Python
    stmt = (
        select(User, distance_col)
        .join(UserLocation, UserLocation.user_id == User.id)
        .where(
            User.id != user_id,
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
            continue  # skip users with no shared tags
        results.append(
            NearbyUser(
                id=row_user.id,
                display_name=row_user.display_name,
                avatar_url=row_user.avatar_url,
                interest_tags=row_tags,
                shared_tags=shared,
                distance_miles=round(dist_m / MILES_TO_METRES, 2),
            )
        )
    return results


# PROPOSALS
@app.post("/propose", response_model=ProposalOut, status_code=status.HTTP_201_CREATED)
async def create_proposal(
    payload: ProposalCreate,
    sender_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    if sender_id == payload.receiver_id:
        raise HTTPException(status_code=400, detail="Cannot propose to yourself.")
    receiver = await db.get(User, payload.receiver_id)
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found.")
    duplicate = await db.scalar(
        select(Proposal).where(
            Proposal.sender_id   == sender_id,
            Proposal.receiver_id == payload.receiver_id,
            Proposal.status      == ProposalStatus.pending,
        )
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="A pending proposal already exists.")
    now = datetime.now(timezone.utc)
    proposal = Proposal(
        sender_id=sender_id,
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
async def get_inbox(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Proposal)
        .where(Proposal.receiver_id == user_id)
        .order_by(Proposal.created_at.desc())
    )
    proposals = (await db.execute(stmt)).scalars().all()
    return [_enrich_proposal(p) for p in proposals]


@app.post("/proposals/{proposal_id}/respond", response_model=ProposalOut)
async def respond_to_proposal(
    proposal_id: uuid.UUID,
    payload: ProposalRespond,
    db: AsyncSession = Depends(get_db),
):
    proposal = await db.get(Proposal, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")
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


@app.get("/proposals/sent", response_model=List[ProposalOut])
async def get_sent(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Proposal)
        .where(Proposal.sender_id == user_id)
        .order_by(Proposal.created_at.desc())
    )
    proposals = (await db.execute(stmt)).scalars().all()
    return [_enrich_proposal(p) for p in proposals]
