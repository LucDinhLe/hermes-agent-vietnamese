# Hermes v29: Advisor theo phiên và dự án ghim

## Mục tiêu

Giúp người dùng kiểm soát Advisor ngay trong phiên đang làm và mở nhanh các dự án quan trọng từ panel trái, không phải đi vòng qua Cài đặt hoặc đổi chế độ danh sách.

Phân loại rủi ro: B. Hermes giữ cấu hình và lịch sử làm việc thật của người dùng. Thay đổi này chỉ chạm trạng thái giao diện và cấu hình theo phiên; không thay đổi quyền truy cập, cấu trúc cơ sở dữ liệu dự án hay dữ liệu trong thư mục dự án.

## Phạm vi đã chốt

### Advisor

- Mỗi panel chat giữa có một thanh Advisor riêng ngay dưới đầu phiên.
- Thanh chỉ nằm trong biên của `ChatView`, bị cắt theo panel chat và không được lấn sang panel Files, Browser hoặc Terminal ngoài cùng bên phải.
- Khi người dùng kéo hẹp panel, thanh thu gọn theo thứ tự: ẩn tên model Advisor, ẩn chữ Advisor, giữ biểu tượng và công tắc.
- Phiên mới nhận trạng thái Advisor từ mặc định của hồ sơ nhưng có thể đổi trước lần gửi đầu tiên.
- Phiên đã tạo có trạng thái Advisor riêng, được gửi và lưu theo phiên. Đổi ở phiên A không đổi phiên B hoặc mặc định toàn cục.
- Thanh Advisor có cả công tắc theo phiên và menu chọn model riêng. Menu hiển
  thị toàn bộ model của mọi nhà cung cấp đã kết nối, không bị giới hạn bởi danh
  sách model rút gọn của ô soạn tin.
- Cài đặt không lặp lại công tắc hay menu model Advisor; toàn bộ điều khiển nằm
  tại phiên đang làm việc.
- Panel Tệp/Trình duyệt/Terminal ngoài cùng bên phải được giữ nguyên và mở sẵn
  cho hồ sơ Desktop mới. Hồ sơ đã lưu trạng thái đóng mặc định từ bản lỗi được
  mở lại đúng một lần; lựa chọn đóng/mở sau đó vẫn được lưu và tôn trọng.

### Dự án ở panel trái

- Thêm khu vực **Dự án đã ghim** bên cạnh các khu vực phiên hiện có.
- Menu của mỗi dự án có lệnh Ghim hoặc Bỏ ghim.
- Dự án ghim hiển thị dạng một dòng gọn, có thể mở dự án hoặc tạo phiên mới trong dự án.
- Người dùng kéo thả để sắp xếp các dự án đã ghim.
- Danh sách ghim được lưu theo từng kết nối Hermes để dự án của gateway này không lẫn sang gateway khác.
- Ghim chỉ là lối tắt giao diện. Nó không sao chép, di chuyển, đổi tên hoặc thay đổi nội dung thư mục dự án.
- Xóa hoặc loại dự án khỏi sidebar cũng xóa ghim tương ứng.

## Kiến trúc

- `ChatView` là biên bố cục và clipping cho `SessionAdvisorBar`.
- Trạng thái Advisor hiệu lực được mang trong `ClientSessionState`, `SessionView` và sự kiện `session.info`.
- `session.create` nhận `advisor_enabled`; `config.set key=advisor` có `session_id` sẽ cập nhật override theo phiên. Không có `session_id` mới ghi mặc định hồ sơ.
- Pin dự án dùng atom theo kết nối và tái sử dụng `ReorderableList` cùng mô hình `ProjectOverviewRow` hiện có.
- Cây dự án từ backend vẫn là nguồn sự thật duy nhất. Pin chỉ giữ danh sách ID và giải quyết ID trên cây hiện tại.

## Trường hợp biên

- Panel chat rất hẹp: công tắc vẫn bấm được, nội dung bị thu gọn và không tạo cuộn ngang.
- Chỉ có một model đã kết nối: menu hiển thị một lựa chọn. Có nhiều nhà cung cấp
  hoặc nhiều model: menu phải hiển thị đầy đủ theo từng nhóm nhà cung cấp.
- Nhiều panel chat: mỗi thanh đọc và ghi đúng session runtime của panel đó.
- Mất kết nối khi bật Advisor: giao diện hoàn tác về trạng thái trước và báo lỗi.
- Project pin chưa xuất hiện trong cây vừa tải: giữ ID ở đúng vị trí; khi cây tải lại, dự án xuất hiện mà không mất thứ tự.
- Đổi gateway hoặc profile: pin không rò sang gateway khác; ID không giải quyết được thì tạm ẩn, không tự xóa.
- Dự án bị xóa hoặc bị loại khỏi sidebar: pin tương ứng được xóa.

## Tiêu chí nghiệm thu

1. Advisor bar nằm trong từng panel chat giữa và có `overflow-hidden` tại biên riêng.
2. Menu model Advisor liệt kê đủ model từ mọi nhà cung cấp đã kết nối và lưu
   đúng model được chọn cho tác vụ Advisor.
3. Hồ sơ Desktop mới mở sẵn panel phải; hồ sơ nâng cấp được chuyển đổi một lần,
   rồi người dùng vẫn có thể đóng và giữ lựa chọn đó qua lần chạy sau.
4. Kéo panel hẹp không làm panel phải đổi kích thước ngoài thao tác của người dùng và không tạo cuộn ngang.
5. Bật Advisor ở một phiên không đổi phiên khác hay `advisor.enabled` toàn cục.
6. Đóng rồi mở lại phiên vẫn khôi phục trạng thái Advisor của phiên.
7. Mỗi dự án có thao tác Ghim hoặc Bỏ ghim trong menu.
8. Dự án ghim mở đúng project scope và cho phép tạo phiên mới đúng thư mục.
9. Kéo thả đổi thứ tự dự án ghim và thứ tự tồn tại sau tải lại.
10. Pin chưa giải quyết không bị mất khi người dùng sắp xếp các pin đang hiển thị.
11. Pin của hai kết nối Hermes được cách ly.
12. Typecheck, lint và các kiểm thử mục tiêu cho Advisor, project pin, sidebar đều đạt.

## Ngoài phạm vi

- Không thêm nút “Gọi Giám sát ngay”.
- Không biến Project thành agent tự trị.
- Không đồng bộ pin qua tài khoản hoặc cloud mới.
- Không phát hành, tạo tag hoặc công khai candidate trong thay đổi này.
