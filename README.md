# Hermes Vietnamese

**Ứng dụng AI dành cho người Việt, giúp làm việc với tệp, trình duyệt, công cụ và nhiều nhà cung cấp model trong một cửa sổ.**

Hermes Vietnamese đóng gói Hermes Agent thành ứng dụng Desktop có giao diện Việt/Anh. Dự án cá nhân vì cộng đồng do [Lê Đình Lực](https://github.com/LucDinhLe) phát triển từ [Hermes Agent của Nous Research](https://github.com/NousResearch/hermes-agent), giữ [giấy phép MIT](LICENSE) và ghi công dự án gốc. Đây là bản phân phối độc lập.

<p align="center">
  <a href="https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.2"><img src="https://img.shields.io/badge/Tải_bản_2026.9.2-Windows_x64-F97316?style=for-the-badge" alt="Tải Hermes Vietnamese 2026.9.2 Windows x64"></a>
  <a href="README.vi.md">Hướng dẫn cài đặt và kết nối</a> · <a href="LICENSE">Giấy phép MIT</a>
</p>

<!-- current-release:start -->
> **Latest hiện tại là [2026.9.2](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.2), chỉ phát hành Windows x64.** Đây là community pilot chưa ký số, chưa phải stable. Bộ cài đã qua nghiệm thu cả kiểu cài cho một người dùng và toàn máy. Cập nhật bằng bộ cài đầy đủ, không có cập nhật tự động nền.

| Tệp | Tải xuống |
| --- | --- |
| Bộ cài Windows x64 | [Hermes-2026.9.2-win-x64.exe](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.2/Hermes-2026.9.2-win-x64.exe) |
| Cùng bộ cài, tên tương thích đường tải cũ | [Hermes-Vietnamese-Windows-x64-Setup.exe](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.2/Hermes-Vietnamese-Windows-x64-Setup.exe) |
| Mã kiểm tra toàn vẹn | [SHA256SUMS.txt](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.2/SHA256SUMS.txt) |

Chỉ tải **một** trong hai tệp `.exe`. Cả hai có cùng nội dung, kích thước **252118156 byte** và SHA-256:

```text
1ae55b4a3280e92d4a297f85d81cbb6bcc0a19170da8d9122755d19f40c43015
```
<!-- current-release:end -->

## Có gì trong 2026.9.2?

- Tiếp nối bản d14, sửa tạo phiên bằng dấu `+`, gửi tin đầu tiên, định tuyến model và ngữ cảnh ảnh cho Advisor.
- Đóng kèm Python 3.12.10 cùng thư viện bắt buộc. Lần khởi động lõi đầu tiên không cần tự cài Git/Python/Node.js hoặc tải `install.ps1` từ GitHub.
- Giữ phạm vi và thư mục cài trước đó khi nâng cấp; có gỡ ứng dụng giữ dữ liệu hoặc xóa dữ liệu theo lựa chọn rõ ràng.
- Dùng cách đánh số **năm.tháng.lần cập nhật trong tháng**. `2026.9.2` là lần cập nhật thứ hai của tháng 9/2026; ví dụ tiếp theo là `2026.9.3`, `2026.10.1`.

[Nghiệm thu bộ cài thực tế](https://github.com/LucDinhLe/hermes-agent-vietnamese/actions/runs/33798311695) đã đạt cài mới, gateway, ba tab tạo bằng dấu cộng, gửi tin và dùng công cụ với nhà cung cấp mô phỏng, giữ lịch sử sau mở lại, nâng cấp từ bản trước, sửa chữa, gỡ/cài lại và quay lui. Các phép thử này không xác nhận quyền truy cập model của từng tài khoản thật.

## Từ tải về đến giao việc

1. **Tải và cài.** Kiểm tra máy Windows x64, tải bộ cài phía trên, đối chiếu SHA-256 rồi mở tệp. Nếu đang dùng Hermes, sao lưu trước và đóng các phiên/gateway đang làm việc. Không chọn gỡ toàn bộ dữ liệu để nâng cấp.
2. **Kết nối model.** Mở Hermes, chọn ngôn ngữ và kết nối tài khoản hoặc khóa API của chính bạn. Lõi đã có trong bộ cài; tải tệp, đăng nhập, dùng dịch vụ AI và một số tính năng tùy chọn vẫn cần Internet.
3. **Giao một việc nhỏ.** Chọn model, tạo phiên mới bằng dấu `+` và thử một yêu cầu đơn giản trước khi giao việc quan trọng.

Xem [hướng dẫn cài đặt và kết nối](README.vi.md), [cài Windows bằng hình ảnh](docs/cai-dat-windows-bang-anh.md) và [sao lưu/khôi phục](docs/sao-luu-khoi-phuc.md).

## Model và tài khoản

| Kết nối | Bạn cần có |
| --- | --- |
| ChatGPT qua OpenAI OAuth | Tài khoản có quyền truy cập model qua kết nối Codex tương ứng |
| Claude Pro/Max qua Claude Code | Tài khoản và cầu nối Claude Code được cấu hình hợp lệ |
| Google Gemini | Khóa API Google AI Studio hoặc cấu hình Google Vertex AI |
| Nhà cung cấp khác | Tài khoản, khóa API hoặc điểm cuối tương ứng |
| Model cục bộ | Máy chủ model do bạn chuẩn bị; bộ cài không chứa sẵn model |

Hermes không tặng kèm tài khoản, hạn mức hay mở khóa model. Đăng nhập ChatGPT thành công không có nghĩa mọi model thấy trong một ứng dụng khác đều dùng được qua Hermes. Nếu Luna hoặc model khác báo `404`, kiểm tra đúng nhà cung cấp, mã model và quyền tài khoản. Model Advisor và model trả lời phiên là hai lựa chọn riêng. Xem [xử lý lỗi kết nối](README.vi.md#xử-lý-lỗi-kết-nối-thường-gặp).

## Các nền tảng khác và bản trước

**2026.9.2 chưa có bộ cài macOS, Linux hoặc Windows ARM64.** Không dùng bộ cài x64 để suy ra đã hỗ trợ ARM64.

[vi-v0.32.1-18](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.32.1-18) được giữ làm bản lịch sử và đường quay lui Windows x64. Các gói Windows ARM64/Linux của đợt đó chỉ có bằng chứng build, chưa có nghiệm thu sử dụng tương đương bản mới. macOS cũ chưa đạt yêu cầu ký/công chứng và kiểm tra Gatekeeper cho người dùng thường; không khuyến nghị cài hoặc vượt cơ chế bảo vệ để thử.

## Ký số, cập nhật và dữ liệu

- **Chưa ký số.** Windows có thể cảnh báo `Publisher: Unknown` hoặc tệp chưa được tải phổ biến. Kiểm tra nguồn và mã băm trước khi quyết định tiếp tục. Nếu Defender nêu tên mối đe dọa cụ thể, dừng cài và báo lỗi; không tắt bảo vệ toàn máy.
- **Hồ sơ ký số.** Dự án đang hoàn thiện để nộp lại hồ sơ; đợt này không có xác nhận được duyệt hoặc chữ ký mới. [Chính sách ký mã](CODE_SIGNING_POLICY.md) ghi rõ trạng thái.
- **Cập nhật thủ công.** Dùng bộ cài đầy đủ từ [Latest](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/latest). Chưa cung cấp `latest*.yml` hoặc luồng tự cập nhật cho pilot này.
- **Giữ dữ liệu khi cài đè.** Lịch sử, cấu hình và bộ nhớ nằm riêng với ứng dụng. Nâng cấp không chủ động xóa dữ liệu; vẫn cần [sao lưu và kiểm tra bản sao](docs/sao-luu-khoi-phuc.md) trước khi thay đổi. Chế độ gỡ toàn bộ sẽ xóa dữ liệu đã chọn.

## Quyền riêng tư và phạm vi sử dụng

Bộ cài không chứa tài khoản, khóa API hoặc lịch sử riêng của người đóng gói. Dự án không vận hành máy chủ tập trung thu thập thông tin đăng nhập. Khi bạn dùng AI, công cụ web hoặc dịch vụ đã kết nối, dữ liệu cần thiết được gửi đến dịch vụ đó theo cấu hình và quyền đã cấp.

Hermes có thể đọc/sửa tệp, chạy lệnh, dùng trình duyệt, ghi nhớ, học kỹ năng, giao việc cho agent phụ và chạy lịch khi được cấu hình. Hãy kiểm tra quyền và kết quả trước thao tác quan trọng. Phần mềm được cung cấp theo nguyên trạng; bản cộng đồng này chưa có bảo hành thương mại hay chứng nhận stable. Xem [miễn trừ và quyền riêng tư](DISCLAIMER.md).

## Mã nguồn và hỗ trợ

- [Mã nguồn chính xác của bộ cài 2026.9.2](https://github.com/LucDinhLe/hermes-agent-vietnamese/tree/v2026.9.2). Nhánh `main` chứa trang giới thiệu cập nhật nhưng chưa hợp nhất toàn bộ mã sản phẩm calendar; muốn kiểm tra/build đúng bản phát hành phải dùng tag này.
- [Ghi chú phát hành và bằng chứng](docs/release-2026.9.2-public-sync.md).
- [Báo lỗi](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues), kèm phiên bản, hệ điều hành, bước lỗi và ảnh đã che thông tin riêng.
- [Báo vấn đề bảo mật](SECURITY.md), [phạm vi bảo trì](MAINTAINERS.md), [tài liệu Hermes gốc](https://hermes-agent.nousresearch.com/docs/).
