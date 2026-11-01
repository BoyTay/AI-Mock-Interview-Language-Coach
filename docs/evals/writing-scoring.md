# Kiểm tra chất lượng chấm điểm Writing

Bộ kiểm tra này so band do AI chấm với band tham chiếu trên 10 bài IELTS Task 2 mẫu (band 5.0 đến 8.0).

## Cách chạy

```
docker compose exec backend python -m evals.run_writing_eval
docker compose exec backend python -m evals.run_writing_eval --only w04-band-6.0 --out evals/results/run.txt
```

Cần `GEMINI_API_KEY`. Mỗi bài là một request (nhiều hơn nếu AI trả JSON sai và phải thử lại). Script đi qua đúng `EnglishCoach` của API nên kiểm tra "câu gốc phải trích nguyên văn" và cơ chế thử lại hoạt động như thật. Gặp rate limit thì chờ `Retry-After` một lần; gặp lỗi 5xx của Gemini thì thử lại tối đa 2 lần, rồi ghi bài đó là thất bại thay vì dừng cả lượt chạy.

Bài mẫu nằm ở `backend/evals/samples.py`, kết quả các lượt chạy ở `backend/evals/results/`.

## Hạn chế cần biết

- **Band tham chiếu do người viết bộ bài tự ước lượng**, dựa trên band descriptor công khai của IELTS Writing Task 2. Đây không phải điểm của giám khảo thật, và chính nó có thể lệch khoảng 0.5. Kết quả dùng để kiểm tra độ hợp lý của việc chấm, không phải để khẳng định AI chấm đúng như giám khảo.
- Chỉ có 10 bài và chỉ có IELTS Task 2. Bài Daily Standup chưa có bộ tham chiếu.
- "Lỗi cài sẵn" (`planted_errors`) là các cụm sai cố ý đưa vào bài. Tỉ lệ AI bắt được chúng đo việc bỏ sót lỗi. Chưa có cách đo tự động việc AI bịa ra lỗi thật sự; chỉ đếm được các "sửa" không thay đổi gì (no-op).

## Phiên bản prompt

| Phiên bản | Trạng thái | Ghi chú |
|-----------|------------|---------|
| 1 | Đang dùng | Prompt ban đầu của `app/services/english_prompts.py` |
| 2 (thử, không áp dụng) | Đã hoàn nguyên | Thêm mô tả neo cho band 5/6/7/8, yêu cầu bắt lỗi nhầm từ (then/than...), và đặt `sentence_corrections` trước điểm số trong schema. Chưa đo được: hạn mức Gemini cạn giữa chừng, chỉ chấm được 2/10 bài, không đủ để kết luận |

`PROMPT_VERSION` trong `english_prompts.py` phải tăng khi sửa nội dung prompt, và kết quả mới phải ghi vào bảng này.

## Kết quả prompt v1 (gemini-2.5-flash, nhiệt độ 0.1)

| Bài | Tham chiếu | Lượt 1 | Lượt 2 |
|-----|-----------:|-------:|-------:|
| w01-band-5.0 | 5.0 | 5.0 | 5.0 |
| w02-band-5.5 | 5.5 | 6.0 | 5.5 |
| w03-band-6.0 | 6.0 | 6.0 | 7.0 |
| w04-band-6.0 | 6.0 | 6.0 | 6.0 |
| w05-band-6.5 | 6.5 | 6.5 | 6.5 |
| w06-band-6.5 | 6.5 | 7.0 | 6.5 |
| w07-band-7.0 | 7.0 | 7.0 | 6.5 |
| w08-band-7.0 | 7.0 | 7.0 | 7.5 |
| w09-band-7.5 | 7.5 | 7.5 | 7.5 |
| w10-band-8.0 | 8.0 | 8.0 | 7.0 |
| **Sai số tuyệt đối trung bình** | | **0.10** | **0.30** |
| Độ lệch trung bình (AI trừ tham chiếu) | | +0.10 | +0.00 |

- **Tiêu chí hoàn thành (sai số trung bình không quá 0.5): đạt ở cả hai lượt** (trung bình hai lượt là 0.20).
- **Độ ổn định kém hơn sai số trung bình gợi ý:** cùng một bài, hai lượt chạy có thể lệch tới 1.0 band (w03: 6.0 và 7.0; w10: 8.0 và 7.0). Với 10 bài và 2 lượt, không nên coi band của một lần chấm là chính xác hơn khoảng ±1.0.

### Lỗi hay gặp

- **Bỏ sót lỗi:** bắt được 19/20 lỗi cài sẵn ở cả hai lượt. Lỗi bị bỏ sót cả hai lần là nhầm từ `much more fun then` (đúng là `than`) trong w04.
- **Bịa lỗi:** 0 "sửa" không thay đổi gì. Chưa kiểm tra được lỗi bịa khác.
- **Câu gốc không khớp:** 0 bài phải thử lại và 0 bài thất bại vì lý do này, nên kiểm tra nguyên văn trong `EnglishCoach` chưa bị kích hoạt trong bộ bài này.

### So sánh với model khác (prompt v1, một lượt mỗi model)

| Model | Sai số tuyệt đối TB | Độ lệch TB | Lỗi cài sẵn bắt được |
|-------|--------------------:|-----------:|---------------------:|
| gemini-2.5-flash (đang dùng) | 0.10 và 0.30 (hai lượt) | +0.10 và +0.00 | 19/20 |
| gemini-3.5-flash | 1.30 | +1.30 | 19/20 |
| gemini-2.5-pro | không chạy được | | key không gọi được model này (10/10 bài lỗi `ClientError`) |

`gemini-3.5-flash` chấm cao hơn tham chiếu ở cả 10 bài (từ +0.5 đến +2.0), nên không phù hợp với prompt hiện tại. Kết quả nằm ở `backend/evals/results/v1-gemini-3.5-flash-run1.txt`. Đổi model qua biến `GEMINI_MODEL`; mỗi model có hạn mức riêng.

## Việc nên làm tiếp

- Chạy lại prompt v2 khi còn hạn mức, ít nhất hai lượt, và chỉ áp dụng nếu sai số và độ lệch giữa các lượt tốt hơn v1.
- Nhờ người chấm IELTS thật cho điểm lại 10 bài để có tham chiếu độc lập.
- Khi Gemini trả 5xx (đã gặp 503 "high demand" trong lúc chạy), API `POST /english/writing/evaluate` hiện chưa bắt lỗi này nên trả 500 `INTERNAL_ERROR`. Nên map sang 503 thân thiện và có thử lại.
