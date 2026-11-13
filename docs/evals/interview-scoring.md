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

## Kết quả prompt v1 (gemini-2.5-flash, hai lượt)

| Mẫu | Loại | Khoảng | Điểm kỹ thuật L1 | L2 | Điểm rõ ràng L1 | L2 |
|-----|------|-------:|-----------------:|---:|----------------:|---:|
| i01-good-hashmap | Tốt | 75-100 | 95 | 95 | 100 | 100 |
| i02-good-where-having | Tốt | 75-100 | 100 | 100 | 100 | 100 |
| i03-medium-useeffect | Trung bình | 40-70 | 65 | 65 | 90 | 90 |
| i04-medium-gil | Trung bình | 40-70 | 45 | **65** | 80 | 90 |
| i05-poor-concurrenthashmap | Kém | 0-35 | 15 | 15 | 60 | 70 |
| i06-poor-acid | Kém | 0-35 | 10 | 10 | 50 | 40 |
| i07-off-topic-props-state | Lạc đề | 0-10 | 0 | 0 | 0 | 0 |
| i08-false-claim-volatile | Nói sai | 0-55 | 15 | 15 | 80 | 85 |
| i09-false-claim-string-stack | Nói sai | 0-55 | 5 | 5 | 70 | 70 |
| i10-good-star-disagreement | Tốt (STAR) | 70-100 | 95 | 100 | 95 | 100 |

Tóm tắt (file `backend/evals/results/interview-v1-run1.txt` và `interview-v1-run2.txt`). Cột `lang` chưa có ở lượt 1 nên các số về ngôn ngữ chỉ có từ lượt 2:

| | Lượt 1 | Lượt 2 |
|---|---:|---:|
| Điểm trong khoảng kỳ vọng | 10/10 | 10/10 |
| Cờ lạc đề đúng | 10/10 | 10/10 |
| Lời phê nêu chỗ thiếu hoặc chỗ sai | 6/6 | 6/6 |
| Câu xoáy bám nội dung | 7/7 | 7/7 |
| Lời phê bằng tiếng Việt | 10/10 | 10/10 |
| Đáp án mẫu bằng ngôn ngữ của câu hỏi | 9/10 (i03 bị dịch, đọc bằng mắt) | 10/10 |
| Câu xoáy bằng ngôn ngữ của câu hỏi | chưa đo | 8/8 |
| Cờ STAR đúng | 1/1 | 1/1 |
| Thuật ngữ then chốt còn trong đáp án mẫu | 25/26 | 26/26 |
| Lặp lại điều sai (càng thấp càng tốt) | 0/2 | 0/2 |
| Điểm kỹ thuật trung bình: tốt / trung bình / kém / nói sai / lạc đề | 96.7 / 55.0 / 12.5 / 10.0 / 0.0 | 98.3 / 65.0 / 12.5 / 10.0 / 0.0 |
| Bài phải thử lại, bài thất bại | 0, 0 | 0, 0 |

Bài lạc đề ở cả hai lượt bị điểm 0 và được hỏi lại đúng câu gốc ("Let's get back to the question: ..." ở lượt 1, "Please answer the question: ..." ở lượt 2).

### Độ ổn định giữa hai lượt

- Điểm kỹ thuật giống hệt ở 8/10 bài. Hai bài còn lại: i04 (GIL) **45 rồi 65**, chênh 20 điểm; i10 95 rồi 100. Chênh lệch tuyệt đối trung bình 2.5 điểm.
- Điểm rõ ràng lệch nhiều hơn: 5 bài lệch 5 đến 10 điểm, trung bình 4.0.
- Thứ tự giữa các loại giữ nguyên ở cả hai lượt. Với 10 bài và 2 lượt, chưa nên coi điểm của một lần chấm là chính xác hơn khoảng ±20, vì chỉ một bài lệch tới mức đó và chưa biết nó hiếm hay phổ biến.

### Sự cố một lần chạy bị mất

Trước lượt 2 này đã có một lần chạy khác bị giới hạn hạn mức 20 request/ngày: bài i08 và i10 bị `RATE_LIMITED`, rồi lần chạy lại **ghi đè file kết quả của lần đó (khi ấy 8/10 bài thành công)**. File hỏng đã xoá và không dùng làm số đo. Ghi chép từ màn hình lúc ấy: i04 cũng 65, và ở i06 lời phê không nhắc thuật ngữ nào kỳ vọng với điểm rõ ràng 30; điều thứ hai không lặp lại ở lượt 2 có file.

