# Kế hoạch candidate `vi-v0.32.1-9`

Ngày chốt phạm vi: 2026-08-27  
Trạng thái: source integration và hardening tag refresh đạt gate cục bộ; chưa
build/tag/stage/public. GitHub Latest vẫn là `vi-v0.32.0-1`.

## Mục tiêu và audience

Phát hành community pilot Windows 10/11 x64 hợp nhất adaptive capabilities
v32.1 với hotfix an toàn phiên/dự án. Dữ liệu vẫn ở máy hoặc máy ảo người dùng
đã chọn; Hermes không tải phiên, dự án hay bản sao lưu lên cloud.

Các hợp đồng bắt buộc:

1. project scope không tồn tại qua relaunch;
2. repo discovery, auto archive và auto prune tắt mặc định;
3. Ẩn/Xóa dự án chỉ tác động metadata, không ẩn, archive hoặc xóa phiên;
4. sidebar luôn có **Tất cả dự án** và hiển thị đầy đủ cây phiên;
5. exact lifecycle phải chứng minh digest nội dung không đổi qua thao tác dự án,
   relaunch, update, repair, uninstall và rollback.

## Danh tính candidate

- Tag: `vi-v0.32.1-9`.
- Desktop version: `0.32.1-vi.9`.
- Exact source commit: khóa sau toàn bộ source gate.
- Release class trước promotion: `community-prerelease`.
- Authenticode: phải ghi trung thực `NotSigned`, không có signer certificate.
- Public descriptor và Latest v32 giữ bất biến tới promotion riêng.

## Lý do thay candidate `-8`

`vi-v0.32.1-8` vượt source gate và build Windows x64 tại run `33056165931`.
SignPath được bỏ qua; provenance, checksum và receipt `NotSigned` đều đạt.

Staging dừng trước download artifact và trước tạo draft do `git fetch` gặp
GitHub `HTTP 429`. Candidate `-8` giữ bất biến và không rerun.

Candidate `-9` dùng retry action hiện hữu cho hai tag refresh bắt buộc:

- tối đa 5 lần, cách nhau 15 giây;
- chỉ retry thao tác mạng `git fetch`;
- sau đó vẫn so exact fetched tag, checkout và verified commit;
- hết retry hoặc lệch commit đều fail-closed trước metadata/draft.

## Gate bắt buộc

- Ba cấu hình Desktop typecheck.
- Lifecycle/promotion/public contract và workflow contract.
- Public metadata Python tests.
- Changed-file ESLint, Prettier, Ruff và `git diff --check`.
- Không tồn tại tag, release hoặc Actions run trùng trước tag push.
- Build đúng một lần Windows x64 từ exact tag.
- Khóa installer size/SHA-256, manifest, provenance và signing receipt.
- Exact lifecycle trên Windows guest cô lập: fresh install, onboarding,
  relaunch, update v32→v32.1, project/session safety, repair, GUI/silent
  uninstall, rollback `vi-v0.20.4-39` và no-residual-process.

## Promotion và rollback

Chỉ promotion khi toàn bộ receipt xanh. Promotion khóa tag, commit, size/hash,
staging run, lifecycle run và evidence seal. Hậu kiểm lỗi phải trả
`vi-v0.32.1-9` về draft/prerelease và khôi phục `vi-v0.32.0-1` làm Latest.

Việc bỏ SignPath không bỏ qua provenance, hash, cảnh báo Publisher Unknown,
an toàn dữ liệu hoặc rollback. Không tuyên bố stable/final cho byte chưa ký.

## Quyết định hiện tại

**Source GO, Release NO-GO** cho tới khi exact candidate `vi-v0.32.1-9` vượt
toàn bộ lifecycle và hậu kiểm promotion.
