# Kế hoạch phát hành Hermes Vietnamese v26

**Candidate đã khóa:** `vi-v0.20.0-26` tại
`8ea73dcb475e32b8171bb970cc98ba809119f9b8`<br>
**Candidate kế tiếp cho phạm vi v26 mở rộng:** `vi-v0.20.0-27` (chưa tạo)<br>
**Base:** `4d597f74600cdc3791edf7d34566534182946c55`<br>
**Public hiện tại, bất biến:** `vi-v0.20.0-25` tại
`78d23ad2290521a8410d0aaa778e1566dc50f69a`

## 1. Nguyên tắc

- Mỗi lát cắt có commit và bằng chứng test riêng.
- Candidate tag bất biến; lỗi sau tag tạo số candidate mới.
- Không di chuyển `vi-v0.20.0-26`; Advisor và mọi thay đổi sau commit đã tag chỉ
  được phép đi vào candidate số mới.
- Không sửa tag/asset/release v25.
- Không dùng profile Hermes, Chrome hoặc Edge thật của người duy trì.
- Chỉ Windows x64 được gọi là real-machine verified trong v26 nếu exact artifact
  vượt smoke. Nền tảng khác giữ nhãn build-only nếu chưa có máy thật.
- Draft candidate không đồng nghĩa public. Public chỉ xảy ra sau mọi cổng bắt
  buộc và cập nhật hợp đồng `.github/public-release.json` trên đúng commit.

## 2. Lát cắt và commit

1. `docs(v26): freeze connector threat model and release plan`
2. `feat(connector): add validated preview cookie import and revoke core`
3. `feat(connector): add one-time loopback pairing protocol`
4. `feat(connector): ship official Chrome and Edge MV3 companion`
5. `feat(desktop): add connector consent preview and trust controls`
6. `feat(reasoning): add optional Vietnamese reasoning summaries`
7. `test(release): gate v26 connector and exact-artifact evidence`
8. `docs(release): prepare immutable v26 candidate evidence`
9. `feat(advisor): add read-only plan recovery and final checkpoints`
10. `test(release): gate advisor behavior and exact-artifact evidence`

Commit thực tế có thể tách nhỏ hơn, nhưng không gộp connector và reasoning.

## 3. Ma trận kiểm thử trước tag

### Source và unit

- `uv lock --check` và sync từ lock sạch.
- Python canonical suite liên quan gateway/auxiliary/release.
- Desktop typecheck, lint và unit suites.
- Cookie schema/property tests; import rollback; revoke exact identity.
- Pairing wrong origin/token, expired, replay, oversized body, app quit.
- Manifest permission allowlist, digest reproducibility và package resources.
- Reasoning summary off/on/dedupe/cache/profile isolation/error behavior.
- Advisor off tạo zero call; plan/recovery/final; read-only; redaction;
  tool-call/result pairing; giới hạn vòng sửa; profile/model persistence.
- Secret scan và log-redaction fixtures.

### Build

- Windows x64 và ARM64 native.
- macOS Apple Silicon và Intel native.
- Linux x64 và ARM64 native.
- Runtime import probe trong từng payload.
- Checksum/provenance bằng basename và artifact inventory đúng hợp đồng.

## 4. Exact Windows x64 isolated smoke

Mọi bước dùng cùng file installer đã tải lại từ draft candidate và xác minh
SHA-256. HOME, AppData, Electron user-data, Chrome profile và Edge profile đều
nằm trong thư mục kiểm thử cô lập.

1. Cài sạch candidate kế tiếp, boot, onboard, gửi prompt thường và chạy safe tool.
2. Mở Browser, pair Chrome profile thử, preview/import cookie giả gồm host-only,
   domain, path, session, persistent, HttpOnly, SameSite và một partitioned cookie.
3. Xác minh partitioned cookie bị bỏ qua; cookie khác chỉ xuất hiện trong
   `persist:hermes-preview`; log không có token/value.
