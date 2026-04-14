"""
Add shimmer_color column for holographic effect
"""

import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy import text
from database import get_db

# Load environment variables
load_dotenv()

async def add_shimmer_color_column():
    """Add shimmer_color column to users table"""
    async for db in get_db():
        try:
            # Add shimmer_color column (stores hex color like #FF3C50)
            await db.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS shimmer_color VARCHAR(7) DEFAULT '#FF3C50';
            """))
            
            await db.commit()
            print("✅ Added shimmer_color column")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            await db.rollback()
        finally:
            await db.close()
            return

if __name__ == "__main__":
    asyncio.run(add_shimmer_color_column())
