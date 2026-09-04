# Đồng bộ thông tin công khai 2026.9.2

Phạm vi được chủ dự án duyệt ngày 2026-09-04: cập nhật toàn diện tài liệu và
đường tải công khai sau khi Latest đã chuyển sang v2026.9.2.

## Kế hoạch và tiêu chí

1. Đồng bộ README, hướng dẫn tiếng Việt/Windows, thông tin ký số, sao lưu,
   release notes và `.github/public-release.json` với release thực tế.
2. Chỉ quảng cáo Windows x64 cho 2026.9.2. Ghi bản đa nền tảng trước là lịch sử;
   macOS chưa qua nghiệm thu tin cậy, không hướng người dùng thường vượt Gatekeeper.
3. Kiểm tra quan hệ giữa nhãn, đường tải, phạm vi, mã băm và GitHub Latest;
   regression phải bắt nhãn/URL cũ và asset sai, không khóa test theo số bản cố định.
4. Công khai thay đổi tài liệu trên main, hậu kiểm nội dung từ GitHub và giữ
   nguyên tag, source commit, ID, size, digest của bộ cài.

Không build lại, không đổi mã sản phẩm/main sang engine mới, không chạy workflow
phát hành cũ, không cài đè hồ sơ thật và không nộp hồ sơ ký số trong việc này.

## Bằng chứng sản phẩm hiện hành

- Quyết định GO cho community pilot Windows x64 chưa ký số.
- Tag `v2026.9.2`, source `b51f306eae2370adc774b63f198ab12990bcf063`.
- `Hermes-2026.9.2-win-x64.exe`, 252118156 byte.
- SHA-256 `1ae55b4a3280e92d4a297f85d81cbb6bcc0a19170da8d9122755d19f40c43015`.
- Tên tương thích `Hermes-Vietnamese-Windows-x64-Setup.exe` có cùng byte.
- [Nghiệm thu](https://github.com/LucDinhLe/hermes-agent-vietnamese/actions/runs/33798311695)
  đạt cả currentuser/allusers: cài mới, dấu cộng, chat/tool mô phỏng, mở lại,
  nâng cấp từ vi-v0.32.1-18, repair, gỡ giữ dữ liệu, cài lại, rollback và gỡ sạch.
- Chưa chứng minh quyền model của từng tài khoản; không có automatic update feed.
- Rollback Windows x64 `vi-v0.32.1-18`. Dữ liệu thật chưa được cài đè.

## Nguyên nhân và biện pháp

Promotion đã đổi GitHub Latest nhưng bỏ qua cổng điều hướng H của rulebook.
README trên main và public-release.json còn vi-v0.32.1-18; hướng dẫn bằng ảnh
còn vi-v0.32.1-17. Các test cũ trộn descriptor công khai với phiên bản source
legacy và chỉ có validator stable. Cần kiểm độc lập tài liệu của pilot hiện tại.

## Kiểm tra trước công khai

- 14/14 kiểm thử quan hệ tài liệu/public và hợp đồng stable legacy đạt.
- 9/9 kiểm thử parser/promotion legacy đạt; đã tách source descriptor legacy
  khỏi descriptor Latest để không khóa tài liệu mới theo số bản cũ.
- Validator trên bốn tài liệu hiện hành đạt; `--live` đối chiếu GitHub Latest đạt.
- Cả URL bộ cài chuẩn, URL tương thích `/latest/download/` và SHA256SUMS trả HTTP200.
- YAML workflow read-only mới parse đạt; không cài dependency để chạy kiểm tra này.
- Rà mã nguồn tag calendar phát hiện Bảo trì không có hai nút mở/nhập ZIP như
  tài liệu cũ; hướng dẫn sao lưu đã đổi theo nhật ký tác vụ và đường sao lưu thủ công.
- Tài liệu dịch upstream được ghi rõ là tham khảo; không nhầm link upstream với
  bộ cài Vietnamese. Chưa có GitHub Pages được cấu hình tại thời điểm kiểm tra.

Trạng thái: kiểm tra cục bộ đạt, chuẩn bị công khai thay đổi tài liệu.
