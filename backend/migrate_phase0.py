"""
Database Migration Script - Phase 0
Adds missing columns and new tables for PULSE app
"""

import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

async def migrate():
    engine = create_async_engine(DATABASE_URL, echo=True, poolclass=NullPool)
    
    async with engine.begin() as conn:
        print("🔄 Starting migration...")
        
        # Add columns to users table (only if they don't exist)
        print("\n📝 Adding new columns to users table...")
        await conn.execute(text("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255),
            ADD COLUMN IF NOT EXISTS date_of_birth TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS is_verified INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS is_premium INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS down_tonight_until TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS boosted_until TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS relationship_type VARCHAR(50);
        """))
        
        # Create indexes
        print("\n📊 Creating indexes...")
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_users_down_tonight ON users(down_tonight_until) WHERE down_tonight_until IS NOT NULL;
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_users_last_active ON users(last_active_at);
        """))
        
        # Create device_tokens table
        print("\n📱 Creating device_tokens table...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS device_tokens (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token TEXT NOT NULL,
                platform VARCHAR(10) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_device_tokens_user_id ON device_tokens(user_id);
        """))
        
        await conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS ix_device_tokens_user_token ON device_tokens(user_id, token);
        """))
        
        # Create user_blocks table
        print("\n🚫 Creating user_blocks table...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_blocks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_user_blocks_blocker_id ON user_blocks(blocker_id);
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_user_blocks_blocked_id ON user_blocks(blocked_id);
        """))
        
        await conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS ix_user_blocks_blocker_blocked ON user_blocks(blocker_id, blocked_id);
        """))
        
        # Create user_reports table
        print("\n📢 Creating user_reports table...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_reports (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                reported_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                reason VARCHAR(50) NOT NULL,
                details TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_user_reports_reporter_id ON user_reports(reporter_id);
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_user_reports_reported_id ON user_reports(reported_id);
        """))
        
        # Create photo_verifications table
        print("\n✅ Creating photo_verifications table...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS photo_verifications (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                photo_url TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                reviewed_at TIMESTAMP WITH TIME ZONE
            );
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_photo_verifications_user_id ON photo_verifications(user_id);
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_photo_verifications_status ON photo_verifications(status);
        """))
        
        print("\n✅ Migration completed successfully!")
    
    await engine.dispose()


if __name__ == "__main__":
    from sqlalchemy import text
    asyncio.run(migrate())
