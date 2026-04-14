"""
Add down_tonight_expires_at column for DOWN TONIGHT feature
"""

import asyncio
import os
from dotenv import load_dotenv

# Load environment variables FIRST
load_dotenv()

from sqlalchemy import text
from database import get_db

async def add_down_tonight_column():
    """Add down_tonight_expires_at column to users table"""
    async for db in get_db():
        try:
            # Add down_tonight_expires_at column
            await db.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS down_tonight_expires_at TIMESTAMP WITH TIME ZONE;
            """))
            
            await db.commit()
            print("✅ Added down_tonight_expires_at column")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            await db.rollback()
        finally:
            await db.close()
            return

if __name__ == "__main__":
    asyncio.run(add_down_tonight_column())
