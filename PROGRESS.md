# Tiến độ

## Cập nhật 2026-08-14 — khôi phục nút đóng tab phiên

- Khôi phục nút `×` trên mọi tab ngang có thể đóng: tab đang hoạt động luôn hiển thị, tab nền hiện khi rê chuột hoặc focus bằng bàn phím.
- Nút dùng vùng bấm 24 px, con trỏ bàn tay, nhãn trợ năng và tooltip theo ngôn ngữ giao diện; thao tác được chặn khỏi cơ chế kéo/chọn tab để một lần bấm chỉ thực hiện một việc.
- Giữ nguyên hành vi an toàn có sẵn: phiên đang chạy hỏi xác nhận, còn đóng tab chỉ ẩn tab và phiên vẫn mở lại được từ danh sách bên trái.
- Chuẩn hóa tiêu đề tab từ dữ liệu cũ `NEW SESSION` thành **Phiên mới** theo locale hiện tại; tiêu đề thật do người dùng đặt không bị thay đổi.
- Xác minh: 28/28 kiểm thử mục tiêu đạt; typecheck đạt; lint 0 lỗi; 3.679/3.686 phép thử UI đầy đủ đạt ở lượt song song và cả 7 lỗi timeout/chồng DOM đều đạt khi chạy lại riêng; production build Desktop đạt ngoài sandbox.

## Cập nhật 2026-08-14 — phát hành vi-v0.20.0-12

- PR #14 đã nhập vào `main`, gồm luồng cài đặt/kết nối model, sửa bootstrap Windows, khôi phục tab nhiều phiên và đưa Trình duyệt dùng chung vào panel phải.
- Sửa hai phép thử `prompt-overlays` từng mặc định chữ tiếng Anh bằng cách khóa locale của chính bài test; toàn bộ UI suite trên GitHub đạt 3.672/3.672 phép thử.
- Cổng phát hành phát hiện advisory mới `GHSA-2v37-7h3g-55p8`. PR #15 nâng riêng `nanoid` dòng 3 từ `3.3.17` lên `3.3.18`; `npm audit --omit=optional --audit-level=high` trả `0 vulnerabilities`, kiểm tra lockfile semantic và CI đạt.
- Pre-release [`vi-v0.20.0-12`](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.0-12) được tạo từ commit `4aee0954b12e5f5848c56d08741baeb036e1527d`, đủ 19 tài sản cho Windows, macOS và Linux x64/ARM64 cùng bảng SHA-256.
- Bộ cài Windows x64 công khai có SHA-256 `cd42357d336b3f21fa2017fd521169ef00a034abda9524909da700a3cdc7c989`; mã băm tải thật khớp cả `SHA256SUMS.txt` và digest GitHub. Tệp vẫn chưa ký số trong thời gian chờ SignPath xét duyệt.

## Cập nhật 2026-08-14 — đưa Trình duyệt vào panel phải

- Bỏ mục **Trình duyệt** khỏi thanh điều hướng bên trái và giữ nguyên toàn bộ tab phiên trong vùng làm việc giữa.
- Thêm hai nút **Tệp** và **Trình duyệt** cạnh tên thư mục ở đầu panel phải; biểu tượng dùng kích thước điều khiển panel 32 px để dễ nhìn và có trạng thái đang chọn rõ ràng.
- Trình duyệt dùng chung được render trực tiếp trong panel phải. Chuyển qua lại chỉ ẩn bề mặt, không tháo cây tệp hoặc webview, nên trạng thái cây, lịch sử trang và phiên đăng nhập còn nguyên.
- URL do người dùng hoặc agent mở tự chuyển panel phải sang Trình duyệt và mở lại panel nếu đang đóng. Phiên không có thư mục làm việc vẫn dùng được Browser; chế độ Tệp hiển thị trạng thái chưa có dự án.
- Browser cũ từng được lưu như một pane động sẽ bị layout mirror loại khỏi vùng giữa trong lần chạy mới; tab URL và partition cookie `persist:hermes-preview` vẫn được giữ.
- Xác minh hoàn tất: 59/59 kiểm thử mục tiêu đạt; Desktop typecheck đạt; ESLint và Prettier các tệp thay đổi đạt; production build và Windows x64 unpacked 466 tệp đạt.
- Đã nâng cấp trên máy Windows thử nghiệm với điểm quay lui riêng. Bootstrap hoàn tất đúng commit `60e9b75d5`, dịch vụ nền trả `ok` cho Hermes 0.20.0 và mã băm ứng dụng cài đặt khớp bản đóng gói. Đại ca đã xác nhận trực quan vị trí biểu tượng và việc chuyển giữa **Tệp** với **Trình duyệt**.

## Cập nhật 2026-08-14 — khôi phục tab nhiều phiên và sửa vị trí Trình duyệt