4. Restart app, kiểm persistence session/persistent theo tài liệu; revoke và xác
   minh chỉ identity đã nhập bị xóa.
5. Lặp flow với Edge profile thử.
6. Kiểm expired code, replay, wrong origin, đóng app giữa pairing và connector
   disabled.
7. Bật summary: turn có public reasoning giữ bản gốc/answer, sinh một summary,
   hiện latency/usage, restart phục hồi cache. Tắt summary và xác minh zero call.
8. Tắt Advisor và xác minh zero call. Bật Advisor, chọn model riêng, chạy một
   tác vụ có kế hoạch/thay đổi/verify; xác minh đủ plan, recovery và final
   checkpoint, không tool nào chạy từ Advisor, vòng REVISE bị giới hạn và cấu
   hình model còn đúng sau restart.
9. Cài exact v25 vào profile Hermes cô lập, tạo dữ liệu không nhạy cảm, chạy
   updater tới exact candidate mới; xác minh session Hermes và cookie Hermes giữ đúng chính
   sách, connector mặc định tắt và summary mặc định tắt.
10. Uninstall, reinstall và rollback path đã phê duyệt; không tuyên bố hỗ trợ
   v14 -> candidate mới nếu chưa có bằng chứng exact-artifact riêng.

Ảnh/log bằng chứng phải redacted và chỉ dùng cookie giả. Scanner phải xác nhận
cookie value/token fixture không xuất hiện ngoài vùng test được cho phép.

## 5. Cổng draft candidate

Chỉ tạo tag/draft khi:

- worktree sạch, commit đã push và CI required checks xanh;
- sáu target build thành công;
- artifact inventory, SHA256SUMS, manifest và provenance khớp;
- source security tests xanh;
- release notes ghi rõ unsigned status, build-only targets, Chrome/Edge unpacked
  companion, partitioned-cookie limitation và rollback;
- v25 public identity vẫn nguyên vẹn.

## 6. Cổng public

Public là **NO-GO** nếu thiếu một mục:

- exact Windows x64 clean install + runtime + safe-tool smoke;
- exact v25 -> exact v26 update smoke;
- Chrome và Edge isolated connector smoke;
- revoke/persistence/log-redaction evidence;
- reasoning summary off/on/original-preservation evidence;
- Advisor off/on, plan/recovery/final, read-only, bounded revision và model
  persistence evidence;
- public-download regression dự kiến cho v26;
- `.github/public-release.json` đổi atomically sang tag candidate được duyệt,
  đúng filename, size,
  SHA-256, rollback và release class;
- promotion verifier xác nhận GitHub Latest, asset URL, manifest và README/docs
  cùng trỏ v26.

Nếu một cổng fail, giữ draft kín hoặc không tạo draft, ghi blocker và dừng.
Không dùng lời xác nhận thay thế bằng chứng máy thật.

## 7. Kế hoạch rollback

- Rollback target vẫn là `vi-v0.20.0-14` cho public contract cho tới khi quyết
  định sản phẩm đổi; v25 vẫn là artifact public gần nhất để phục vụ điều tra.
- Không di chuyển tag v26 hoặc candidate kế tiếp. Nếu bản public có lỗi nghiêm trọng, đổi Latest/download
  contract theo runbook sang rollback tag và giữ release v26 cùng evidence để
  audit.
- Cookie import ledger không chứa value nên rollback app không thể khôi phục giá
  trị đã revoke. Release notes phải nói rõ.

## 8. Hồ sơ bằng chứng

Candidate evidence tối thiểu gồm commit SHA, tag SHA, workflow/run ID, asset
inventory, SHA-256, test counts, exact smoke checklist, extension digest/manifest,
redaction scan và quyết định GO/NO-GO có ngày giờ. Bằng chứng nền tảng chưa smoke
phải ghi đúng `build-only`.
