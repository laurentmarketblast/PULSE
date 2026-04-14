"""
Pulse App — Pydantic schemas (request / response)
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────
# Users
# ─────────────────────────────────────────────

class UserCreate(BaseModel):
    username:      str           = Field(..., min_length=3, max_length=50)
    password:      str           = Field(..., min_length=8, max_length=100)
    display_name:  str           = Field(..., min_length=1, max_length=100)
    date_of_birth: Optional[datetime] = None
    bio:           Optional[str] = None
    avatar_url:    Optional[str] = None
    photo_urls:    List[str]     = Field(default_factory=list)
    interest_tags: List[str]     = Field(default_factory=list)
    looking_for:   Optional[str] = None   # casual hookup, FWB, threesome, etc.
    sexuality:     Optional[str] = None   # straight, gay, bi, pan, etc.
    age:           Optional[int] = Field(None, ge=18, le=100)


class UserOut(BaseModel):
    id:            uuid.UUID
    username:      str
    display_name:  str
    bio:           Optional[str]
    avatar_url:    Optional[str]
    photo_urls:    List[str]
    interest_tags: List[str]
    looking_for:   Optional[str]
    sexuality:     Optional[str]
    age:           Optional[int]
    shimmer_color: Optional[str] = "#FF3C50"  # Holographic shimmer color
    created_at:    datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Locations
# ─────────────────────────────────────────────

class LocationUpdate(BaseModel):
    latitude:  float = Field(..., ge=-90,  le=90)
    longitude: float = Field(..., ge=-180, le=180)


# ─────────────────────────────────────────────
# Nearby
# ─────────────────────────────────────────────

class NearbyRequest(BaseModel):
    latitude:     float = Field(..., ge=-90,  le=90)
    longitude:    float = Field(..., ge=-180, le=180)
    radius_miles: float = Field(default=10.0, gt=0, le=50)


class NearbyUser(BaseModel):
    id:             uuid.UUID
    display_name:   str
    avatar_url:     Optional[str]
    photo_urls:     List[str]
    interest_tags:  List[str]
    shared_tags:    List[str]
    distance_miles: float
    looking_for:    Optional[str]
    sexuality:      Optional[str]
    age:            Optional[int]
    bio:            Optional[str]
    shimmer_color:  Optional[str] = "#FF3C50"  # Holographic shimmer color
    down_tonight:   bool = False  # DOWN TONIGHT status

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Proposals
# ─────────────────────────────────────────────

class ProposalCreate(BaseModel):
    receiver_id:  uuid.UUID
    activity_tag: str           = Field(..., min_length=1, max_length=100)
    message:      Optional[str] = Field(None, max_length=280)


class ProposalOut(BaseModel):
    id:           uuid.UUID
    sender_id:    uuid.UUID
    receiver_id:  uuid.UUID
    activity_tag: str
    status:       str
    message:      Optional[str]
    created_at:   datetime
    resolved_at:  Optional[datetime]
    expires_at:   datetime

    model_config = {"from_attributes": True}


class ProposalRespond(BaseModel):
    accept: bool
