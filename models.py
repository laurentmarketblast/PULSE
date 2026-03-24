"""
Pulse App — SQLAlchemy Models
"""

import uuid
import enum
from datetime import datetime

from sqlalchemy import (
    Column, String, Text, Integer, ForeignKey,
    DateTime, Enum as SAEnum, Index, func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, relationship
from geoalchemy2 import Geography


class Base(DeclarativeBase):
    pass


class ProposalStatus(str, enum.Enum):
    pending  = "pending"
    accepted = "accepted"
    declined = "declined"
    expired  = "expired"


class User(Base):
    __tablename__ = "users"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username        = Column(String(50),  unique=True, nullable=False, index=True)
    display_name    = Column(String(100), nullable=False)
    bio             = Column(Text,        nullable=True)
    avatar_url      = Column(Text,        nullable=True)
    photo_urls      = Column(JSONB,       nullable=False, default=list)
    interest_tags   = Column(JSONB,       nullable=False, default=list)
    looking_for     = Column(String(100), nullable=True)
    sexuality       = Column(String(50),  nullable=True)
    age             = Column(Integer,     nullable=True)
    hashed_password = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(),
                        onupdate=func.now(), nullable=False)

    location = relationship(
        "UserLocation", back_populates="user",
        uselist=False, cascade="all, delete-orphan",
    )
    sent_proposals = relationship(
        "Proposal", back_populates="sender",
        foreign_keys="Proposal.sender_id",
        cascade="all, delete-orphan",
    )
    received_proposals = relationship(
        "Proposal", back_populates="receiver",
        foreign_keys="Proposal.receiver_id",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_users_interest_tags_gin", interest_tags, postgresql_using="gin"),
    )


class UserLocation(Base):
    __tablename__ = "locations"

    id      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                     unique=True, nullable=False, index=True)
    point   = Column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=True),
        nullable=False,
    )
    updated_at = Column(DateTime(timezone=True), server_default=func.now(),
                        onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="location")


class Proposal(Base):
    __tablename__ = "proposals"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                          nullable=False, index=True)
    receiver_id  = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                          nullable=False, index=True)
    activity_tag = Column(String(100), nullable=False)
    status       = Column(SAEnum(ProposalStatus), nullable=False,
                          default=ProposalStatus.pending, index=True)
    message      = Column(Text, nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    resolved_at  = Column(DateTime(timezone=True), nullable=True)

    sender   = relationship("User", back_populates="sent_proposals",
                            foreign_keys=[sender_id])
    receiver = relationship("User", back_populates="received_proposals",
                            foreign_keys=[receiver_id])
    messages = relationship("Message", back_populates="proposal",
                            cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_proposals_receiver_status", "receiver_id", "status"),
        Index("ix_proposals_sender_status",   "sender_id",   "status"),
    )

    @property
    def is_expired(self) -> bool:
        if self.status != ProposalStatus.pending:
            return False
        delta = datetime.utcnow() - self.created_at.replace(tzinfo=None)
        return delta.total_seconds() > (43200 * 60)


class Message(Base):
    __tablename__ = "messages"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proposal_id = Column(UUID(as_uuid=True), ForeignKey("proposals.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    sender_id   = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    content     = Column(Text, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    proposal = relationship("Proposal", back_populates="messages")
    sender   = relationship("User")

    __table_args__ = (
        Index("ix_messages_proposal_created", "proposal_id", "created_at"),
    )