## Kết luận từ việc đọc đầu ra của AI

### AI "bịa" kiến thức?

- **Không thấy AI lặp lại điều sai của ứng viên**, ở cả hai lượt. Ở hai mẫu nói sai, lời phê bác bỏ đúng chỗ sai: i08 giải thích `volatile` chỉ đảm bảo hiển thị và thứ tự, không làm `counter++` nguyên tử; i09 chỉ ra String nằm trên heap chứ không phải stack và việc coi StringBuilder là bất biến là sai. Hai bài được điểm 5 và 15 ở cả hai lượt.
- **Đáp án mẫu của AI thực chất là bản chép đáp án gốc.** Đo bằng so sánh chuỗi, 19/20 đáp án (10 mỗi lượt) giống hệt đáp án gốc trong ngân hàng câu hỏi. Ngoại lệ duy nhất là i03 ở lượt 1: AI **dịch đáp án sang tiếng Việt** dù câu hỏi tiếng Anh, trái với yêu cầu trong prompt. Ở lượt 2 cùng bài đó trả lại đúng đáp án gốc. Đáp án mẫu của AI đi thẳng vào báo cáo, nên lỗi này nghĩa là người dùng có thể thấy đáp án tiếng Việt cho một câu hỏi tiếng Anh, và nó xảy ra thất thường chứ không phải ở mọi lần.
- **Lời phê có thể thêm kiến thức ngoài đáp án gốc.** Ví dụ i09 nói String nằm trên heap, điều không có trong đáp án gốc (và đúng). Bộ kiểm tra tự động chưa bắt được loại này; chỉ phát hiện được khi đọc.

### Câu hỏi xoáy

Câu xoáy bám nội dung ứng viên và không lặp câu hỏi, nhưng **một số câu xoáy gợi lộ đáp án** (đọc bằng mắt, chưa có phép đo tự động), và mức độ thay đổi giữa hai lượt:

- i08 lượt 1: "Could you elaborate on why `volatile` is not sufficient for ensuring atomicity in compound operations like `counter++`?" Câu này nói luôn cho ứng viên biết mình sai và sai ở đâu. Lượt 2 hỏi khác hẳn và ít gợi hơn: "...why you believe `counter++` becomes atomic with `volatile`, and what exactly `volatile` guarantees regarding memory visibility and ordering?"
- i06 cả hai lượt hỏi thẳng phần ứng viên bỏ sót ("what the other letters stand for").
- i04 và i05 cả hai lượt gợi hướng đúng (luồng vẫn có ích với I/O; ConcurrentHashMap trong môi trường đa luồng).

Một câu xoáy tốt trong phỏng vấn thật thường để ứng viên tự lộ chỗ hổng (ví dụ "Chuyện gì xảy ra nếu hai thread cùng chạy `counter++`?"), thay vì chỉ ra chỗ sai.

## Đã thay đổi trong mã sau kết quả này

- **Báo cáo và report writer dùng đáp án gốc của ngân hàng câu hỏi** thay cho bản AI chép lại (`interview_report.py`, `report_writer.py`). Lý do: AI chỉ chép lại đáp án gốc, và một lần dịch sai sang tiếng Việt. Đây là cách làm "dùng `reference_answer` làm chuẩn" bằng mã thay vì bằng lời nhắc, nên không phụ thuộc vào việc AI có tuân thủ. Có test cho cả hai chỗ. Lượt 2 không gặp lại lỗi, nhưng lỗi xảy ra thất thường nên thay đổi này vẫn có lý do.
- **Prompt không đổi** (vẫn phiên bản 1). Bằng chứng chưa đủ để sửa prompt: lỗi ngôn ngữ gặp 1 lần trong 20 câu đã chấm có file, và không thấy AI lặp lại điều sai. Một lời nhắc mới cần được đo trước theo cách đã làm với Writing v2.

## Việc nên làm tiếp

- Thử sửa prompt cho câu xoáy: yêu cầu hỏi để ứng viên tự lộ chỗ hổng thay vì nêu đáp án đúng. Cần thêm phép đo tự động cho việc "câu xoáy gợi lộ đáp án" trước, rồi đo hai lượt trên cùng model so với v1 (20 request, tức đủ một ngày hạn mức), và chỉ áp dụng nếu tốt hơn rõ ràng.
- Nhờ người có chuyên môn chấm lại 10 câu để có khoảng điểm kỳ vọng độc lập.
- Thêm mẫu: câu hành vi thiếu STAR, và chuỗi nhiều câu xoáy liên tiếp (có `followups_used` > 0).
