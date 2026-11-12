# Kiểm tra chất lượng chấm điểm và câu hỏi xoáy của Interview

Bộ kiểm tra này cho AI chấm 10 câu trả lời mẫu (tốt, trung bình, kém, lạc đề, và hai câu nói sai một cách tự tin) rồi kiểm tra điểm, lời phê, câu hỏi xoáy và việc AI có "bịa" kiến thức không.

## Cách chạy

```
docker compose exec backend python -m evals.run_interview_eval
docker compose exec backend python -m evals.run_interview_eval --only i08-false-claim-volatile --out evals/results/interview-run.txt
```

Cần `GEMINI_API_KEY`. Mỗi câu là một request (nhiều hơn nếu AI trả JSON sai và phải thử lại). Script đi qua đúng `Interviewer` của API, và câu xoáy được xét sau `decide_next` như trong phòng phỏng vấn thật, nên giới hạn câu xoáy và quy tắc không lặp câu hỏi đều có hiệu lực. Cuối báo cáo in nguyên văn lời phê, câu xoáy tiếp theo và đáp án mẫu của AI cho từng câu để người đọc tự kiểm tra.

Bài mẫu nằm ở `backend/evals/interview_samples.py`, kết quả các lượt chạy ở `backend/evals/results/interview-*.txt`.

**Giới hạn hạn mức:** gói miễn phí của Gemini cho `gemini-2.5-flash` chỉ 20 request mỗi ngày. Một lượt đủ 10 câu tốn 10 request, nên mỗi ngày chỉ chạy trọn vẹn được tối đa hai lượt. Gặp giới hạn theo ngày thì chờ tới ngày sau; script chỉ chờ `Retry-After` một lần rồi ghi câu đó là thất bại.

## Bộ mẫu

Mỗi câu trả lời ứng với một câu hỏi thật trong ngân hàng câu hỏi, kèm đáp án gốc của câu đó.

| Mẫu | Loại | Câu hỏi | Khoảng điểm kỳ vọng |
|-----|------|---------|--------------------:|
| i01-good-hashmap | Tốt | HashMap hoạt động bên trong thế nào | 75-100 |
| i02-good-where-having | Tốt | WHERE khác HAVING | 75-100 |
| i03-medium-useeffect | Trung bình | useEffect và mảng phụ thuộc (thiếu cleanup, stale closure) | 40-70 |
| i04-medium-gil | Trung bình | GIL (nói sai rằng thread vô dụng, bỏ sót I/O và asyncio) | 40-70 |
| i05-poor-concurrenthashmap | Kém | HashMap và ConcurrentHashMap (trả lời mơ hồ) | 0-35 |
| i06-poor-acid | Kém | ACID (đoán sai C, I, D) | 0-35 |
| i07-off-topic-props-state | Lạc đề | props và state (nói chuyện bữa trưa, thời tiết, lương) | 0-10 |
| i08-false-claim-volatile | Nói sai | `volatile` làm `counter++` nguyên tử | 0-55 |
| i09-false-claim-string-stack | Nói sai | String bất biến vì lưu trên stack, StringBuilder cũng bất biến | 0-55 |
| i10-good-star-disagreement | Tốt (STAR) | Bất đồng với đồng đội | 70-100 |

## Các phép kiểm tra

| Cột | Ý nghĩa |
|-----|---------|
| score | điểm kỹ thuật nằm trong khoảng kỳ vọng |
| topic | cờ `is_on_topic` đúng như kỳ vọng |
| gap | lời phê nhắc ít nhất một thuật ngữ của chỗ thiếu hoặc chỗ sai (so khớp từ khoá) |
| follow | AI có hỏi xoáy và câu hỏi nhắc lại từ khoá ứng viên đã nói (với bài lạc đề: từ khoá của câu hỏi) |
| viet | lời phê viết bằng tiếng Việt |
| lang | đáp án mẫu và câu xoáy viết bằng ngôn ngữ của câu hỏi (ngân hàng toàn tiếng Anh); cột này thêm sau lượt 1 |
| star | `star_method_compliance` đúng (chỉ câu hành vi) |
| facts | số thuật ngữ then chốt của đáp án gốc còn giữ trong đáp án mẫu của AI |
| claim | `NO` nếu đáp án mẫu của AI lặp lại điều sai của ứng viên (chỉ hai mẫu nói sai) |

## Hạn chế cần biết

