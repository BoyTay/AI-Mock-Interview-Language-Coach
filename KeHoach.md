# DevCoach AI - Nền tảng Luyện Phỏng vấn Kỹ thuật & Giao tiếp Tiếng Anh

> **Mô tả dự án:** Hệ thống Full-stack tích hợp AI Engineering hỗ trợ sinh viên IT và lập trình viên tự luyện phỏng vấn chuyên môn (v1.0: Backend Java/Python; Frontend và System Design dự kiến v1.1) sát với CV & JD thực tế, kết hợp chấm chữa kỹ năng Viết/Nói tiếng Anh (theo chuẩn IELTS & giao tiếp công sở) và tự động hóa ôn tập lỗi sai bằng thuật toán lặp lại ngắt quãng (Spaced Repetition SM-2).

---

## 1. Kiến trúc Hệ thống & Tech Stack

* **Frontend:** React (Vite), Tailwind CSS, Recharts (Data Visualization), Web Audio API / MediaRecorder (Thu âm giọng nói).
* **Backend:** Python (FastAPI hoặc Flask), Pydantic (Ép kiểu Structured Outputs từ LLM), PyMuPDF / pdfplumber (Bóc tách nội dung CV từ PDF).
* **Database & Vector Store:** PostgreSQL 16 tích hợp extension `pgvector` (Lưu trữ dữ liệu quan hệ kết hợp Vector Embeddings cho Hybrid Search RAG).
* **AI Engine:** Gemini API (Xử lý Multimodal Audio trực tiếp, Text Generation, JSON Schema Structured Outputs và Text Embeddings).
* **DevOps & Hạ tầng:** Docker, Docker Compose, Cronjob/Script tự động sao lưu cơ sở dữ liệu (`pg_dump`).

---

## 2. Cấu trúc Thư mục Dự án (Monorepo)

```text
devcoach-ai/
├── docker-compose.yml
├── .env.example
├── PROJECT_SPEC.md
├── scripts/
│   ├── init_db.sql              # Khởi tạo bảng và pgvector extension
│   ├── seed_questions.py        # Nạp ngân hàng câu hỏi mẫu & tạo Embeddings
│   └── backup_db.sh             # Script tự động dump dữ liệu PostgreSQL
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # Entry point khởi chạy FastAPI/Flask
│       ├── core/
│       │   ├── config.py        # Quản lý biến môi trường (DB_URL, GEMINI_API_KEY)
│       │   └── database.py      # Kết nối SQLAlchemy / Psycopg3 tới PostgreSQL
│       ├── models/              # Định nghĩa ORM Models (6 bảng cốt lõi)
│       ├── schemas/             # Pydantic Schemas (Request/Response & AI JSON Output)
│       ├── services/
│       │   ├── ai_interviewer.py # Luồng RAG phỏng vấn & sinh câu hỏi xoáy
│       │   ├── english_coach.py  # Luồng chấm Writing & phân tích Audio Speaking
│       │   ├── rag_service.py    # Tìm kiếm ngữ nghĩa với pgvector
│       │   └── sm2_scheduler.py  # Thuật toán tính ngày ôn tập Flashcard (SM-2)
│       └── api/
│           ├── routes_profile.py
│           ├── routes_interview.py
│           ├── routes_english.py
│           └── routes_flashcards.py
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── api/                 # Axios clients kết nối Backend
        ├── components/          # Các UI components từ bản thiết kế
        ├── hooks/               # Custom hooks (useAudioRecorder, useTimer)
        ├── pages/               # Dashboard, InterviewRoom, WritingCoach, Flashcards
        └── utils/
```

---

## 3. Thiết kế Cơ sở Dữ liệu (PostgreSQL + `pgvector`)

Chạy trực tiếp script SQL dưới đây để khởi tạo toàn bộ 6 bảng của hệ thống:

