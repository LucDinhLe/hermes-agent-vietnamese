# Hồi cứu phát hành Hermes Vietnamese vi-v0.20.0-25

Ngày bàn giao: 2026-08-17

## Kết quả cuối

`vi-v0.20.0-25` đã được công bố làm bản tải mặc định/Latest theo phạm vi
**community pilot**, không phải stable.

| Thuộc tính              | Giá trị                                                                           |
| ----------------------- | --------------------------------------------------------------------------------- |
| Release                 | `vi-v0.20.0-25`                                                                   |
| Candidate source/tag    | `78d23ad2290521a8410d0aaa778e1566dc50f69a`                                        |
| Public docs trên `main` | `e56e13658f94145ccd5f12c791fe1fd0aa1abb96`                                        |
| Asset công khai         | 27                                                                                |
| Windows x64             | `Hermes-Vietnamese-Windows-x64-Setup.exe`                                         |
| Kích thước Windows x64  | `332776297` byte                                                                  |
| SHA-256 Windows x64     | `0f31c4a23bbb7913300b3f3571ad346aae517d367705a965d451a1febf620e59`                |
| Rollback                | `vi-v0.20.0-14`                                                                   |
| Signing                 | Windows chưa Authenticode; macOS chưa Developer ID/notarization                   |
| Public URL              | <https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-25> |

Sau lần cập nhật mô tả ngày 2026-08-17, tag và candidate commit vẫn giữ nguyên.
Không asset nào được tạo hoặc cập nhật sau thời điểm release public; 19/19 dòng
trong manifest chính khớp digest GitHub và hash của `SHA256SUMS.txt` khớp
`pilot-release-evidence.json`.

## Từ tiếp nhận đến candidate

### 1. Bảo toàn trạng thái và tách dữ liệu lỗi

- Nhánh làm việc cũ có hiện vật thử nghiệm và một hồ sơ Hermes đã nhập từ trước.
- `state.db` của hồ sơ đó báo `database disk image is malformed`; đây là dữ liệu
  cục bộ hỏng, không phải bằng chứng cho chất lượng bộ cài.
- Mọi sửa đổi tiếp theo dùng worktree riêng từ `origin/main` và hồ sơ/AppData
  cô lập. Dữ liệu cũ không được nhập, đọc để tái sử dụng hoặc khôi phục.

**Bài học:** trạng thái máy vận hành và trạng thái sản phẩm phải được tách ngay
từ đầu. Fresh-install chỉ có giá trị khi cả Hermes home, AppData và Electron
user-data đều độc lập.

### 2. Đóng lỗ hổng runtime thật

- Runtime Python khóa `cryptography 48.0.1`, bị ảnh hưởng bởi ba CVE; sàn an toàn
  chung là `cryptography >= 50.0.0`.
- Pin và `uv.lock` được nâng lên 50.0.0, kèm regression chống hạ phiên bản.
- Cảnh báo Node được phân loại theo khả năng đi vào Desktop runtime, build,
  optional và website. `tar` runtime/build được ép lên bản vá; cảnh báo chỉ nằm
  website hoặc không reachable không bị trình bày như lỗi runtime.

**Bài học:** số cảnh báo không thay thế reachability. Quyết định phát hành phải
dựa trên dependency thực sự nằm trong runtime/artifact.

### 3. Sửa hành vi người dùng quan sát được

- Tiêu đề phiên mới phản ứng đúng với locale.
- Tên phiên tự sinh xuất hiện ở panel trái; đổi tên theo runtime lineage không
  còn trả 500.
- `doctor --fix` sửa database WAL cũ khi tiến trình đã dừng; database mới dùng
  rollback journal để tránh lỗi SQLite đã quan sát.
- Panel phải mở rộng theo viewport, tự fit Browser khi hẹp và refit sau khi kéo.
- Browser có nhiều tab, nút `+`/`×`, giữ webview khi chuyển tab và trở về Tệp khi
  đóng tab cuối; nhãn chữ **Hệ thống tệp** thừa được bỏ.

**Bài học:** test component chưa đủ cho layout Electron. Cần kiểm tại ranh giới
pointer/resize, persistence và đúng bản đã đóng gói.

### 4. Loại Git khỏi lần chạy đầu

- Bootstrap mỏng từng fetch repository và có thể yêu cầu branch/commit chưa
  public, gây lỗi `git fetch exit 128` trên máy sạch.
- Candidate chuyển sang bundle runtime/payload cần thiết, install stamp và
  manifest trong artifact.
- Updater chính thức đổi SSH sang HTTPS, giới hạn shallow fetch và giữ remote
  fork/tùy chỉnh của người dùng.

**Bài học:** người dùng tải ứng dụng không được trở thành người clone source.
Critical path phải chạy được khi máy không có Git hoặc công cụ lập trình.

## Từ candidate v15 đến v25

Các candidate v15–v24 được giữ làm bằng chứng học tập và không được quảng cáo
như release cuối. Mỗi số mới xuất hiện vì candidate trước thay byte hoặc thất
bại một cổng:

