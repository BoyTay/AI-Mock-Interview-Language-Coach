"""audio_retention

Recordings older than AUDIO_RETENTION_DAYS are deleted by a cleanup job. For an interview
answer it stamps `audio_deleted_at` (so playback can say the recording expired); for a speaking
submission it clears `audio_path`, which therefore becomes nullable.
IF NOT EXISTS keeps this safe on a database whose init_db.sql already has the column.
"""
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE session_messages ADD COLUMN IF NOT EXISTS audio_deleted_at TIMESTAMP")
    op.execute("ALTER TABLE speaking_submissions ALTER COLUMN audio_path DROP NOT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE session_messages DROP COLUMN IF EXISTS audio_deleted_at")
    # Fails if the cleanup job has already cleared audio_path on any speaking row; accepted,
    # since those recordings are gone and cannot be restored.
    op.execute("ALTER TABLE speaking_submissions ALTER COLUMN audio_path SET NOT NULL")
