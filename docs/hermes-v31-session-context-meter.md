# Đặc tả meter ngữ cảnh theo phiên Hermes V31

## Mục tiêu duy nhất

Hiển thị ngay cạnh Advisor mức dùng cửa sổ ngữ cảnh của model làm việc trong
từng phiên, dung lượng model do nhà phát hành công bố, chi phí sử dụng quy đổi
theo USD và thời điểm Hermes sẽ compact để người dùng chủ động tiếp tục hay mở
phiên mới.

## Nguồn sự thật

- Mức đã dùng lấy từ số đo prompt gần nhất của backend. Trước lượt đầu tiên,
  Hermes dùng ước lượng hiện có từ chỉ dẫn hệ thống, công cụ và lịch sử phiên.
- Dung lượng model công bố lấy từ metadata model và fallback đã đối chiếu với
  tài liệu chính thức của nhà phát hành. GPT-5.5 và dòng GPT-5.6 dùng tài liệu
  OpenAI; Claude dùng tài liệu Anthropic.
- Giới hạn tuyến hiện tại và ngưỡng compact lấy trực tiếp từ
  `context_compressor` của đúng runtime session. Không suy ra từ model Advisor.
- Model chưa có nguồn công bố đã xác minh dùng giới hạn runtime đang áp dụng và
  phải ghi rõ nguồn là runtime, không nhận là số liệu chính thức.
- Chi phí lấy từ tổng token tích lũy thực tế của đúng phiên, tách đầu vào, đầu
  ra, cache đọc và cache ghi. Mỗi lượt gọi dùng bảng giá của model/nhà cung cấp
  thực sự đã phục vụ lượt đó; số token hiện nằm trong cửa sổ ngữ cảnh không
  được dùng thay cho tổng token tính phí.
- Bảng giá công khai được chụp tại ngày 2026-08-20 từ tài liệu chính thức của
  [OpenAI](https://developers.openai.com/api/docs/models/compare) và
  [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing).

## Bảng dung lượng đã đối chiếu

| Nhóm model | Cửa sổ công bố | Nguồn |
| --- | ---: | --- |
| GPT-5.5 | 1.050.000 | [OpenAI](https://developers.openai.com/api/docs/models/gpt-5.5) |
| GPT-5.6 Sol, Terra, Luna | 1.050.000 | [OpenAI](https://developers.openai.com/api/docs/models/gpt-5.6-sol) |
| Claude Fable 5, Mythos 5/Preview, Opus 5, Sonnet 5, Opus 4.8/4.7/4.6, Sonnet 4.6 | 1.000.000 | [Anthropic](https://platform.claude.com/docs/en/build-with-claude/context-windows) |
| Các Claude còn lại, gồm Sonnet 4.5 | 200.000 | [Anthropic](https://platform.claude.com/docs/en/build-with-claude/context-windows) |

Đây là dung lượng model do nhà phát hành công bố. Tuyến kết nối có thể áp một
giới hạn thấp hơn; Hermes hiển thị giới hạn đó riêng và dùng nó để xác định
ngưỡng compact thực tế.

## Hành vi giao diện

- Meter nằm bên trái cụm Advisor và bên trong biên của panel giữa.
- Mỗi `ChatView` truy vấn bằng runtime session ID của chính nó; phiên khác
  không được dùng lại số liệu đang hiển thị.
- Nhãn đầy đủ có dạng `161.8k/1.05M (15%)`. Khi panel hẹp, nhãn rút còn phần
  trăm rồi biểu tượng; không đẩy sang panel phải.
- Khi đủ chiều rộng, chi phí USD của phiên xuất hiện cùng meter. Bấm meter mở
  chi tiết số USD, token đầu vào/đầu ra/cache và trạng thái ước tính hay thực
  tế.
- Tuyến API trực tiếp hiển thị chi phí ước tính theo giá niêm yết. Tuyến Codex
  thuộc gói thuê bao hiển thị **đã gồm trong gói** và một con số USD tham chiếu
  tương đương nếu cùng lượng token được tính theo giá API công khai; con số
  tham chiếu không được trình bày như khoản sắp bị trừ thêm.
- Bấm meter mở chi tiết gồm model làm việc, dung lượng công bố, giới hạn tuyến
  nếu khác, đã dùng, còn lại, số đo hay ước lượng và ngưỡng compact thực tế.
- Khi đã chạm ngưỡng compact, meter và cửa sổ chi tiết báo nên compact. Khi
  chưa chạm, cửa sổ cho biết còn bao nhiêu token tới ngưỡng.
- Đổi model làm việc hoặc kết thúc một lượt phải làm mới số liệu của phiên.

## Trường hợp biên

- Phiên nháp chưa có runtime ID: chưa hiện con số giả.
- Backend cũ thiếu trường mới: tiếp tục dùng `context_max` và giao diện hiện có.
- Model hoặc dung lượng không xác định: ẩn phân số thay vì mặc định 1M.
- Tuyến có giới hạn thấp hơn dung lượng model công bố: vẫn hiện cả hai, dùng
  giới hạn tuyến để tính ngưỡng compact.
- Mất kết nối hoặc truy vấn lỗi: giữ trải nghiệm chat hoạt động và không hiện
  số liệu của phiên trước.
- GPT-5.5 và dòng GPT-5.6 áp hệ số giá dài ngữ cảnh theo từng lượt gọi khi đầu
  vào vượt 272.000 token: đầu vào/cache nhân 2 và đầu ra nhân 1,5. Không áp hệ
  số này lên tổng cộng dồn của nhiều lượt nhỏ.
- Giá theo vùng, Batch/Flex/Priority, Fast mode, công cụ tích hợp, phí tìm kiếm,
  thuế và hợp đồng riêng nằm ngoài ước tính; giao diện phải ghi rõ đây là giá
  model theo bảng giá công khai.
- Model chưa có giá đáng tin cậy hiển thị **chưa có giá** thay vì suy đoán hoặc
  làm tròn thành `$0.00`.

## Ngoài phạm vi

- Không thay thuật toán, ngưỡng hoặc nội dung compact.
- Không đổi model làm việc hay model Advisor.
- Không tạo tag, artifact, draft release hoặc hành động công khai.

## Tiêu chí nghiệm thu

1. GPT-5.5 và GPT-5.6 hiển thị cửa sổ công bố 1.050.000 token.
2. Claude 1M và Claude 200K được phân nhóm đúng theo tài liệu Anthropic.
3. Giới hạn tuyến thấp hơn được trình bày riêng và không làm sai khuyến nghị
   compact.
4. Hai phiên song song gọi đúng hai runtime ID và không rò số liệu.
5. Meter nằm trong panel giữa, co gọn theo container.
6. Chi phí API trực tiếp và giá trị API tham chiếu của gói thuê bao được phân
   biệt rõ; số nhỏ hơn một cent vẫn hiện đủ chữ số có nghĩa.
7. Test backend, UI mục tiêu, typecheck, lint, format và diff check đạt.