- **Khoảng điểm kỳ vọng do người viết bộ bài tự ước lượng** theo đáp án gốc, không phải điểm của người chấm thật, nên khoảng được để rộng. Điểm ra ngoài khoảng là chỗ để đọc lại, chưa phải bằng chứng AI sai.
- **Các phép kiểm tra là so khớp từ khoá.** Chúng chỉ chứng minh lời phê nhắc đúng khái niệm cần nhắc, không chứng minh lời phê đúng. Vì vậy báo cáo in nguyên văn đầu ra của AI và kết luận dưới đây có phần đọc bằng mắt.
- **Chỉ 10 câu, mỗi câu một lần trả lời đầu tiên.** Chưa kiểm tra luồng nhiều câu xoáy liên tiếp, câu hành vi thiếu STAR, hay câu hỏi ngoài ngân hàng.
- **Chưa phát hiện được lỗi "bịa" kiểu thêm chi tiết đúng-sai ngoài đáp án gốc vào lời phê.** Phép đo `claim` chỉ bắt việc lặp lại đúng điều sai đã cài sẵn trong đáp án mẫu của AI.

## Phiên bản prompt

| Phiên bản | Trạng thái | Ghi chú |
|-----------|------------|---------|
| 1 | Đang dùng | Prompt ban đầu của `app/services/ai_interviewer.py` |

`PROMPT_VERSION` trong `ai_interviewer.py` phải tăng khi sửa `_SYSTEM`; một test kiểm tra băm của prompt nên quên tăng sẽ làm test đỏ. Kết quả của phiên bản mới phải ghi vào bảng này.

## Kết quả prompt v1 (gemini-2.5-flash, lượt 1)

| Mẫu | Loại | Điểm kỹ thuật | Khoảng | Điểm rõ ràng | Đạt điểm | Lời phê nêu chỗ thiếu | Câu xoáy bám nội dung | Lặp lại điều sai |
|-----|------|--------------:|-------:|-------------:|:--------:|:---------------------:|:---------------------:|:----------------:|
| i01-good-hashmap | Tốt | 95 | 75-100 | 100 | ok | - | - | - |
| i02-good-where-having | Tốt | 100 | 75-100 | 100 | ok | - | - | - |
| i03-medium-useeffect | Trung bình | 65 | 40-70 | 90 | ok | ok | ok | - |
| i04-medium-gil | Trung bình | 45 | 40-70 | 80 | ok | ok | ok | - |
| i05-poor-concurrenthashmap | Kém | 15 | 0-35 | 60 | ok | ok | ok | - |
| i06-poor-acid | Kém | 10 | 0-35 | 50 | ok | ok | ok | - |
| i07-off-topic-props-state | Lạc đề | 0 | 0-10 | 0 | ok | - | ok | - |
| i08-false-claim-volatile | Nói sai | 15 | 0-55 | 80 | ok | ok | ok | không |
| i09-false-claim-string-stack | Nói sai | 5 | 0-55 | 70 | ok | ok | ok | không |
| i10-good-star-disagreement | Tốt (STAR) | 95 | 70-100 | 95 | ok | - | - | - |

Tóm tắt lượt 1 (file `backend/evals/results/interview-v1-run1.txt`):

- Điểm trong khoảng kỳ vọng: 10/10. Điểm trung bình theo loại: tốt 96.7, trung bình 55.0, kém 12.5, nói sai 10.0, lạc đề 0.0. Thứ tự đúng như mong đợi.
- Cờ lạc đề đúng 10/10; bài lạc đề bị điểm 0 và phiên được hỏi lại đúng câu gốc ("Let's get back to the question: ...").
- Lời phê nêu đúng chỗ thiếu hoặc chỗ sai: 6/6 bài có chỗ thiếu. Cờ STAR đúng 1/1. Lời phê tiếng Việt 10/10.
- Câu xoáy bám nội dung: 7/7 bài cần hỏi xoáy. Sáu bài có câu xoáy trích lại chính lời ứng viên ("You mentioned that threads are basically useless..."); bài lạc đề được hỏi lại câu gốc.
- Đáp án mẫu giữ thuật ngữ then chốt: 25/26.
- Lặp lại điều sai trong đáp án mẫu: 0/2.
- Không bài nào phải thử lại; không bài nào thất bại.

### Lượt 2 không dùng được

Hai lần chạy lượt 2 đều bị giới hạn: lần đầu bài i08 và i10 bị `RATE_LIMITED`, lần chạy lại sau đó gần như toàn bộ bị `RATE_LIMITED` vì đã hết hạn mức 20 request/ngày. **Lần chạy lại đã ghi đè file kết quả của lần đầu (khi đó 8/10 bài thành công), nên không còn file lượt 2.** File hỏng đã xoá. Điều còn lại là ghi chép từ màn hình lúc chạy, không có file đi kèm:

- Điểm kỹ thuật lượt 2: i01 95, i02 100, i03 65, i04 **65**, i05 15, i06 10, i07 0, i09 5. Bài i04 (GIL) là 45 ở lượt 1 và 65 ở lượt 2: chênh 20 điểm cho cùng một câu trả lời.
- Ở bài i06 (ACID) lượt 2, lời phê không nhắc thuật ngữ nào trong số kỳ vọng và điểm rõ ràng chỉ 30 (lượt 1 là 50).
- Ở bài i03 lượt 2, đáp án mẫu của AI viết bằng tiếng Anh và giữ đủ 2/2 thuật ngữ (lượt 1 chỉ 1/2, xem dưới).

