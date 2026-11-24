"""speaking_submissions

One graded spoken standup per row: the transcript, the band scores and the placed marks.
IF NOT EXISTS keeps this safe on a database whose init_db.sql already created the table.
"""
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS speaking_submissions (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
            prompt_text TEXT NOT NULL,
            transcript TEXT NOT NULL,
            audio_path VARCHAR(255) NOT NULL,
            duration_seconds INT NOT NULL,
            words_per_minute INT NOT NULL,
            overall_band NUMERIC(3, 1) NOT NULL,
            band_scores JSONB NOT NULL,
            summary TEXT NOT NULL,
            marks JSONB NOT NULL,
            grammar_corrections JSONB NOT NULL,
            vocabulary_upgrades JSONB NOT NULL,
            prompt_version VARCHAR(10) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_speaking_submissions_user_id ON speaking_submissions (user_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS speaking_submissions")
