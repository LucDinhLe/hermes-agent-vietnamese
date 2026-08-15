# Không gian Trình duyệt dùng chung

## Mục tiêu

Hermes Desktop có một trình duyệt nằm ngay trong không gian làm việc. Người dùng và agent nhìn, đọc và thao tác trên cùng một trang, cùng phiên đăng nhập và cùng lịch sử điều hướng.

## Trải nghiệm đã triển khai

- Nút **Trình duyệt** và **Tệp** nằm ở đầu panel bên phải; không lặp lại tiêu đề chữ cho hệ thống tệp.
- Panel phải có hai chế độ **Tệp** và **Trình duyệt**. Chuyển chế độ chỉ ẩn bề mặt còn lại; cây thư mục, trang web, lịch sử điều hướng và phiên đăng nhập vẫn được giữ.
- Chế độ **Trình duyệt** có thanh tab riêng: nút `+` mở trang mới, `×` đóng từng tab và đóng tab cuối sẽ trở về chế độ **Tệp**.
- Mỗi tab Browser giữ webview và lịch sử riêng khi chuyển tab. URL do agent mở sẽ điều hướng tab Browser đang chọn thay vì tự sinh thêm tab.
- Trình duyệt chỉ hiển thị ở panel phải, vì vậy cuộc trò chuyện và các tab phiên ở vùng giữa luôn còn trên màn hình để làm việc song song.
- Có thể kéo vạch chia để mở rộng hoặc thu hẹp panel phải.
- Thanh địa chỉ có các nút quay lại, tiến tới và tải lại.
- Hỗ trợ cửa sổ đăng nhập do website chủ động mở cho các luồng OAuth và đăng nhập mạng xã hội.
- Phiên web dùng partition bền vững `persist:hermes-preview`, vì vậy người dùng và agent dùng chung phiên đăng nhập trên máy.
- Các preview tệp và sản phẩm tạo ra vẫn mở cạnh vùng làm việc như trước; chúng không chiếm chỗ của Browser trong panel phải.

## Cầu nối cho agent

### Đọc trang

`read_preview` trả về:

- `title`, `url`, `text`;
- `elements`: danh sách `{ref, role, name, disabled}` cho liên kết, nút, ô nhập, select và textarea đang hiển thị.

Mã tham chiếu có dạng `@p1`, `@p2` và được gán lại sau mỗi lần đọc. Agent phải đọc lại sau khi chuyển trang hoặc khi cấu trúc trang thay đổi lớn.

### Thao tác trang

Trong phiên Desktop, agent có công cụ `interact_preview` với các thao tác:

- `click`: cần `ref`;
- `type`: cần `ref` và `text`;
- `press`: cần `key`, gửi vào phần tử đang focus;
- `scroll`: nhận `delta_y`;
- `back`, `forward`, `reload`: điều khiển lịch sử của chính webview đang hiển thị.

Mỗi kết quả trả về JSON có `ok`, `action`, `url`, `title` và thông báo ngắn.

## An toàn và riêng tư

- Công cụ chỉ được cấp cho phiên có nguồn `desktop`; CLI và gateway từ xa không nhận công cụ này.
- Snapshot không đọc giá trị ô mật khẩu.
- Agent bị từ chối khi cố nhập vào ô có `type=password`.
- Thanh địa chỉ chỉ nhận HTTP và HTTPS; chặn `javascript:` và `file:`.
- Agent không được tự xác nhận thanh toán, xóa dữ liệu hoặc gửi nội dung nhạy cảm nếu chưa có sự đồng ý phù hợp của người dùng.

## Xác minh

- 39/39 kiểm thử giao diện mục tiêu đạt.
- 71/71 kiểm thử Python cho công cụ, giao thức và phạm vi toolset đạt.
- Desktop typecheck đạt.
- Desktop lint đạt với 0 lỗi; còn 91 cảnh báo có sẵn ở các phần khác của dự án.
- Production build và bản Windows unpacked đạt.
- Smoke test bằng hồ sơ hoàn toàn mới đạt đến màn hình thiết lập lần đầu; không đọc khóa hoặc dữ liệu Hermes hiện tại.

## Giới hạn của bản đầu

- Chưa đọc và thao tác bên trong iframe khác miền.
- Phím `press` phụ thuộc cách trang web tiếp nhận sự kiện bàn phím.
- URL hiện tại trong lịch sử webview chưa được khôi phục sau khi đóng hẳn ứng dụng.
- Cần kiểm tra trực quan thêm trên macOS và Linux bằng máy thật trước khi coi đây là tính năng ổn định đa nền tảng.
