import os
from dotenv import load_dotenv
load_dotenv()
import databases
import asyncio

async def create_table():
    DATABASE_URL = os.getenv('DATABASE_URL')
    database = databases.Database(DATABASE_URL)
    await database.connect()
    query = '''
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255),
        verified BOOLEAN DEFAULT FALSE,
        otp VARCHAR(6),
        otp_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
    );
    '''
    await database.execute(query)
    # Add columns if not exist (for existing tables)
    alter_queries = [
        "ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS otp VARCHAR(6);",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires TIMESTAMP;"
    ]
    for q in alter_queries:
        try:
            await database.execute(q)
        except:
            pass  # Ignore if column exists
    print('Table created')
    await database.disconnect()

asyncio.run(create_table())