- Thanh tab trong vùng làm việc luôn hiện mặc định kể cả khi chỉ có một phiên; nút `+` tiếp tục tạo phiên mới trong đúng vùng đang làm việc. Tùy chọn người dùng chủ động **Ẩn thanh tab** vẫn được tôn trọng.
- Bấm một phiên ở danh sách bên trái nay chuyển tới tab đã mở hoặc xếp phiên thành tab mới; chỉ dùng lại vùng chính khi đó thực sự là bản nháp trống.
- Nút **Trình duyệt** vẫn nằm ở thanh điều hướng bên trái nhưng nội dung web mở thành tab ở vùng giữa, cạnh các phiên làm việc; tab có tiêu đề theo ngôn ngữ giao diện và vẫn có thể kéo ra cạnh để xem song song.
- Nâng mã định danh Browser để tự di chuyển bản đã bị ghim nhầm vào vùng danh sách phiên ở các build thử trước; giữ nguyên địa chỉ cuối và partition cookie `persist:hermes-preview`.
- Cho phép popup do người dùng kích hoạt để các website có luồng đăng nhập OAuth hoặc mạng xã hội hoạt động trong phiên Browser dùng chung.
- Xác minh hiện tại: 54/54 kiểm thử mục tiêu đạt; Desktop typecheck đạt; ESLint và Prettier các tệp thay đổi đạt; production build và Windows x64 unpacked đạt.
- Đã nâng cấp bản `c7cee6a1d` trên máy Windows thử nghiệm với điểm quay lui riêng. Bootstrap tự đồng bộ đúng commit sau khi nhánh được đẩy lên GitHub; marker hoàn tất và `/api/health` trả `ok`, Hermes 0.20.0.
- Toàn bộ UI suite không hoàn tất trong giới hạn 180 giây và lặp lại các lỗi nền không thuộc lát cắt tại `prompt-overlays`, `messaging`, `gateway-settings` và `skills`; không ghi nhận bộ này là đạt. Bước quan sát giao diện tự động không khả dụng trong môi trường thử, nên cần xác nhận trực quan thủ công trên cửa sổ Hermes đang mở.

## Cập nhật 2026-08-14 — sửa lỗi Windows chặn Python khi cài mới

- Xác định nguyên nhân từ nhật ký Windows Code Integrity: Enterprise Application Control cho phép ứng dụng Hermes nhưng chặn `python.exe` không có chữ ký trong bản Python do `uv` quản lý.
- Windows bootstrap chuyển sang CPython 3.12.10 chính thức có chữ ký của Python Software Foundation; bộ cài kiểm tra cả chữ ký Authenticode và SHA-256 đã ghim trước khi chạy.
- Hỗ trợ Windows x64 và ARM64; `uv` nhận đường dẫn tuyệt đối tới interpreter đã xác minh để không tự chọn lại bản Python không có chữ ký.
- Lưu lựa chọn interpreter tin cậy qua các stage, tái sử dụng Python hợp lệ đã cài theo Hermes, registry hoặc PATH khi sửa chữa và cập nhật.
- Fresh-install smoke test dùng hồ sơ riêng trong LocalAppData trên Windows và tự đi qua lựa chọn cài cục bộ; không đọc hoặc sửa hồ sơ Hermes chính.
- Xác minh thật trên máy có Application Control: Python 3.12.10 và `venv\\Scripts\\python.exe` đều có chữ ký hợp lệ; stage phụ thuộc hoàn tất; CLI Hermes chạy; `/api/health` trả HTTP 200 với Hermes 0.20.0.
- 17/17 kiểm thử hồi quy installer đạt; 13/13 kiểm thử fresh-install/gate đạt; Desktop typecheck đạt; lint 0 lỗi. Toàn bộ Electron suite có 19 lỗi nền tảng cũ khi các ca POSIX chạy trên Windows, không liên quan lát cắt này và không được ghi nhận là đạt.

## Cập nhật 2026-08-14 — không gian Trình duyệt dùng chung

