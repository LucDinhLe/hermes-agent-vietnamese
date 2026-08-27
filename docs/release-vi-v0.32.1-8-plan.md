# Kế hoạch candidate `vi-v0.32.1-8`

Ngày chốt phạm vi: 2026-08-27  
Trạng thái lịch sử: source gate và build đạt tại run `33056165931`; staging
dừng trước download/tạo draft do GitHub trả `HTTP 429` khi fetch lại tag.
Candidate giữ bất biến, không rerun hay promotion. Kế hoạch hiện hành chuyển
sang `docs/release-vi-v0.32.1-9-plan.md`. GitHub Latest vẫn là
`vi-v0.32.0-1`.

## Mục tiêu

Phát hành bản cập nhật Windows x64 hợp nhất adaptive capabilities v32.1 với
hotfix an toàn phiên/dự án:

1. project scope không tồn tại qua relaunch;
2. repo discovery, auto archive và auto prune tắt mặc định;
3. Ẩn/Xóa dự án chỉ tác động metadata dự án, không ẩn, archive hoặc xóa phiên;
4. sidebar luôn có lối về **Tất cả dự án** và hiển thị đầy đủ cây phiên;
5. lifecycle exact installer phải chứng minh nội dung phiên còn nguyên sau mọi
   thao tác project, relaunch, update, repair, uninstall và rollback.

Không tải dữ liệu Hermes của người dùng lên cloud. Không đọc, sửa hoặc cài thử
trên profile Hermes thật của chủ dự án.

## Danh tính candidate

- Tag: `vi-v0.32.1-8`.
- Desktop version: `0.32.1-vi.8`.
- Release class trước promotion: `community-prerelease`.
- Audience: Windows 10/11 x64 community pilot.
- Authenticode dự kiến: `NotSigned`, signer certificate phải vắng mặt.
- Public descriptor và Latest v32 giữ bất biến tới promotion riêng.

## Lý do thay candidate `-7`

`vi-v0.32.1-7` build/stage xanh tại run `33053462058`. Exact installer có
340.620.814 byte và SHA-256
`5da162d3918fc6a94390cba75484ba838289c9e24d63ec04bc0429a1c0739f78`.

Lifecycle `33054540916` dừng trước khi mở dự án. Nút **Mở dự án** visible,
enabled và stable nhưng action row bao quanh chặn pointer click. Không có thao
tác project/session nào được thực thi. Evidence artifact `9639300595`, digest
`bf4cf2c657839d5dc4a9d69318e743ca96430758d478bbc6e34fa31b5bde1add`.

Candidate `-8` dùng phím `Enter` trên đúng semantic button. Đây là thao tác bàn
phím người dùng thật, không force click và không synthetic DOM click. Policy
khóa hành vi này để tránh tái phát.

## Source gate bắt buộc

- Ba cấu hình Desktop typecheck.
- Lifecycle/promotion policy tests và workflow contract.
- Public release metadata tests.
- Changed-file ESLint, Prettier, Ruff và `git diff --check`.
- Exact source commit sạch, tag bất biến và không có run/tag/release trùng.

## Build và lifecycle

1. Build đúng một lần Windows x64 từ exact tag.
2. Khóa source commit, installer size/SHA-256, manifest/provenance/signing
   receipt và private draft.
3. Chạy một exact lifecycle trên GitHub-hosted Windows guest cô lập.
4. Bắt buộc đạt fresh install, onboarding, relaunch, persistence, update từ
   exact public v32, project/session safety, repair, GUI/silent uninstall,
   rollback `vi-v0.20.4-39` và no-residual-process.
5. Gate project/session phải tạo phiên trong project bằng UI, ghi digest trước
   Ẩn/Xóa metadata, relaunch, tìm/mở lại phiên và xác nhận digest không đổi.

## Promotion và rollback

Chỉ promotion khi toàn bộ receipt xanh. Promotion phải khóa tag, commit,
installer size/hash, staging run, lifecycle run và evidence seal; hậu kiểm lỗi
phải trả `vi-v0.32.1-8` về draft/prerelease và khôi phục `vi-v0.32.0-1` làm
Latest.

Việc bỏ SignPath không bỏ qua provenance, hash, cảnh báo Publisher Unknown,
an toàn dữ liệu hoặc rollback. Stable/final vẫn không được tuyên bố cho byte
chưa ký.

## Quyết định hiện tại

**Source GO, Release NO-GO** cho tới khi exact candidate `vi-v0.32.1-8` vượt
toàn bộ lifecycle và hậu kiểm promotion.
