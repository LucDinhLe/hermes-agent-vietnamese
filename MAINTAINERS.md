# Người duy trì Hermes Agent tiếng Việt

## Người duy trì chính

- **Lê Đình Lực** ([@LucDinhLe](https://github.com/LucDinhLe))

Người duy trì chính chịu trách nhiệm cho phạm vi riêng của bản cộng đồng:

- Chất lượng và tính nhất quán của giao diện tiếng Việt.
- Tiếp nhận lỗi, xem xét pull request và hỗ trợ người dùng Việt Nam.
- Đồng bộ có kiểm soát với Hermes Agent gốc.
- Kiểm thử và phát hành bộ cài Windows, macOS và Linux.
- Quản lý cảnh báo bảo mật, mã kiểm tra SHA-256 và quy trình ký số khi có chứng thư phù hợp.

## Quan hệ với dự án gốc

Kho này là một bản cộng đồng độc lập phát triển từ [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) theo giấy phép MIT. Các lỗi thuộc phần mã nguồn gốc nên được đối chiếu với upstream trước khi sửa. Các lỗi liên quan đến bản dịch, bộ cài cộng đồng, đăng nhập được bổ sung trong fork hoặc quy trình phát hành được xử lý tại kho này.

## Nguyên tắc bảo trì

- Dùng dữ kiện kiểm chứng được khi mô tả mức sử dụng hoặc tình trạng dự án.
- Không đưa tài khoản, mã OAuth, khóa API hay dữ liệu người dùng vào mã nguồn và bộ cài.
- Không ghi đè một bản phát hành đã công bố. Bản sửa lỗi phải dùng nhãn mới.
- Mọi bản đa nền tảng phải đi qua quy trình build và kiểm tra tương ứng trước khi phát hành.
- Công khai giới hạn hiện tại, đặc biệt là trạng thái chưa ký số của bộ cài Windows và macOS.
