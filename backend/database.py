"""
Pulse App — Database setup with async SQLAlchemy
"""

import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Get DATABASE_URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set")

# Create async engine with proper connection pooling
engine = create_async_engine(
    DATABASE_URL,
    echo=False,          # Set True to log SQL during development
    pool_size=5,         # Max 5 persistent connections
    max_overflow=10,     # Allow 10 additional connections when needed
    pool_pre_ping=True,  # Verify connections before using them
    pool_recycle=3600,   # Recycle connections after 1 hour
)

# Session factory
async_session = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base class for models
Base = declarative_base()


async def get_db():
    """
    Dependency to get database session.
    Usage: db: AsyncSession = Depends(get_db)
    """
    async with async_session() as session:
        yield session


async def create_tables():
    """
    Create all tables defined in models.
    Called during app startup.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
