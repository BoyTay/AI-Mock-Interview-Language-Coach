# AI Mock Interview & Language Coach (DevCoach AI)

Nền tảng web luyện phỏng vấn kỹ thuật và tiếng Anh bằng AI, dành cho sinh viên và lập trình viên Software Engineering.

> Trạng thái hiện tại: đã có thiết kế giao diện, hạ tầng Docker, CSDL, khung FastAPI và frontend React với 4 màn hình (Dashboard, Mock Interview, English Writing Coach, Mistake Flashcards) chạy bằng dữ liệu mẫu trong `frontend/src/mocks/`. Chưa nối API thật.

## Mục tiêu

- Mô phỏng buổi phỏng vấn kỹ thuật (Java/Python Backend Intern) bằng giọng nói hoặc văn bản, có câu hỏi đào sâu (follow-up).
- Chấm điểm và nhận xét chi tiết từng câu trả lời, so sánh với đáp án mẫu, đánh giá theo cấu trúc STAR.
- Luyện viết tiếng Anh (IELTS Writing Task 2, Tech Daily Standup) với chấm band điểm, sửa lỗi trực tiếp và gợi ý từ vựng C1/C2.
- Ôn lại lỗi sai bằng flashcard theo thuật toán lặp lại ngắt quãng SM-2.

## Các màn hình đã thiết kế

| Màn hình | File | Nội dung chính |
|---|---|---|
| Dashboard | `design/Main.dc.html` | Thẻ số liệu, biểu đồ Radar 5 kỹ năng, biểu đồ đường tiến bộ theo tuần, bảng phiên luyện tập gần đây |
| Mock Interview | `design/Interview.dc.html` | Phòng phỏng vấn chia đôi (AI Interviewer, transcript, nhập liệu Voice / Text & Code) và báo cáo đánh giá (điểm tổng, STAR, accordion từng câu) |
| English Writing Coach | `design/Writing.dc.html` | Trình soạn thảo có đồng hồ và bộ đếm từ, chấm band IELTS, sửa lỗi inline, Vocabulary Upgrader |
| Mistake Flashcards | `design/Flashcards.dc.html` | Thẻ lật 3D và 4 mức đánh giá SM-2: Again, Hard, Good, Easy |
| Session Setup | `design/SessionSetup.dc.html` | Chọn loại phiên (Tech Interview / Tech Daily Standup), vai trò, dán JD, số câu hỏi, độ khó; bảng tóm tắt đầu vào; trạng thái chưa có CV, đang khởi tạo, khởi tạo lỗi |
| CV & JD Profile | `design/Profile.dc.html` | Upload CV PDF, xem trước văn bản đã bóc tách, sửa tên, vai trò mục tiêu, mục tiêu tiếng Anh; trạng thái chưa có CV, đang tải, lỗi upload (PDF scan, quá dài, quá 5 MB, sai định dạng) |

Tất cả 6 màn dùng chung App Shell (sidebar có thêm mục Session Setup): sidebar thu gọn được, bộ chuyển chế độ Tech Interview / English Coach và widget streak ngày luyện tập.

## Design System

- Phong cách: Modern SaaS / Developer Tool, Dark Mode mặc định (lấy cảm hứng từ Linear, Vercel).
- Màu (chuẩn Tailwind): nền `slate-950`, card `slate-900` viền `slate-800`, nhấn chính `indigo-600`; ngữ nghĩa `emerald-500` (đạt), `amber-500` (cần cải thiện), `rose-500` (lỗi).
- Font: Inter cho giao diện, JetBrains Mono cho số liệu và đoạn code.

## Quyết định cho v1.0

Chi tiết và lý do nằm ở mục 8 của `KeHoach.md`.

- **Vai trò hỗ trợ:** Java Backend Intern, Python Backend Intern, Java/Python Backend Intern. Frontend và System Design lùi sang v1.1.
- **Điểm một câu (Tech Interview):** `0.7 x technical_accuracy_score + 0.3 x communication_clarity_score`, làm tròn nửa lên, thang 100. Điểm phiên là trung bình các câu.
- **Nút đánh giá Flashcards:** hiển thị khoảng ôn thật do SM-2 tính cho từng thẻ (ví dụ `1d`, `1d`, `14d`, `16d`), không dùng mốc cố định. Again và Hard cùng quay về 1 ngày theo công thức hiện tại, chỉ khác mức giảm EF.

## Công nghệ dự kiến

React (Vite), Tailwind CSS, shadcn/ui (Radix UI), Lucide React, Recharts.

## Về các file thiết kế

Các file `.dc.html` được tạo bằng công cụ Design của Claude và chỉ hiển thị đúng khi mở trong canvas Design. Chúng dùng làm tài liệu tham khảo (màu sắc, bố cục, nội dung mẫu) khi cài đặt giao diện bằng React. Toàn bộ dữ liệu trong thiết kế là dữ liệu mẫu.

## Lộ trình

1. ~~Hoàn thiện thiết kế các màn hình còn lại (Profile & CV/JD, màn hình cấu hình phiên phỏng vấn).~~ Đã xong (issue #7).
2. Dựng giao diện React theo design system.
3. Xây dựng backend và tích hợp AI chấm điểm.

## Chạy dự án (phát triển)

```bash
cp .env.example .env        # điền POSTGRES_PASSWORD, và DB_HOST_PORT nếu cổng 5432 đang bận
docker compose up -d --build
```

- Frontend: http://localhost:5173, Backend: http://localhost:8000 (`/docs`, `/health`)
- Chạy test frontend: `docker compose exec frontend npm test`
- Sau khi đổi cấu hình Vite/Tailwind/PostCSS hoặc cài thêm thư viện, khởi động lại dev server: `docker compose restart frontend`
- Áp migration CSDL: `docker compose exec backend alembic upgrade head`
- Chạy test backend: `docker compose exec backend sh -c "pip install -q -r requirements-dev.txt && python -m pytest"` (test dùng SQLite trong bộ nhớ, không cần Postgres)
- Service chấm Writing (`app/services/english_coach.py`): gọi Gemini với response schema, nhiệt độ 0.1; kiểm tra `overall_band` là bội số 0.5 trong 0-9 và `original_sentence` phải trích đúng nguyên văn bài viết; JSON sai thì thử lại tối đa 2 lần rồi trả 502 `AI_INVALID_RESPONSE`; rate limit trả 429 `RATE_LIMITED` kèm `Retry-After`. Cần `GEMINI_API_KEY` trong `.env` (model đổi qua `GEMINI_MODEL`). Chưa có endpoint HTTP gọi service này.
- API hồ sơ (người dùng mặc định, chưa có đăng nhập): `GET/PUT /api/v1/profile` (tên, vai trò mục tiêu, mục tiêu tiếng Anh) và `POST /api/v1/profile/upload-cv` (multipart, trường `file`, chỉ PDF, tối đa 5 MB; lưu văn bản vào `cv_text`, không lưu file PDF; PDF ảnh quét trả 422 `CV_NO_TEXT_LAYER`; CV quá 20 trang hoặc 50.000 ký tự trả 422 `CV_TOO_LONG`)
