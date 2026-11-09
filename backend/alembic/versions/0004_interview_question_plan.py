"""interview_sessions.question_plan

The ordered main questions picked by RAG when a session starts, kept as JSON snapshots.
IF NOT EXISTS keeps this safe on a database whose init_db.sql already created the column.
"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS question_plan JSONB")


def downgrade() -> None:
    op.execute("ALTER TABLE interview_sessions DROP COLUMN IF EXISTS question_plan")
