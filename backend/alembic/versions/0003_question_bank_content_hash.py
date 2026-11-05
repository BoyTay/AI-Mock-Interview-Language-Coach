"""question_bank.content_hash for idempotent seeding

The seed script keys rows by the SHA-256 of question_text so re-running it never
duplicates a question. Nullable: rows inserted by hand have no hash. Postgres allows
many NULLs in a unique index. IF NOT EXISTS keeps this safe on a database whose
init_db.sql already created the column.
"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64)")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_question_bank_content_hash ON question_bank (content_hash)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_question_bank_content_hash")
    op.execute("ALTER TABLE question_bank DROP COLUMN IF EXISTS content_hash")
