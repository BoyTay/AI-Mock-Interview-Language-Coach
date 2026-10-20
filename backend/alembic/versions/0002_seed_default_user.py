"""seed a default user

There is no login in v1, so the app runs as a single default user.
Inserts only when user_profiles is empty, so re-running is safe.
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO user_profiles (full_name, target_role, english_target)
        SELECT 'Default User', 'Java Backend Developer', 'IELTS 7.0'
        WHERE NOT EXISTS (SELECT 1 FROM user_profiles)
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM user_profiles WHERE full_name = 'Default User' AND cv_text IS NULL")
