# Kế hoạch candidate `vi-v0.32.1-9`

Ngày chốt phạm vi: 2026-08-27  
Trạng thái: **HISTORICAL NO-GO**. Build/staging `33058450054` xanh; lifecycle
`33059934813` fail-closed ở thao tác disclosure bằng pointer. Không promotion;
GitHub Latest vẫn là `vi-v0.32.0-1`.

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

## Kết quả bất biến

- Exact commit: `35a36339b14950a3db620791f5778aeab909d799`.
- Installer: 340.626.053 byte; SHA-256
  `31812e2539c288e3f0e380ed721a260f0800601110f19dad8d3fb09cfbb7b5be`.
- Authenticode: `NotSigned`, signer absent.
- Lifecycle evidence: artifact `9641548178`, digest
  `09ce7a5fdd92ed4f8910f9cbbc4d0f1a07f4441b13d23eb25effcd574319b6f4`.
- Fresh install, onboarding, packaged mock runtime và relaunch đều đạt.
- `projectSessionSafety` đã tạo phiên project-addressable và ghi nội dung; dừng
  khi Playwright click trung tâm nút **Ẩn phiên** và metadata thời gian của hàng
  phiên chặn tọa độ. Candidate `-9` giữ nguyên, không rerun hoặc promotion.

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

**HISTORICAL NO-GO**. Candidate kế nhiệm là `vi-v0.32.1-10`.
