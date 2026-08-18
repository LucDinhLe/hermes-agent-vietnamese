# Kế hoạch kiểm chứng vi-v0.20.0-15

## Mục tiêu

Chuẩn bị một checkpoint cục bộ đủ an toàn để cân nhắc thử nghiệm rộng hơn:
loại `cryptography` bị ảnh hưởng khỏi runtime, sửa hợp đồng install/update E2E
cho tag Việt hóa, phân loại cảnh báo theo khả năng đi vào sản phẩm, và kiểm tra
bộ cài Windows x64 bằng hồ sơ hoàn toàn cô lập.

## Giả định và ranh giới

- Đây là ứng dụng loại B theo VIBECODING vì bộ cài quản lý runtime và dữ liệu cục bộ.
- Dữ liệu Hermes cũ không được nhập, đọc, sửa hay khôi phục trong lát cắt này.
- Worktree bắt đầu từ `origin/main` tại `771fd6df9`; nhánh cũ và hiện vật smoke cũ
  nằm ngoài worktree này.
- Không push, merge, tạo tag hoặc phát hành trước khi Đại ca xác nhận.
- CI native không thay thế kiểm thử máy thật. Thiếu macOS Apple Silicon hoặc Linux
  x64 thật sẽ được ghi là cổng còn mở.

## Lát cắt và bằng chứng

1. **Phụ thuộc Python runtime**
   - Nâng pin và lock lên tối thiểu `cryptography==50.0.0`.
   - Test metadata phải chặn mọi lần hạ xuống dưới `50.0.0`.
   - `uv lock --check`, cây phụ thuộc đảo và test xác thực liên quan phải đạt.
2. **Cảnh báo JavaScript**
   - Phân loại theo Desktop runtime, bootstrap/build, website-only hoặc stale.
   - Chỉ vá thêm mục có thể đi vào runtime hoặc bộ cài; kiểm tra nội dung package
     sau build thay vì suy diễn từ lockfile.
3. **Install/update E2E**
   - Khi repo có tag `vi-v*`, bộ chọn chỉ lấy họ tag Việt hóa; repo upstream vẫn
     dùng họ `vYYYY.M.D[.N]`.
   - Push tag `vi-v*` phải kích hoạt workflow.
   - Job chọn tag phải in event, ref, họ tag và danh sách đã chọn trước khi fan-out.
4. **Windows x64 sạch**
   - Build production và NSIS x64.
   - Dùng `HERMES_HOME`, LocalAppData/Roaming AppData và Electron user-data riêng.
   - Xác minh bootstrap, health, onboarding, phiên mới, nhiều tab, đóng tab, panel
     phải Tệp/Trình duyệt và không có dữ liệu cũ.

## Điều kiện dừng

- Dừng phát hành nếu lock/runtime còn `cryptography < 50.0.0`.
- Dừng nếu Windows fresh-install không đạt hoặc có dấu hiệu đọc hồ sơ thật.
- Dừng nếu cảnh báo nghiêm trọng có khả năng đi vào runtime chưa được vá.
- Dừng trước mọi hành động công khai để xin xác nhận của Đại ca.
