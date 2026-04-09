"""
Pulse App — Pydantic schemas (request / response)
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════
# Users
# ═══════════════════════════════════════════════

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
    created_at:    datetime
    down_tonight:  bool = False  # NEW: DOWN TONIGHT status for current user

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    display_name:  Optional[str] = None
    bio:           Optional[str] = None
    avatar_url:    Optional[str] = None
    photo_urls:    Optional[List[str]] = None
    interest_tags: Optional[List[str]] = None
    looking_for:   Optional[str] = None
    sexuality:     Optional[str] = None
    age:           Optional[int] = Field(None, ge=18, le=100)


# ═══════════════════════════════════════════════
# Locations
# ═══════════════════════════════════════════════

class LocationUpdate(BaseModel):
    latitude:  float = Field(..., ge=-90,  le=90)
    longitude: float = Field(..., ge=-180, le=180)


# ═══════════════════════════════════════════════
# Nearby
# ═══════════════════════════════════════════════

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
    down_tonight:   bool = False  # NEW: DOWN TONIGHT badge

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════
# Proposals
# ═══════════════════════════════════════════════

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


# ═══════════════════════════════════════════════
# Messages
# ═══════════════════════════════════════════════

class MessageIn(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)


class MessageOut(BaseModel):
    id:          uuid.UUID
    proposal_id: uuid.UUID
    sender_id:   uuid.UUID
    content:     str
    created_at:  datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════
# Auth
# ═══════════════════════════════════════════════

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type:   str = "bearer"