```sql
-- Bật extension hỗ trợ lưu trữ và truy vấn Vector
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Bảng Hồ sơ người dùng & CV
CREATE TABLE user_profiles (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100),
    target_role VARCHAR(100) NOT NULL, -- v1.0 chỉ nhận: Java Backend Intern, Python Backend Intern, Java/Python Backend Intern
    cv_text TEXT,                      -- Nội dung CV đã bóc tách từ file PDF
    english_target VARCHAR(50),        -- VD: IELTS 6.5+, Daily Standup Fluency
    streak_days INT DEFAULT 0,
    last_active_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Ngân hàng câu hỏi chuẩn (Phục vụ RAG)
CREATE TABLE question_bank (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,     -- JAVA, PYTHON, SQL, SYSTEM_DESIGN, BEHAVIORAL, IELTS_SPEAKING
    difficulty VARCHAR(20) NOT NULL,   -- JUNIOR, MID, SENIOR
    question_text TEXT NOT NULL,
    reference_answer TEXT NOT NULL,    -- Đáp án chuẩn để AI đối chiếu khi chấm
    embedding vector(768),             -- Vector nhúng (text-embedding-004)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tạo HNSW Index để tăng tốc truy vấn tương đồng Cosine trên pgvector
CREATE INDEX ON question_bank USING hnsw (embedding vector_cosine_ops);

-- 3. Bảng Phiên phỏng vấn giả lập
CREATE TABLE interview_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES user_profiles(id) ON DELETE CASCADE,
    session_type VARCHAR(50) NOT NULL, -- TECH_INTERVIEW, ENGLISH_SPEAKING, DAILY_STANDUP
    target_role VARCHAR(100),
    job_description TEXT,              -- Nội dung JD người dùng dán vào trước buổi phỏng vấn
    status VARCHAR(20) DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, COMPLETED
    overall_score NUMERIC(5, 2),       -- Thang 100 cho Tech hoặc Thang 9.0 cho IELTS
    feedback_summary JSONB,            -- Lưu điểm mạnh, lỗ hổng kiến thức tổng quan
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bảng Chi tiết từng lượt Hỏi - Đáp trong phiên phỏng vấn
CREATE TABLE session_messages (
    id SERIAL PRIMARY KEY,
    session_id INT REFERENCES interview_sessions(id) ON DELETE CASCADE,
    sender VARCHAR(10) NOT NULL,       -- AI hoặc USER
    question_type VARCHAR(30),         -- MAIN_QUESTION, FOLLOW_UP
    content_text TEXT NOT NULL,
    audio_path VARCHAR(255),           -- Đường dẫn file ghi âm câu trả lời (nếu có)
    evaluation JSONB,                  -- Điểm kỹ thuật, độ trôi chảy, câu trả lời mẫu gợi ý
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Bảng Bài nộp Luyện Viết Tiếng Anh (IELTS Writing / Tech Email)
CREATE TABLE writing_submissions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES user_profiles(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL,    -- IELTS_TASK_1, IELTS_TASK_2, TECH_DOCUMENTATION
    prompt_topic TEXT NOT NULL,
    user_essay TEXT NOT NULL,
    word_count INT,
    overall_band NUMERIC(3, 1),
    band_scores JSONB NOT NULL,        -- Điểm chi tiết 4 tiêu chí: TR, CC, LR, GRA
    sentence_corrections JSONB,        -- Danh sách câu sai, câu sửa và giải thích ngữ pháp
    upgraded_vocab JSONB,              -- Danh sách từ vựng C1/C2 gợi ý nâng cấp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Bảng Thẻ ghi nhớ Lỗi sai (Spaced Repetition SM-2)
CREATE TABLE mistake_cards (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES user_profiles(id) ON DELETE CASCADE,
    source_type VARCHAR(30) NOT NULL,  -- TECH_CONCEPT, GRAMMAR_ERROR, VOCABULARY
    front_content TEXT NOT NULL,       -- Câu hỏi phỏng vấn bị bí hoặc câu tiếng Anh viết sai
    back_content TEXT NOT NULL,        -- Đáp án chuẩn hoặc cấu trúc ngữ pháp đúng
    explanation TEXT,                  -- Giải thích chi tiết
    repetition_count INT DEFAULT 0,    -- Số lần đã ôn tập liên tiếp đúng (n)
    ease_factor NUMERIC(4, 2) DEFAULT 2.50, -- Hệ số độ dễ (EF >= 1.3)
    interval_days INT DEFAULT 1,       -- Khoảng cách ngày đến lần ôn tiếp theo (I)
    next_review_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Luồng Nghiệp vụ AI & Định dạng Structured Outputs (JSON Schema)

### 4.1. Phân hệ Phỏng vấn Kỹ thuật Thích ứng (Adaptive Tech Interview)
1. **Retrieval (Truy xuất câu hỏi):** Khi khởi tạo phiên, hệ thống ghép `target_role` + `job_description` + tóm tắt `cv_text`, tạo vector nhúng và truy vấn `question_bank` bằng toán tử khoảng cách Cosine (`<=>`) để lấy 5 câu hỏi sát thực tế nhất.
2. **Dynamic Follow-up (Hỏi xoáy):** Sau mỗi câu trả lời của người dùng, Backend gửi lịch sử câu hỏi hiện tại + câu trả lời + `reference_answer` vào LLM và yêu cầu trả về JSON theo cấu trúc sau:

```json
{
  "technical_accuracy_score": 75,
  "communication_clarity_score": 80,
  "star_method_compliance": true,
  "critique": "Trả lời đúng bản chất B-Tree Index nhưng chưa nêu được nhược điểm khi thực hiện lệnh INSERT/UPDATE liên tục.",
  "optimal_reference_answer": "B-Tree Index giúp tăng tốc truy vấn SELECT có điều kiện WHERE/JOIN từ O(N) xuống O(log N). Tuy nhiên, mỗi khi INSERT, UPDATE hoặc DELETE, hệ thống phải cân bằng lại cây chỉ mục...",
  "should_ask_followup": true,
  "next_ai_question": "Bạn vừa đề cập đến việc đánh Index trên cột thường xuyên tìm kiếm. Vậy nếu bảng có tần suất ghi (INSERT/UPDATE) cực lớn thì việc đánh quá nhiều Index sẽ gây ra hậu quả gì?",
  "extracted_mistake_card": {
    "should_create": true,
    "front": "Tại sao không nên đánh quá nhiều B-Tree Index trên bảng có tần suất INSERT/UPDATE cao?",
    "back": "Vì mỗi thao tác ghi dữ liệu đều buộc Database phải cập nhật và cân bằng lại toàn bộ các cây Index liên quan, làm giảm nghiêm trọng hiệu năng ghi (Write amplification)."
  }
}
```

### 4.2. Phân hệ Chấm bài Viết & Nói Tiếng Anh (English Coach)
Sử dụng Pydantic Schema ép Gemini API trả về định dạng JSON chuẩn để Frontend render trực tiếp thanh điểm và tô màu vị trí lỗi sai:

```json
{
  "overall_band": 6.5,
  "criteria": {
    "task_response": { "score": 7.0, "feedback": "Trả lời đầy đủ các vế của đề bài, luận điểm rõ ràng." },
    "coherence_cohesion": { "score": 6.5, "feedback": "Sử dụng từ nối hợp lý nhưng đoạn 2 chuyển ý hơi đột ngột." },
    "lexical_resource": { "score": 6.5, "feedback": "Có vốn từ chuyên ngành tốt nhưng lặp từ 'important' 4 lần." },
    "grammatical_range": { "score": 6.0, "feedback": "Còn mắc lỗi chia động từ số ít/nhiều và mệnh đề quan hệ." }
  },
  "sentence_corrections": [
    {
      "original_sentence": "Many software company nowadays uses AI for automate testing process.",
      "corrected_sentence": "Numerous software companies currently utilize AI to automate the testing process.",
      "error_category": "Subject-Verb Agreement & Infinitive of Purpose",
      "explanation": "Sau 'Many' phải là danh từ số nhiều ('companies') đi với động từ nguyên mẫu ('use/utilize'). Để chỉ mục đích, dùng 'to + V-inf' ('to automate') thay vì 'for + V'."
    }
  ],
  "upgraded_vocabulary": [
    {
      "basic_word": "use AI for automate",
      "advanced_alternative": "leverage AI to streamline and automate",
      "context_example": "Modern DevOps teams leverage AI to streamline and automate deployment pipelines."
    }
  ]
}
```

### 4.3. Thuật toán Lặp lại Ngắt quãng SM-2 (Spaced Repetition Logic)
Khi người dùng ôn tập thẻ trong bảng `mistake_cards` và bấm nút đánh giá mức độ nhớ $q \in \{0, 1, 3, 5\}$ (tương ứng trên giao diện: *Again = 0, Hard = 1, Good = 3, Easy = 5*):

* **Nếu $q < 3$ (Quên hoặc Nhớ mang máng):**
  * Đặt lại `repetition_count` ($n = 0$).
  * Đặt `interval_days` ($I = 1$).
* **Nếu $q \ge 3$ (Nhớ tốt):**
  * Nếu $n = 0 \Rightarrow I = 1$
  * Nếu $n = 1 \Rightarrow I = 6$
  * Nếu $n > 1 \Rightarrow I = \text{round}(I_{\text{cũ}} \times EF)$
  * Tăng `repetition_count` lên 1 ($n = n + 1$).
* **Cập nhật hệ số độ dễ ($EF$):**
  $$EF_{\text{mới}} = \max\left(1.3,\ EF_{\text{cũ}} + \left(0.1 - (5 - q) \times (0.08 + (5 - q) \times 0.02)\right)\right)$$
* **Tính ngày ôn tiếp theo:** `next_review_date = CURRENT_DATE + interval_days`.

---

## 5. Danh sách RESTful API Endpoints (Kết nối với Giao diện)

| Method | Endpoint | Chức năng & Kết nối màn hình |
| :--- | :--- | :--- |
| `GET` | `/api/v1/dashboard/stats` | Lấy số liệu thống kê tổng quan, dữ liệu vẽ Radar Chart, Line Chart và lịch sử phiên gần đây. |
| `POST` | `/api/v1/profile/upload-cv` | Nhận file PDF CV, bóc tách văn bản lưu vào `user_profiles.cv_text`. |
| `POST` | `/api/v1/interviews/start` | Khởi tạo phiên phỏng vấn mới, chạy RAG tìm câu hỏi phù hợp với CV/JD và trả về câu hỏi đầu tiên. |
| `POST` | `/api/v1/interviews/{id}/answer` | Gửi câu trả lời (Text hoặc file Audio `multipart/form-data`), trả về điểm đánh giá và câu hỏi tiếp theo (hoặc câu hỏi xoáy). |
| `POST` | `/api/v1/interviews/{id}/finish` | Kết thúc phiên, tổng hợp báo cáo điểm mạnh/yếu lưu vào `interview_sessions`. |
| `GET` | `/api/v1/interviews/{id}/report` | Lấy dữ liệu chi tiết cho màn hình Báo cáo Đánh giá Phiên phỏng vấn. |
| `POST` | `/api/v1/english/writing/evaluate` | Nộp bài viết tiếng Anh, trả về điểm 4 tiêu chí, danh sách sửa lỗi từng câu và gợi ý từ vựng. |
| `GET` | `/api/v1/flashcards/due` | Lấy danh sách các thẻ trong `mistake_cards` có `next_review_date <= CURRENT_DATE`. |
| `POST` | `/api/v1/flashcards` | Tạo nhanh 1 thẻ Flashcard mới từ màn hình kết quả phỏng vấn hoặc bài viết. |
| `PATCH` | `/api/v1/flashcards/{id}/review` | Nhận điểm đánh giá ($q \in \{0,1,3,5\}$), chạy thuật toán SM-2 cập nhật ngày ôn tiếp theo. |

---

## 6. Cấu hình Docker Compose (`docker-compose.yml`)

```yaml
version: '3.9'