| Candidate | Blocker chính                                                    | Cổng được bổ sung                                    |
| --------- | ---------------------------------------------------------------- | ---------------------------------------------------- |
| v15       | Gói còn phụ thuộc bootstrap mỏng và thiếu promotion runtime gate | Bundle payload, install stamp, exact-artifact gate   |
| v16       | Install E2E của fork chưa hiểu họ tag Việt hóa                   | Test tag `vi-v*` trên fork                           |
| v17       | Native payload staging phụ thuộc đường dẫn/runner                | Staging portable                                     |
| v18       | Đường unsigned packaging chưa cách ly                            | Candidate unsigned tách riêng và báo đúng            |
| v19       | Windows ARM64 thiếu native `pywinpty` phù hợp                    | Pin wheel x64/ARM64 và import probe                  |
| v20       | macOS Intel thiếu wheel `cryptography 50.0.0`                    | Dựng sdist khóa hash với OpenSSL tĩnh                |
| v21       | Provenance trong manifest dùng path thay basename                | Verifier so theo basename                            |
| v22       | Workflow tải draft asset theo release sai phạm vi                | Resolve asset bằng đúng repository/release           |
| v23–v24   | Windows uninstall giữ tiến trình/CWD trong app tree              | Native uninstall regression và xác minh xóa app tree |
| v25       | Candidate đầu tiên vượt chuỗi staging/pilot đã chốt              | Promotion đúng byte và hậu kiểm public               |

**Bài học:** không vá asset cùng tag. Mỗi thay đổi byte phải có tag, manifest và
bằng chứng mới.

## Chuỗi phát hành v25 đã chứng minh

1. Candidate `78d23ad…` đã push, fetch được và được gắn tag
   `vi-v0.20.0-25`.
2. Workflow native build/staging dựng sáu target đúng runner và tạo
   `candidate-provenance.json`, signing reports cùng `SHA256SUMS.txt`.
3. Install & Update E2E chạy theo đúng họ tag Việt hóa.
4. Windows x64 exact artifact được cài trên máy Windows 11 x64 vật lý bằng hồ
   sơ sạch. Fresh install, runtime, gateway, onboarding, phiên/tab, Browser,
   resize, persistence, repair và hai chế độ uninstall đều đạt.
5. `pilot-release-evidence.json` ghi rõ hai cổng chưa chạy là safe tool bằng
   provider thật và update Desktop từ v14.
6. Workflow promotion tải lại draft, kiểm provenance/manifest/evidence rồi
   công khai cùng byte; không rebuild.
7. Public audit xác nhận tag, Latest, asset count, digest và URL tải.

### Workflow bằng chứng

- Native build/staging: <https://github.com/LucDinhLe/hermes-agent-vietnamese/actions/runs/31928640061>
- Install & Update E2E: <https://github.com/LucDinhLe/hermes-agent-vietnamese/actions/runs/31928640288>
- Promotion: <https://github.com/LucDinhLe/hermes-agent-vietnamese/actions/runs/31931684926>

## Lỗi thoát ra sau public

### README và hướng dẫn vẫn trỏ v14

Sau khi v25 thành Latest, README, hướng dẫn Windows và một phần nội dung public
vẫn dẫn người dùng tới v14. Người duy trì và ít nhất một người dùng đã tải nhầm.
Artifact v25 không lỗi; điều hướng công khai đã sai.

Nguyên nhân hệ thống:

- Phiên bản release nằm rải rác trong nhiều tài liệu.
- Promotion kiểm byte nhưng chưa kiểm đường đi từ README tới asset.
- `Latest` và release notes chưa được coi là một phần của distribution contract.

Khắc phục:

- `.github/public-release.json` trở thành nguồn hợp đồng cho bản tải mặc định.
- Regression kiểm tag, rollback, tên asset, kích thước/hash Windows x64 và liên
  kết giữa README, README.vi, hướng dẫn Windows cùng release notes.
- PR #33 sửa toàn bộ đường tải; PR #34 viết lại mô tả, hướng dẫn kiến trúc máy,
  kết nối model và cảnh báo cài đặt bằng ảnh.

**Bài học:** promotion chưa kết thúc khi asset vừa public. Nó kết thúc sau khi
một người đi từ trang chủ tới đúng asset, tải được và hash khớp.

## Điều đã thay đổi sau release

Chỉ metadata và tài liệu công khai được sửa:

- `main` nhận các commit tài liệu/contract sau candidate.
- Release body được cập nhật để nêu lý do dự án, đối tượng, giấy phép, lựa chọn
  máy, kết nối model, cảnh báo ký số, giới hạn và miễn trừ.
- Bốn ảnh Edge/SmartScreen được thêm vào repository và nhúng bằng URL `main`.

Không có tag mới, rebuild hoặc asset replacement. GitHub `release.updated_at`
đổi do mô tả được sửa; thời điểm cập nhật mới nhất của asset vẫn nằm trước giờ
public.

## Giới hạn còn mở

- Windows và macOS chưa ký/công chứng; SignPath đang chờ xét duyệt, Apple
  Developer Program chưa được mua.
- Windows ARM64, macOS Apple Silicon/Intel và Linux x64/ARM64 mới có build native,
  chưa có real-machine smoke.
- Windows x64 chưa chạy safe tool bằng provider dùng một lần.
- Update Desktop từ v14 bằng exact artifact v25 chưa được kiểm chứng.
- v25 là community pilot và không được nâng thành stable bằng phản hồi cảm tính.

## Những nguyên tắc cần giữ cho mọi bản sau

1. Không dùng hồ sơ Hermes thật để thử.
2. Không khôi phục dữ liệu cũ để tạo bằng chứng.
3. Không build lại sau khi smoke bắt đầu.
4. Không thay asset dưới tag đã công bố.
5. Không gọi build-only là tương thích máy thật.
6. Không mô tả unsigned là đã được Microsoft/Apple phê duyệt.
7. Không sửa release mà bỏ hậu kiểm Latest, đường tải và manifest.
8. Không cho feature mới vào candidate đã freeze; sửa blocker thì tạo candidate
   và chạy lại cổng bị ảnh hưởng.

Điểm bắt đầu v26 được ghi tại `docs/handoff-vi-v0.20.0-26.md`.