- Thêm **Trình duyệt** vào thanh điều hướng bên trái và mở trong cùng vùng với **Phiên** theo mặc định.
- Người dùng có thể chuyển tab, kéo Trình duyệt sang vùng riêng, xem song song và thay đổi kích thước bằng hệ thống pane hiện có.
- Bổ sung thanh địa chỉ, quay lại, tiến tới và tải lại; chỉ cho phép địa chỉ HTTP/HTTPS.
- Người dùng và agent thao tác trên cùng Electron webview và cùng partition đăng nhập `persist:hermes-preview`.
- `read_preview` trả thêm danh sách phần tử tương tác có mã tham chiếu; công cụ Desktop mới `interact_preview` hỗ trợ bấm, nhập, nhấn phím, cuộn và điều hướng.
- Không đọc giá trị mật khẩu và từ chối để agent nhập vào ô mật khẩu.
- Ẩn các nút của vùng **Thay đổi mã** khi chưa có thay đổi tương thích, giúp giao diện bớt gây nhầm lẫn.
- Xác minh: 39/39 kiểm thử UI mục tiêu đạt, 71/71 kiểm thử Python đạt, typecheck đạt, lint 0 lỗi, production build và Windows unpacked đạt.
- Smoke test dùng hồ sơ mới tách biệt đã lên màn hình thiết lập lần đầu. Nhật ký không có lỗi gateway hoặc bootstrap; phím tắt toàn cục đang trùng với ứng dụng khác nhưng không ảnh hưởng tính năng Trình duyệt.
- Tài liệu kỹ thuật và giới hạn hiện tại: `docs/shared-browser-pane.md`.

## Cập nhật 2026-08-13 — mở đầy đủ kết nối và tên model Claude

- Màn **Kết nối model** hiển thị trực tiếp toàn bộ luồng đăng nhập tài khoản mà backend cung cấp và toàn bộ nhà cung cấp có thể thiết lập bằng khóa API; không còn giấu danh mục khóa sau nút phụ.
- Danh mục khóa được sinh từ nguồn nhà cung cấp lõi, tự nhận thêm nhà cung cấp mới và loại đúng các luồng OAuth, tiến trình ngoài hoặc cấu hình thiếu biến xác thực.
- AWS Bedrock và Google Vertex AI tiếp tục được cấu hình tại **Cài đặt → Nhà cung cấp → API** vì cần nhiều trường cấu hình chuyên biệt.
- Claude Code dùng tên model cụ thể: Sonnet 5, Fable 5, Opus 5, Opus 4.8 và Haiku 4.5; quyền sử dụng thực tế vẫn do tài khoản Claude quyết định.
- Tài liệu giải thích rõ Gemini dùng Google AI Studio API key hoặc Vertex AI. Không tích hợp lại OAuth của Gemini CLI vì điều khoản của Google cấm phần mềm bên thứ ba dùng luồng đó.
- Xác minh: 7/7 kiểm thử onboarding đạt, 4/4 kiểm thử Claude Code provider đạt, Desktop typecheck đạt.
- Lần công bố `vi-v0.20.0-9` đầu tiên bị hủy ở giới hạn 15 phút sau khi tải 17/19 tệp. Workflow được sửa để tiếp tục bản nháp, bỏ qua tệp đã có và chỉ công bố khi tải đủ; giới hạn job tăng lên 30 phút.

## Cập nhật 2026-08-13 — viết lại tài liệu công khai

- Chuyển thông tin độc lập của dự án sang cách diễn đạt trung tính, tránh dùng cụm “không được bảo chứng” ở phần mở đầu.
- Ghi đúng trạng thái ký số: hồ sơ SignPath Foundation đã nộp và đang chờ xét duyệt; ký số là xác minh nhà phát hành, không phải giấy phép sử dụng của Microsoft hoặc Apple.
- Chuẩn hóa tên hiển thị thành **Hermes Vietnamese**, bỏ biểu tượng trang trí sau tên.
- Thêm link tải trực tiếp cho từng hệ điều hành và kiến trúc, cùng hướng dẫn kiểm tra phiên bản hệ điều hành, chip x64/ARM64, Apple Silicon/Intel trước khi tải.
- Viết lại README trang chủ theo hành trình ba bước: tải và cài, kết nối model, bắt đầu giao việc.
- Cập nhật toàn bộ liên kết tải sang `vi-v0.20.0-8` và bảng chọn đúng bộ cài cho sáu nền tảng.
- Viết lại hướng dẫn tiếng Việt chi tiết cho Windows, macOS, Linux; ChatGPT OAuth; Claude Pro/Max qua Claude Code; Gemini bằng khóa Google AI Studio; nhà cung cấp khác và model cục bộ.
- Bổ sung bảng phân biệt tài khoản/gói thuê bao/API, xử lý lỗi thường gặp, cảnh báo chưa ký số, cập nhật, sao lưu và gỡ cài đặt.
- Giữ rõ cam kết: **Thông tin đăng nhập và dữ liệu của mỗi người được lưu riêng trên máy của mình.**
- Cập nhật mẫu ghi chú phát hành theo luồng kết nối mới. Các liên kết nội bộ đã được kiểm tra, Prettier và `git diff --check` đều đạt.

## Cập nhật 2026-08-13 — ưu tiên kết nối tài khoản sẵn có

