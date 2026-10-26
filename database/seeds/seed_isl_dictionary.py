import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend')))

from core.database import AsyncSessionLocal
from models.dataset import SignVocabulary
from sqlalchemy import select

INITIAL_VOCABULARY = [
    {"sign_label": "NAMASTE", "category": "Greetings", "description": "Traditional Indian greeting sign with palms joined"},
    {"sign_label": "THANK_YOU", "category": "Polite", "description": "Hand moved forward from chin to express thanks"},
    {"sign_label": "WELCOME", "category": "Greetings", "description": "Open arm welcoming movement"},
    {"sign_label": "HELP", "category": "Emergency", "description": "Closed fist supported by open palm"},
    {"sign_label": "PLEASE", "category": "Polite", "description": "Circular movement over chest"},
    {"sign_label": "INDIAN_SIGN_LANGUAGE", "category": "General", "description": "Composite gesture for ISL"},
    {"sign_label": "GOOD_MORNING", "category": "Greetings", "description": "Sun rising sign combined with morning gesture"},
    {"sign_label": "FAMILY", "category": "Relationships", "description": "Curved hands joining in circle"},
    {"sign_label": "FRIEND", "category": "Relationships", "description": "Hooked index fingers interlocking"},
    {"sign_label": "PEACE", "category": "General", "description": "V-sign gesture with both hands"},
]

async def seed_database():
    print("[Seed Script] Connecting to PostgreSQL database...")
    async with AsyncSessionLocal() as session:
        for item in INITIAL_VOCABULARY:
            query = select(SignVocabulary).where(SignVocabulary.sign_label == item["sign_label"])
            result = await session.execute(query)
            existing = result.scalar_one_or_none()

            if not existing:
                vocab = SignVocabulary(
                    sign_label=item["sign_label"],
                    category=item["category"],
                    description=item["description"]
                )
                session.add(vocab)
                print(f"  + Added sign: {item['sign_label']}")

        await session.commit()
        print("[Seed Script] Database successfully seeded with ISL vocabulary dictionary!")

if __name__ == "__main__":
    asyncio.run(seed_database())
