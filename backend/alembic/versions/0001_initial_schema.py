"""initial schema: 6 core tables, pgvector, HNSW index

Mirrors scripts/init_db.sql. Every statement is IF NOT EXISTS so this migration
is a no-op on a database that was already initialised by that script.
"""
import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

TS = sa.text("CURRENT_TIMESTAMP")


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "user_profiles",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("full_name", sa.String(100)),
        sa.Column("target_role", sa.String(100), nullable=False),
        sa.Column("cv_text", sa.Text),
        sa.Column("english_target", sa.String(50)),
        sa.Column("streak_days", sa.Integer, server_default="0"),
        sa.Column("last_active_date", sa.Date),
        sa.Column("created_at", sa.DateTime, server_default=TS),
        if_not_exists=True,
    )

    op.create_table(
        "question_bank",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("difficulty", sa.String(20), nullable=False),
        sa.Column("question_text", sa.Text, nullable=False),
        sa.Column("reference_answer", sa.Text, nullable=False),
        sa.Column("embedding", Vector(768)),
        sa.Column("created_at", sa.DateTime, server_default=TS),
        if_not_exists=True,
    )
    op.create_index(
        "ix_question_bank_embedding_hnsw",
        "question_bank",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
        if_not_exists=True,
    )

    op.create_table(
        "interview_sessions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("user_profiles.id", ondelete="CASCADE")),
        sa.Column("session_type", sa.String(50), nullable=False),
        sa.Column("target_role", sa.String(100)),
        sa.Column("job_description", sa.Text),
        sa.Column("status", sa.String(20), server_default="IN_PROGRESS"),
        sa.Column("overall_score", sa.Numeric(5, 2)),
        sa.Column("feedback_summary", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime, server_default=TS),
        if_not_exists=True,
    )
    op.create_index("ix_interview_sessions_user_id", "interview_sessions", ["user_id"], if_not_exists=True)

    op.create_table(
        "session_messages",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("session_id", sa.Integer, sa.ForeignKey("interview_sessions.id", ondelete="CASCADE")),
        sa.Column("sender", sa.String(10), nullable=False),
        sa.Column("question_type", sa.String(30)),
        sa.Column("content_text", sa.Text, nullable=False),
        sa.Column("audio_path", sa.String(255)),
        sa.Column("evaluation", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime, server_default=TS),
        if_not_exists=True,
    )
    op.create_index("ix_session_messages_session_id", "session_messages", ["session_id"], if_not_exists=True)

    op.create_table(
        "writing_submissions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("user_profiles.id", ondelete="CASCADE")),
        sa.Column("task_type", sa.String(50), nullable=False),
        sa.Column("prompt_topic", sa.Text, nullable=False),
        sa.Column("user_essay", sa.Text, nullable=False),
        sa.Column("word_count", sa.Integer),
        sa.Column("overall_band", sa.Numeric(3, 1)),
        sa.Column("band_scores", postgresql.JSONB, nullable=False),
        sa.Column("sentence_corrections", postgresql.JSONB),
        sa.Column("upgraded_vocab", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime, server_default=TS),
        if_not_exists=True,
    )
    op.create_index("ix_writing_submissions_user_id", "writing_submissions", ["user_id"], if_not_exists=True)

    op.create_table(
        "mistake_cards",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("user_profiles.id", ondelete="CASCADE")),
        sa.Column("source_type", sa.String(30), nullable=False),
        sa.Column("front_content", sa.Text, nullable=False),
        sa.Column("back_content", sa.Text, nullable=False),
        sa.Column("explanation", sa.Text),
        sa.Column("repetition_count", sa.Integer, server_default="0"),
        sa.Column("ease_factor", sa.Numeric(4, 2), server_default="2.50"),
        sa.Column("interval_days", sa.Integer, server_default="1"),
        sa.Column("next_review_date", sa.Date, server_default=sa.text("CURRENT_DATE")),
        sa.Column("created_at", sa.DateTime, server_default=TS),
        if_not_exists=True,
    )
    op.create_index(
        "ix_mistake_cards_user_due", "mistake_cards", ["user_id", "next_review_date"], if_not_exists=True
    )


def downgrade() -> None:
    # The vector extension is left installed: other objects may depend on it.
    for table in (
        "mistake_cards",
        "writing_submissions",
        "session_messages",
        "interview_sessions",
        "question_bank",
        "user_profiles",
    ):
        op.drop_table(table, if_exists=True)