- Nhánh: `fix/provider-first-onboarding`, bắt đầu từ `origin/main` tại `5bfbbc2ad`.
- Màn **Kết nối model** hiện trực tiếp theo thứ tự: ChatGPT OAuth, Claude Pro/Max, Google Gemini bằng khóa API; Nous Portal và các dịch vụ khác nằm dưới **Nhà cung cấp khác**.
- Bỏ nhãn **Đề xuất** và cơ chế ẩn các nhà cung cấp phía sau Nous Portal.
- Gemini được ghi rõ là luồng Google AI Studio/API key trong toàn bộ locale; bấm vào sẽ mở form khóa API với Gemini được chọn sẵn.
- Xác minh: 32/32 kiểm thử onboarding+i18n đạt; 7/7 kiểm thử onboarding trực tiếp đạt; typecheck đạt; lint không có lỗi (chỉ còn cảnh báo có sẵn ở tệp khác).
- Bản Windows unpacked đã đóng gói thành công. Smoke test trực tiếp trên bản dev tách biệt xác nhận đúng thứ tự, đúng tiếng Việt và đúng hành vi bấm Gemini.
- Cửa sổ thử dùng `HERMES_HOME` và user-data riêng, không đọc hoặc sửa hồ sơ Hermes chính.

## Mục tiêu hiện tại

Hợp nhất thiết lập Desktop lần đầu thành ba bước trên Windows, macOS và Linux, đồng thời giữ nguyên giao diện và tính năng lõi Hermes sau khi thiết lập.

## Trạng thái đã xác minh

- Nhánh làm việc ban đầu: `fix/readable-window-controls`, HEAD `492220e5f`.
- Worktree sạch trước thay đổi.
- Baseline đạt 18/18 kiểm thử giao diện cài đặt/onboarding.
- Baseline đạt 20/20 kiểm thử bootstrap Electron.
- Typecheck Desktop đạt.
- `bootstrap-runner.ts` đã có bộ điều khiển `install.ps1` cho Windows và `install.sh` cho macOS/Linux.
- Giao diện vẫn còn nhánh cũ hướng dẫn người dùng macOS/Linux tự mở Terminal; nhánh này cần được loại bỏ khỏi luồng người dùng.

## Quyết định

- Ba bước chỉ là lớp thiết lập lần đầu; Terminal tích hợp và ứng dụng chính không đổi.
- Tái sử dụng luồng nhà cung cấp/model hiện có, không xây một luồng xác thực thứ hai.
- Model cục bộ dùng điểm cuối cục bộ hiện có trong lát cắt đầu; chưa nhúng model nặng vào bộ cài nền.
- Lựa chọn ngôn ngữ phải hoạt động trước khi backend sẵn sàng và được đồng bộ vào cấu hình khi bước 2 bắt đầu.

## Đã hoàn thành trong lát cắt này

- Thêm chỉ báo ba bước dùng chung cho cài đặt cục bộ, kết nối từ xa và onboarding nhà cung cấp/model.
- Cho phép đổi English/Tiếng Việt trước khi backend chạy; lựa chọn được lưu vào cấu hình ở bước 2.
- Loại bỏ hướng dẫn buộc người dùng macOS/Linux mở Terminal khỏi màn hình cài đặt.
- Giữ nguyên Terminal tích hợp và không gian làm việc Hermes sau onboarding.
- Củng cố Windows bootstrap bằng gói `uv` chính thức từ PyPI, kiểm tra SHA-256 trước khi giải nén; vẫn giữ đường cài Astral cũ làm dự phòng.
- Bổ sung gói macOS Intel x64 vào ma trận bên cạnh Apple Silicon, Windows x64/ARM64 và Linux x64/ARM64.
- Cập nhật README, ghi chú phát hành và tài liệu vận hành cộng đồng.

## Xác minh

- 34/34 kiểm thử giao diện trực tiếp cho thiết lập, onboarding và i18n đạt.
- 27/27 kiểm thử Electron bootstrap và ma trận đóng gói đạt.
- 8/8 kiểm thử nguồn cho `install.ps1` đạt.
- Typecheck Desktop và lint trên toàn bộ tệp thay đổi đạt; chỉ còn cảnh báo test có sẵn của dự án.
- Windows `uv` bootstrap đã chạy thật trong thư mục sạch: `uv 0.12.3`, mã băm được xác minh và tiến trình kết thúc thành công.
- Production build Desktop đạt sau khi chạy ngoài giới hạn sandbox.
- Bộ UI đầy đủ bị hết thời gian ở một số bài cũ không thuộc lát cắt này; các bài liên quan trực tiếp đều xanh và lỗi chậm đã được ghi nhận, không bị diễn giải thành kết quả đạt.

## Bước phát hành tiếp theo

Tạo checkpoint Git, đẩy nhánh và chạy workflow pre-release sáu nền tảng. Gói macOS/Linux cần được kiểm tra thêm trên máy thật trước khi bỏ nhãn thử nghiệm cộng đồng.
