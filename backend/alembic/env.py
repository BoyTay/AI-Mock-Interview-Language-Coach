import os

from alembic import context
from pgvector.sqlalchemy import Vector
from sqlalchemy import create_engine, pool

from app.models import Base

config = context.config
target_metadata = Base.metadata


def database_url() -> str:
    url = os.environ["DATABASE_URL"]
    # Compose passes a plain postgresql:// URL; select the psycopg 3 driver explicitly.
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def run_migrations_offline() -> None:
    context.configure(url=database_url(), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(database_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        # Let autogenerate/check recognise the pgvector column type.
        connection.dialect.ischema_names["vector"] = Vector
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