services:
  db:
    image: pgvector/pgvector:pg16
    container_name: devcoach_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-devcoach}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-secret123}
      POSTGRES_DB: ${POSTGRES_DB:-devcoach_db}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init_db.sql:/docker-entrypoint-initdb.d/init_db.sql

  backend:
    build: ./backend
    container_name: devcoach_backend
    restart: unless-stopped
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-devcoach}:${POSTGRES_PASSWORD:-secret123}@db:5432/${POSTGRES_DB:-devcoach_db}
    ports:
      - "8000:8000"
    depends_on:
      - db
    volumes:
      - ./backend:/app
      - audio_uploads:/app/uploads

  frontend:
    build: ./frontend
    container_name: devcoach_frontend
    restart: unless-stopped
    ports:
      - "5173:5173"
    depends_on:
      - backend
    volumes:
      - ./frontend:/app
      - /app/node_modules

volumes:
  pgdata:
  audio_uploads:
```

---

## 7. Lộ trình Triển khai 6 Tuần (Sprint Plan)

* **Tuần 1 - Dựng Khung Hạ tầng & Ghép Giao diện:**
  * Khởi chạy PostgreSQL (`pgvector`) qua Docker Compose và tạo 6 bảng dữ liệu.
  * Đưa giao diện mẫu vào thư mục `frontend/`, cấu hình React Router và tách các State tĩnh thành API Call chờ sẵn.
  * Xây dựng API upload CV PDF và trang quản lý hồ sơ cá nhân.
* **Tuần 2 - Phân hệ Luyện Viết Tiếng Anh (Writing Coach):**
  * Viết service kết nối Gemini API với Pydantic Structured Outputs để chấm bài viết theo 4 tiêu chí.
  * Nối dữ liệu trả về vào giao diện Highlight lỗi sai trực tiếp và bảng nâng cấp từ vựng.
* **Tuần 3 - Phân hệ Phỏng vấn Kỹ thuật & Hybrid RAG:**
  * Viết script `seed_questions.py` nạp 50–100 câu hỏi phỏng vấn (Java, Python, SQL, OOP; React và System Design để v1.1) kèm Vector Embeddings vào bảng `question_bank`.
  * Xây dựng luồng phỏng vấn tương tác có trạng thái (Stateful) và cơ chế tự động hỏi xoáy (Follow-up).
* **Tuần 4 - Xử lý Giọng nói Đa phương thức (Audio & Speaking):**
  * Nối `MediaRecorder API` trên giao diện thu âm với endpoint `/api/v1/interviews/{id}/answer`.
  * Tích hợp truyền file âm thanh vào Gemini Multimodal để đánh giá phát âm, độ trôi chảy và nội dung trả lời; tích hợp Text-to-Speech đọc câu hỏi của AI.
* **Tuần 5 - Hệ thống Flashcards SM-2 & Analytics Dashboard:**
  * Cài đặt thuật toán SM-2 trong `sm2_scheduler.py` và nối nút *"Lưu vào Flashcard"* từ màn hình chấm bài/phỏng vấn.
  * Viết truy vấn SQL aggregation (`AVG`, `COUNT`, `GROUP BY` theo tuần) cung cấp dữ liệu thật cho biểu đồ Radar và Line Chart ở Dashboard.
* **Tuần 6 - Hoàn thiện, Tự động Sao lưu & Đóng gói:**
  * Viết script `backup_db.sh` tự động xuất dữ liệu cá nhân định kỳ.
  * Kiểm thử toàn trình, xử lý lỗi Rate Limit khi gọi API và hoàn thiện tài liệu hướng dẫn chạy dự án.

---

## 8. Quyết định chốt cho v1.0

### 8.1. Phạm vi vai trò

* v1.0 hỗ trợ đúng 3 vai trò, khớp README và màn hình thiết kế: **Java Backend Intern**, **Python Backend Intern**, **Java/Python Backend Intern**.
* Frontend và System Design lùi sang v1.1. Lý do: ngân sách 50-100 câu hỏi của Tuần 3 không đủ phủ thêm 2 mảng, và chất lượng câu hỏi theo CV/JD quan trọng hơn độ rộng.
* `target_role` vẫn là `VARCHAR(100)` để mở rộng sau này, nhưng giao diện chỉ cho chọn trong danh sách trên. Backend kiểm tra giá trị khi tạo phiên.
* Bộ câu hỏi seed (Tuần 3) gồm Java, Python, SQL, OOP; bỏ React và System Design khỏi đợt seed đầu.

### 8.2. Công thức điểm một câu

* Schema AI giữ 2 điểm thành phần (0-100): `technical_accuracy_score` và `communication_clarity_score`.
* **Điểm một câu = 0.7 x technical + 0.3 x communication**, làm tròn nửa lên về số nguyên (`floor(x + 0.5)`, không dùng `round()` của Python vì làm tròn chẵn). Ví dụ ở mục 4.1: 0.7 x 75 + 0.3 x 80 = 76.5, ra **77**.
* Trọng số 70/30 vì đây là phỏng vấn kỹ thuật: đúng nội dung quan trọng hơn cách diễn đạt. Hai hằng số nằm trong một chỗ duy nhất ở backend để đổi dễ.
* Mỗi lượt trả lời, kể cả lượt hỏi xoáy (`FOLLOW_UP`), là một dòng điểm trong báo cáo, đúng như thiết kế hiện tại.
* **`overall_score` của phiên Tech = trung bình các điểm câu**, lưu thang 100, hiển thị số nguyên.
* Giao diện báo cáo hiển thị một điểm `/ 100` mỗi câu; phần chi tiết mở rộng hiển thị thêm hai điểm thành phần.
* Màu điểm giữ như thiết kế: từ 80 trở lên xanh lá, từ 60 đến 79 hổ phách, dưới 60 đỏ.
* Lưu cả hai điểm thành phần và điểm câu trong `evaluation` (JSONB) của `session_messages`; không thêm cột mới.

### 8.3. Khoảng ôn hiển thị trên nút đánh giá

* Bỏ mốc cố định `<10m / 1d / 3d / 7d`. SM-2 không có bước học dưới 1 ngày, nên `<10m` không đúng với thuật toán.
* Mỗi nút hiển thị **khoảng ôn thật** sẽ được lưu nếu bấm nút đó, tính từ trạng thái hiện tại của thẻ (`repetition_count`, `interval_days`, `ease_factor`).
* Thứ tự tính trong `sm2_scheduler.py`: tính `EF_mới` theo $q$ trước, rồi dùng `EF_mới` để tính $I = 	ext{round}(I_{	ext{cũ}} 	imes EF_{	ext{mới}})$. Hàm xem trước và hàm cập nhật dùng chung một logic, nên số trên nút luôn bằng số được lưu.
* API thẻ trả thêm `next_intervals` (số ngày) cho 4 nút: `{again, hard, good, easy}`. Việc xem trước không ghi vào CSDL.
* Định dạng: dưới 30 ngày hiển thị `Nd`; từ 30 ngày trở lên hiển thị `Nmo` (làm tròn theo 30 ngày).
* Ví dụ thẻ có $n = 2$, $I = 6$, $EF = 2.5$: Again `1d`, Hard `1d`, Good `14d`, Easy `16d`.
* Lưu ý đã biết: theo công thức hiện tại Again ($q = 0$) và Hard ($q = 1$) đều là $q < 3$ nên cùng quay về 1 ngày, chỉ khác mức giảm EF (-0.80 và -0.54). Thẻ mới ($n = 0$) cả 4 nút đều ra `1d`; khác biệt chỉ rõ từ lần ôn thứ hai. Nếu thấy khó hiểu khi dùng thử, cân nhắc đổi ánh xạ thành Again = 0, Hard = 3, Good = 4, Easy = 5 ở v1.1.
