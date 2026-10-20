-- Runs once on first start of the db container (empty data volume).
-- Idempotent on purpose: the Alembic baseline migration (backend/alembic) creates
-- the same schema with IF NOT EXISTS, so either path can run first.
-- Keep this file and backend/app/models in sync (verify with `alembic check`).

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. User profile and CV
CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100),
    target_role VARCHAR(100) NOT NULL,
    cv_text TEXT,
    english_target VARCHAR(50),
    streak_days INT DEFAULT 0,
    last_active_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Question bank (RAG)
CREATE TABLE IF NOT EXISTS question_bank (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    question_text TEXT NOT NULL,
    reference_answer TEXT NOT NULL,
    embedding vector(768),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_question_bank_embedding_hnsw
    ON question_bank USING hnsw (embedding vector_cosine_ops);

-- 3. Interview sessions
CREATE TABLE IF NOT EXISTS interview_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES user_profiles(id) ON DELETE CASCADE,
    session_type VARCHAR(50) NOT NULL,
    target_role VARCHAR(100),
    job_description TEXT,
    status VARCHAR(20) DEFAULT 'IN_PROGRESS',
    overall_score NUMERIC(5, 2),
    feedback_summary JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_interview_sessions_user_id ON interview_sessions (user_id);

-- 4. Turns inside a session
CREATE TABLE IF NOT EXISTS session_messages (
    id SERIAL PRIMARY KEY,
    session_id INT REFERENCES interview_sessions(id) ON DELETE CASCADE,
    sender VARCHAR(10) NOT NULL,
    question_type VARCHAR(30),
    content_text TEXT NOT NULL,
    audio_path VARCHAR(255),
    evaluation JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_session_messages_session_id ON session_messages (session_id);

-- 5. English writing submissions
CREATE TABLE IF NOT EXISTS writing_submissions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES user_profiles(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL,
    prompt_topic TEXT NOT NULL,
    user_essay TEXT NOT NULL,
    word_count INT,
    overall_band NUMERIC(3, 1),
    band_scores JSONB NOT NULL,
    sentence_corrections JSONB,
    upgraded_vocab JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_writing_submissions_user_id ON writing_submissions (user_id);

-- 6. Mistake flashcards (SM-2)
CREATE TABLE IF NOT EXISTS mistake_cards (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES user_profiles(id) ON DELETE CASCADE,
    source_type VARCHAR(30) NOT NULL,
    front_content TEXT NOT NULL,
    back_content TEXT NOT NULL,
    explanation TEXT,
    repetition_count INT DEFAULT 0,
    ease_factor NUMERIC(4, 2) DEFAULT 2.50,
    interval_days INT DEFAULT 1,
    next_review_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Serves GET /flashcards/due (user_id + next_review_date <= today)
CREATE INDEX IF NOT EXISTS ix_mistake_cards_user_due ON mistake_cards (user_id, next_review_date);