Vì vậy chưa có số đo độ ổn định giữa các lượt đáng tin cậy. Chỉ biết rằng đã thấy cùng một câu trả lời lệch 20 điểm giữa hai lượt, nên chưa nên coi điểm của một lần chấm là chính xác hơn mức đó.

## Kết luận từ việc đọc đầu ra của AI

### AI "bịa" kiến thức?

- **Không thấy AI lặp lại điều sai của ứng viên.** Ở cả hai mẫu nói sai, lời phê bác bỏ đúng chỗ sai: i08 giải thích `volatile` chỉ đảm bảo hiển thị và thứ tự, không làm `counter++` nguyên tử; i09 chỉ ra String nằm trên heap chứ không phải stack và việc coi StringBuilder là bất biến là sai. Cả hai bài được điểm 5 và 15.
- **Đáp án mẫu của AI thực chất là bản chép đáp án gốc.** Đo bằng độ giống chuỗi, 9/10 bài giống hệt đáp án gốc trong ngân hàng câu hỏi. Ngoại lệ là i03: AI **dịch đáp án sang tiếng Việt** dù câu hỏi tiếng Anh, trái với yêu cầu trong prompt. Đáp án mẫu của AI đi thẳng vào báo cáo, nên người dùng sẽ thấy đáp án tiếng Việt cho một câu hỏi tiếng Anh. Phép đo `facts` (1/2 ở i03) bắt được lỗi này gián tiếp; sau đó thêm cột `lang` để đếm trực tiếp.
- **Lời phê có thể thêm kiến thức ngoài đáp án gốc.** Ví dụ i09 nói String nằm trên heap, điều không có trong đáp án gốc (và đúng). Bộ kiểm tra tự động chưa bắt được loại này; chỉ phát hiện được khi đọc.

### Câu hỏi xoáy

Câu xoáy bám nội dung ứng viên và không lặp câu hỏi, nhưng **nhiều câu xoáy gợi lộ đáp án** (đọc bằng mắt, chưa có phép đo tự động):

- i08: "Could you elaborate on why `volatile` is not sufficient for ensuring atomicity in compound operations like `counter++`?" Câu này nói luôn cho ứng viên biết mình sai và sai ở đâu.
- i06: "Can you explain what Atomicity means, and what 'C', 'I', and 'D' actually stand for in ACID?" Hỏi thẳng phần ứng viên bỏ sót.
- i04 và i05 cũng gợi ý hướng đúng (I/O-bound, môi trường đa luồng).

Một câu xoáy tốt trong phỏng vấn thật thường để ứng viên tự lộ chỗ hổng (ví dụ "Chuyện gì xảy ra nếu hai thread cùng chạy `counter++`?"), thay vì chỉ ra chỗ sai.

## Đã thay đổi trong mã sau kết quả này

- **Báo cáo và report writer dùng đáp án gốc của ngân hàng câu hỏi** thay cho bản AI chép lại (`interview_report.py`, `report_writer.py`). Lý do: đo được AI chỉ chép lại đáp án gốc, và một lần dịch sai sang tiếng Việt. Đây là cách làm "dùng `reference_answer` làm chuẩn" bằng mã thay vì bằng lời nhắc, nên không cần tốn lượt chạy AI để kiểm chứng. Có test cho cả hai chỗ.
- **Prompt không đổi** (vẫn phiên bản 1). Bằng chứng chưa đủ để sửa prompt: lỗi ngôn ngữ gặp 1 lần trong 18 câu đã chấm ở hai lượt (10 ở lượt 1, 8 ở lượt 2), và không thấy AI lặp lại điều sai. Một lời nhắc mới cần được đo trước theo cách đã làm với Writing v2, mà hạn mức hôm đó đã hết.

## Việc nên làm tiếp

- Chạy lại lượt 2 khi hạn mức mới về, rồi mới có số đo độ ổn định (nhất là i04 và i06).
- Thử sửa prompt cho câu xoáy: yêu cầu hỏi để ứng viên tự lộ chỗ hổng thay vì nêu đáp án đúng. Đo hai lượt trên cùng model, so với v1, và chỉ áp dụng nếu tốt hơn rõ ràng. Cần thêm phép đo tự động cho việc "câu xoáy gợi lộ đáp án" trước khi so sánh.
- Nhờ người có chuyên môn chấm lại 10 câu để có khoảng điểm kỳ vọng độc lập.
- Thêm mẫu: câu hành vi thiếu STAR, và chuỗi nhiều câu xoáy liên tiếp (có `followups_used` > 0).
