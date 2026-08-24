# Decision log — Context resolver và compaction

## Trạng thái

Accepted for implementation; nguyên nhân provider cuối cùng vẫn **chưa được
chứng minh** nếu không có normalized persisted error hoặc live probe được duyệt.

## Bối cảnh

Runtime từng dùng 272k cho Codex gpt-5.6-sol, source v31 phải resolve 272k lên
900k, còn UI có thể headline 1,05M. Session DB không lưu active prompt tokens hay
provider error class và không có compaction. Native compaction 200k đã có nhưng
mặc định tắt; local threshold GPT-5.6 có thể lên 85% effective window.

## Quyết định

- Route resolver là nguồn effective limit duy nhất; persist cả value và source.
- Native Responses compaction chạy `auto` cho gpt-5.6 trên Codex subscription và
  direct `api.openai.com`, mặc định mục tiêu 190k active input.
- Provider 400 structured rejection tắt native cho session, persist downgrade,
  retry request không native đúng một lần và giữ local fallback armed.
- Local fallback mục tiêu khoảng 200k–208k cho eligible gpt-5.6 route, trước vùng
  272k đã quan sát. Ngưỡng cuối dựa trên benchmark, không published 50%/85%.
- Context overflow: compact local rồi retry provider đúng một lần. Lỗi lần hai
  trả recoverable handoff/summary với recovery pointer; composer phải mở khóa.
- Quota/rate limit không compact mù và không đổi thành context full; giữ session,
  persist normalized code/reset time và cho phép resume/compact/switch sau đó.
- Persist normalized state, không raw body: last failure kind/code/reset, effective
  limit/source, logical history, active context, compaction count, native
  downgrade và context retry marker.
- Native checkpoint, user asks, paths, commit SHA, exact errors và quyết định là
  retention anchors bắt buộc trong synthetic recall tests.

## Hệ quả

- UI không còn lấy published capacity làm giới hạn vận hành.
- Restart có đủ state để giải thích và tiếp tục, thay vì chỉ an toàn khi gateway
  process còn sống.
- `compression.max_attempts` vẫn dùng cho manual/proactive paths nhưng provider
  context recovery có invariant one-retry riêng.

## Phương án loại

- Gọi mọi dừng dưới 300k là hard context limit: bằng chứng không đủ.
- Chờ 50%/85% của 1,05M: vượt vùng runtime 272k đã quan sát.
- Tắt native toàn cục sau một rejection: làm hỏng session/route khác.
- Lưu raw provider error body: tăng rủi ro credential/user-data leakage.
