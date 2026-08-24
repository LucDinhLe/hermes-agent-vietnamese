# Decision log — Context, quota và API-equivalent meter

## Trạng thái

Accepted for implementation.

## Bối cảnh

Headline v31 dùng published capacity và integer rounding: 17,3k/1,05M thành 2%
dù giá trị thật khoảng 1,65%. Nó ghép `~$0.09` mà chỉ giải thích API-equivalent
trong popover, không có logical history, compaction count hay Codex quota.

## Quyết định

- Headline dùng active context / effective route limit; hiển thị phần trăm một
  chữ số thập phân, ví dụ `1,6%`.
- Panel tách rõ:
  - active context;
  - system/background và conversation;
  - logical history và compaction count;
  - effective limit, published reference và metadata source;
  - provider subscription quota;
  - actual/estimated/API-equivalent cost.
- Không suy quota. RPC fail-open trả `available:false`; UI ghi “Chưa có dữ liệu”.
- Codex quota RPC tái dùng backend account-usage parser; credential không bao giờ
  đi sang renderer.
- Subscription route ghi ngay cạnh số tiền: “API tương đương — không phải khoản
  đang bị tính”. API-billed route dùng label actual/estimated phù hợp.
- Category estimate và measured headline phải có nhãn riêng, không ngụ ý tổng
  segment bằng measurement provider.
- Meter theo turn bổ sung model calls, tool calls, input mới, cache-read, output,
  API-equivalent và near-limit/paused state.

## Hệ quả

- Published 1,05M vẫn có thể xem như reference nhưng không che effective 272k,
  372k hay 900k.
- UI cần contract backend mới và i18n đầy đủ; client không tự suy logical tokens,
  compaction hay quota.
- Mọi terminal error phải clear busy/awaiting/compaction state và giữ session.

## Phương án loại

- Chỉ đổi Math.round thành decimal: sửa hình thức nhưng vẫn trộn denominator.
- Dùng Nous credit bars cho Codex quota: sai sản phẩm và reset semantics.
- Suy quota từ context percent hoặc API-equivalent: không có cơ sở.
