# Hướng dẫn cài đặt và kết nối Hermes Vietnamese

Tài liệu này dành cho người muốn cài Hermes bằng giao diện, kết nối tài khoản AI của mình và bắt đầu giao việc mà không cần tự dựng môi trường lập trình.

> **Bản tải mặc định:** [vi-v0.32.1-17](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.32.1-17)
>
> **Trạng thái:** community pilot công khai **Latest**, chưa phải stable; exact Windows x64 đã qua toàn bộ vòng đời; bộ cài chưa ký số
>
> **Pilot đa nền tảng:** [vi-v0.32.1-18](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.32.1-18) — đủ Windows/macOS/Linux; Windows x64 đã nghiệm thu, năm target còn lại là `BUILD-ONLY-PILOT`

> **Hermes Vietnamese v32.1** (`vi-v0.32.1-17`) là **community pilot công khai đang được chọn làm Latest, chưa phải stable**. Bản Windows x64 khắc phục lỗi hiển thị/phạm vi Dự án khiến phiên cũ trông như biến mất; Ẩn/Xóa Dự án không xóa hay ẩn phiên. Exact artifact đã qua cài mới, cập nhật từ v32, mở lại, bảo toàn dữ liệu, repair, hai chế độ gỡ cài đặt và rollback.
>
> Tải [Windows x64 của bản Latest](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-17/Hermes-Vietnamese-Windows-x64-Setup.exe), hoặc tải đa nền tảng tại [vi-v0.32.1-18](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.32.1-18). Windows ARM64, macOS và Linux chưa có smoke trên máy người dùng, chưa ký số/công chứng và chưa phải stable.

## Vì sao có Hermes Vietnamese?

Hermes Agent có năng lực làm việc với tệp, dòng lệnh, trình duyệt, bộ nhớ, kỹ năng, lịch chạy và nhiều nhà cung cấp AI. Đường cài từ mã nguồn phù hợp với người kỹ thuật nhưng tạo ra nhiều bước khó với người dùng phổ thông Việt Nam. Hermes Vietnamese đóng gói phần lõi đó thành ứng dụng Desktop, thêm giao diện Việt/Anh, hướng dẫn cài đặt, kết nối model và cơ chế cập nhật riêng để người mới đi được từ tải về tới phiên đầu tiên.

Bản này phù hợp với người dùng cá nhân, người làm nội dung, đào tạo, nghiên cứu, vận hành và nhóm nhỏ muốn thử một AI agent chạy trên máy của mình. Người cần phần mềm đã ký số, hỗ trợ thương mại, bảo hành hoặc nghiệm thu đầy đủ trên mọi nền tảng nên chờ bản stable.

Dự án được phát triển từ [Hermes Agent](https://github.com/NousResearch/hermes-agent) của Nous Research theo [giấy phép MIT](LICENSE), do [Lê Đình Lực](https://github.com/LucDinhLe) phát triển và duy trì như một dự án cá nhân vì cộng đồng. Đây là bản phân phối độc lập, không phải bản phát hành chính thức của Nous Research hoặc các nhà cung cấp model.

### Những gì bản cộng đồng bổ sung

- Bộ cài có giao diện cho Windows, macOS và Linux; người dùng phổ thông không phải tự cài Git, Python, Node.js hoặc chạy lệnh để hoàn tất lần đầu.
- Giao diện tiếng Việt mặc định, chuyển nhanh VI/EN và giữ nguyên tên model cùng giá trị kỹ thuật.
- Quy trình ba bước từ chọn ngôn ngữ, chuẩn bị runtime, kết nối model tới phiên làm việc đầu tiên.
- Tab nhiều phiên, danh sách phiên, Terminal tích hợp, vùng Tệp và Trình duyệt dùng chung trong cùng cửa sổ Desktop.
- Runtime thiết yếu, source snapshot và dependency của đúng bản phát hành được đóng gói hoặc khóa để lần chạy đầu không phụ thuộc nhánh Git động.
- SHA-256, luồng repair, gỡ cài đặt giữ/xóa dữ liệu, hướng dẫn sao lưu và kênh cập nhật `vi-v*` dành riêng cho bản cộng đồng.
- Giữ hệ thống model, công cụ, bộ nhớ, kỹ năng, lịch chạy, AI agent phụ và Gateway của Hermes Agent gốc.

Hermes Vietnamese không tặng kèm model AI, tài khoản trả phí, API key hoặc hạn mức sử dụng.

## Trước khi cài

- Lần mở đầu tiên cần Internet để tải môi trường chạy của Hermes.
- Bạn cần tài khoản ChatGPT, Claude Pro/Max, khóa API Gemini hoặc một nhà cung cấp AI khác. Bộ cài không kèm tài khoản model trả phí.
- Hãy tải đúng kiến trúc của máy và đối chiếu `SHA256SUMS.txt` nếu hệ điều hành hiện cảnh báo.
- Giao diện mặc định dùng tiếng Việt và có nút chuyển nhanh **VI/EN**. Tên model, thương hiệu, giao thức và câu lệnh được giữ nguyên để tránh sai lệch kỹ thuật.

## Cài nhanh trong ba bước

### Bước 1. Tải về và cài đặt

1. Mở [trang phát hành vi-v0.32.1-18](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.32.1-18).
2. Tải đúng tệp theo bảng bên dưới.
3. Mở bộ cài và khởi động Hermes.
4. Chọn **Tiếng Việt** hoặc **English**.
5. Chọn cài Hermes trên máy và chờ ứng dụng hoàn tất chuẩn bị.

Nếu Edge báo tệp `isn't commonly downloaded` hoặc chỉ hiện nút **Delete**, làm theo [hướng dẫn Windows từng bước bằng hình ảnh](docs/cai-dat-windows-bang-anh.md). Cảnh báo này không tự biến mất khi chờ.

### Bước 2. Kết nối model

Màn kết nối hiện ngay ChatGPT, Claude Pro/Max và Gemini. Các kết nối tài khoản, khóa API và endpoint cục bộ khác xuất hiện trực tiếp trong danh sách cuộn bên dưới. Chọn một dịch vụ, đăng nhập hoặc nhập khóa của chính bạn. Bạn cũng có thể chọn **Tôi sẽ chọn nhà cung cấp sau**.

### Bước 3. Bắt đầu giao việc

Chọn model mặc định, vào không gian làm việc và nhập mục tiêu đầu tiên. Terminal tích hợp, công cụ, bộ nhớ và các tính năng lõi Hermes vẫn được giữ nguyên sau thiết lập.

## Chọn đúng bộ cài

| Hệ điều hành  | Kiến trúc     | Tải trực tiếp                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 10/11 | x64           | [Hermes-Vietnamese-Windows-x64-Setup.exe](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-Windows-x64-Setup.exe)                                                                                                                                                                                                                                 |
| Windows 10/11 | ARM64         | [Hermes-Vietnamese-Windows-arm64-Setup.exe](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-Windows-arm64-Setup.exe)                                                                                                                                                                                                                             |
| macOS 12+     | Apple Silicon | [DMG](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-macOS-Apple-Silicon.dmg) · [ZIP](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-macOS-Apple-Silicon.zip)                                                                                                                           |
| macOS 12+     | Intel x64     | [DMG](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-macOS-Intel.dmg) · [ZIP](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-macOS-Intel.zip)                                                                                                                                           |
| Linux         | x64           | [AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-Linux-x64.AppImage) · [DEB](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-Linux-x64.deb) · [RPM](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-Linux-x64.rpm)       |
| Linux         | ARM64         | [AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-Linux-arm64.AppImage) · [DEB](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-Linux-arm64.deb) · [RPM](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.32.1-18/Hermes-Vietnamese-Linux-arm64.rpm) |

> Windows x64 đã qua exact-artifact lifecycle. Năm target còn lại là `BUILD-ONLY-PILOT`: đã dựng và kiểm trên runner native nhưng chưa có smoke trên máy người dùng. Windows/macOS chưa ký số hoặc công chứng.

Windows 32-bit và Linux ARM 32-bit không được đóng gói.

## Kiểm tra máy có phù hợp không

### Máy Windows

1. Nhấn `Windows + I` để mở **Cài đặt**.
2. Chọn **Hệ thống → Giới thiệu**.
3. Xem hai dòng sau:
   - **Phiên bản Windows:** cần Windows 10 hoặc Windows 11.
   - **Loại hệ thống:** `x64-based processor` thì tải x64; `ARM-based processor` thì tải ARM64.

Nếu Loại hệ thống ghi hệ điều hành 32-bit hoặc bộ xử lý x86, máy chưa phù hợp với bộ cài hiện tại.

### Máy Mac

1. Mở menu ** → About This Mac/Giới thiệu về máy Mac**.
2. Xem phiên bản macOS và loại chip:
   - Cần **macOS 12 Monterey trở lên**.
   - Dòng **Chip** bắt đầu bằng `Apple M` thì tải Apple Silicon.
   - Dòng **Processor** ghi `Intel` thì tải bản Intel.

### Máy Linux

1. Mở **Settings → About/Giới thiệu** và tìm mục **Architecture/OS type**.
2. Đối chiếu:
   - `x86_64` hoặc `amd64` → tải x64.
   - `aarch64` hoặc `arm64` → tải ARM64.
3. Nếu giao diện không hiện kiến trúc, mở Terminal và chạy `uname -m`.

Linux 32-bit như `i386`, `i686`, `armv7` chưa được hỗ trợ. Bản cộng đồng ưu tiên Ubuntu 24.04 trở lên; bản phân phối khác có thể cần cài thêm thư viện hệ thống.

### Yêu cầu hệ thống

- **Windows:** Windows 10 hoặc 11 bản 64-bit.
- **macOS:** macOS 12 trở lên, chip Apple M-series hoặc Intel x64.
- **Linux:** ưu tiên Ubuntu 24.04 trở lên. Một số bản phân phối khác có thể cần `git`, `curl`, `xz-utils`, `glibc`, `systemd` và bộ công cụ biên dịch C/C++.
- **Khuyến nghị thực tế:** RAM 8 GB, CPU 4 luồng và còn trống ít nhất 4 GB cho môi trường chạy cùng dữ liệu cơ bản.
- **Model cục bộ:** cần cấu hình riêng tùy model và thường yêu cầu nhiều RAM hoặc GPU hơn.

Hermes gốc chưa công bố một cấu hình tối thiểu bắt buộc cho mọi cách sử dụng. Các thông số trên là mức khuyến nghị vận hành của bản cộng đồng.

## Cài đặt chi tiết

### Windows

1. Vào **Cài đặt → Hệ thống → Giới thiệu → Loại hệ thống** để xem máy là x64 hay ARM64.
2. Tải bộ cài x64 từ [trang phát hành v32.1](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.32.1-17).
3. Mở bộ cài và hoàn tất các bước trên màn hình.
4. Khởi động Hermes, chọn ngôn ngữ rồi chọn cài trên máy.
5. Giữ kết nối Internet trong lần chuẩn bị đầu tiên. Tốc độ phụ thuộc mạng và máy; quá trình có thể lâu hơn vài phút vì phải tải môi trường chạy.

Nếu Windows chặn bộ cài, đọc mục [Trạng thái ký số và cảnh báo khi cài](#trạng-thái-ký-số-và-cảnh-báo-khi-cài) trước khi tiếp tục.

### macOS

1. Chọn `Apple-Silicon.dmg` cho chip M-series hoặc `Intel.dmg` cho Mac Intel.
2. Mở DMG và kéo Hermes vào thư mục **Applications**.
3. Mở Hermes từ Applications.
4. Chọn ngôn ngữ, chọn cài trên máy và chờ chuẩn bị môi trường chạy.

Nếu Gatekeeper cảnh báo, hãy kiểm tra SHA-256 rồi nhấp phải vào Hermes → **Open**. Bạn cũng có thể vào **System Settings → Privacy & Security → Open Anyway**. Không chạy lệnh xóa thuộc tính bảo mật cho toàn bộ ứng dụng.

### Linux

- **Ubuntu/Debian:** mở tệp `.deb` bằng trình Cài đặt phần mềm.
- **Fedora/RHEL:** mở tệp `.rpm` bằng trình quản lý phần mềm.
- **AppImage:** vào Thuộc tính của tệp, cho phép chạy như chương trình rồi mở trực tiếp.

Nếu AppImage không mở, kiểm tra FUSE theo hướng dẫn của bản phân phối hoặc dùng gói `.deb`/`.rpm`. Linux không có một cơ chế cập nhật Electron chung cho mọi bản phân phối, vì vậy hãy tải bản mới hoặc cập nhật qua trình quản lý gói tương ứng.

## Kết nối ChatGPT, Claude và Gemini

### ChatGPT qua OpenAI OAuth

Phù hợp khi bạn muốn dùng quyền Codex trong tài khoản ChatGPT của mình.

1. Tại bước **Kết nối model**, chọn **OpenAI OAuth (ChatGPT)**.
2. Hermes mở trang xác minh của OpenAI trong trình duyệt.
3. Đăng nhập đúng tài khoản ChatGPT và xác nhận mã thiết bị khi được yêu cầu.
4. Quay lại Hermes. Ứng dụng sẽ tự kiểm tra kết nối và hiển thị model được tài khoản hỗ trợ.

Nếu OpenAI báo chưa cho phép xác thực mã thiết bị, mở phần **Cài đặt bảo mật** của ChatGPT, bật tính năng xác thực mã thiết bị cho Codex rồi thử lại. Quyền truy cập và giới hạn sử dụng phụ thuộc gói ChatGPT cùng chính sách hiện hành của OpenAI.

### Claude Pro hoặc Max qua Claude Code

Phù hợp khi bạn có gói Claude Pro/Max và muốn dùng cầu nối chính thức của Claude Code cho hội thoại trực tiếp.

1. Chọn **Claude Pro / Max (qua Claude Code)**.
2. Hermes mở luồng đăng nhập của Claude Code.
3. Đăng nhập tài khoản Claude chính chủ và hoàn tất xác nhận.
4. Quay lại Hermes, mở nhóm Claude trong danh sách model và chọn một phiên bản cụ thể mà tài khoản hỗ trợ: `claude-sonnet-5`, `claude-fable-5`, `claude-opus-5`, `claude-opus-4-8` hoặc `claude-haiku-4-5`.

Hermes hiển thị tên đầy đủ để bạn biết chính xác mình đang chọn model nào. Danh sách model có thể rộng hơn quyền thực tế của từng gói; Claude Code sẽ từ chối model mà tài khoản chưa được cấp thay vì âm thầm chuyển sang Anthropic API.

Cầu nối không sao chép hoặc lưu mã OAuth Claude vào kho xác thực riêng của Hermes. Cơ chế bảo vệ yêu cầu Extra Usage ở trạng thái tắt hoặc bị từ chối; nếu không xác minh được, kết nối sẽ dừng để tránh vô tình chuyển sang mức dùng tính thêm.

Phạm vi hiện tại tập trung vào hội thoại trực tiếp trong Desktop. Công cụ, agent nền và lịch chạy của Claude Code chưa tự động trở thành công cụ Hermes. Người muốn dùng Anthropic API theo mức sử dụng có thể chọn **Anthropic API Key**; đây là tài khoản thanh toán riêng, không dùng chung quyền lợi Claude Pro/Max.

### Google Gemini bằng khóa API

Phù hợp khi bạn có khóa Google AI Studio. Gói Gemini trên web không tự động cấp quyền API.

1. Mở [Google AI Studio](https://aistudio.google.com/apikey) và tạo khóa API bằng tài khoản Google của bạn.
2. Trong Hermes, chọn **Google Gemini (khóa API)**.
3. Dán khóa vào ô được yêu cầu rồi chọn **Kết nối**.
4. Chọn model Gemini từ danh sách sau khi Hermes xác nhận khóa hợp lệ.

Khóa Gemini chịu hạn mức miễn phí hoặc phương thức thanh toán của dự án Google AI Studio tương ứng.

Hermes chưa cung cấp nút đăng nhập tài khoản Google theo kiểu ChatGPT hoặc Claude. Gemini CLI chính thức có luồng đăng nhập Google riêng, nhưng [điều khoản Gemini CLI](https://github.com/google-gemini/gemini-cli/blob/main/docs/resources/tos-privacy.md) cấm phần mềm bên thứ ba truy cập dịch vụ nền của Gemini CLI bằng OAuth đó. Dự án giữ hai đường tích hợp hợp lệ:

- **Google AI Studio** bằng API key, phù hợp cho đa số người dùng cá nhân.
- **Google Vertex AI** bằng tài khoản dịch vụ hoặc Application Default Credentials của dự án Google Cloud, phù hợp cho tổ chức và hạ tầng GCP.

### Nhà cung cấp khác và model cục bộ

Màn kết nối lấy danh mục trực tiếp từ lõi Hermes. Tùy phiên bản, các lựa chọn gồm:

- **Đăng nhập tài khoản:** Nous Portal, OpenAI Codex/ChatGPT, Claude Pro/Max qua Claude Code, Qwen Code, MiniMax, xAI Grok và GitHub Copilot ACP.
- **Khóa API:** Fireworks, OpenRouter, OpenAI API, Anthropic API, Google AI Studio, xAI, Qwen/DashScope, DeepSeek, GLM/Z.AI, Kimi, MiniMax, NVIDIA NIM, Hugging Face, NovitaAI, StepFun, Arcee, Vercel AI Gateway, DeepInfra, Upstage và các nhà cung cấp tương thích khác.
- **Model cục bộ hoặc tự lưu trữ:** LM Studio, Ollama và endpoint tương thích OpenAI.
- **Hạ tầng nâng cao:** AWS Bedrock và Google Vertex AI. Hai lựa chọn này cần hồ sơ AWS hoặc tệp tài khoản dịch vụ Google nên được cấu hình tại **Cài đặt → Nhà cung cấp → API** sau khi vào ứng dụng.

Mỗi dịch vụ có tài khoản, giới hạn và cách tính phí riêng.

Nếu đã chạy một máy chủ model tương thích OpenAI trên máy, chọn **Local / custom endpoint**, nhập địa chỉ điểm cuối và khóa nếu máy chủ yêu cầu. Bộ cài hiện không nhúng sẵn một model nặng để chạy ngoại tuyến.

## Đổi hoặc thêm nhà cung cấp sau khi cài

1. Mở **Cài đặt** trong Hermes.
2. Vào mục **Model/Nhà cung cấp**.
3. Chọn nhà cung cấp muốn thêm, đăng nhập hoặc nhập khóa.
4. Mở danh sách model ở thanh trạng thái để chọn model mặc định.

Bạn có thể giữ nhiều kết nối và chuyển model khi làm việc. Tên model cùng khả năng thực tế phụ thuộc dữ liệu mà nhà cung cấp trả về tại thời điểm sử dụng.

## Xử lý lỗi kết nối thường gặp

### ChatGPT cứ quay lại màn xác minh

- Đảm bảo đang đăng nhập đúng tài khoản ChatGPT.
- Bật xác thực mã thiết bị trong cài đặt bảo mật nếu OpenAI yêu cầu.
- Đóng trang xác minh cũ, chọn lại **OpenAI OAuth (ChatGPT)** để lấy mã mới.

### Claude đăng nhập xong nhưng không có model

- Kiểm tra Claude Code đã xác nhận đăng nhập thành công.
- Đảm bảo tài khoản có gói Pro hoặc Max đang hoạt động.
- Tắt Extra Usage nếu cầu nối báo không thể xác minh mức dùng.
- Mở lại Cài đặt model hoặc khởi động lại Hermes để làm mới danh sách.

### Gemini báo khóa không hợp lệ

- Tạo khóa tại Google AI Studio, không dùng mật khẩu Google hay mã đăng nhập Gemini web.
- Kiểm tra khóa thuộc đúng dự án và API tương ứng đang khả dụng.
- Xóa khoảng trắng ở đầu hoặc cuối khóa trước khi kết nối.

### Không thấy model sau khi kết nối

- Mở danh sách model và mở rộng nhóm nhà cung cấp.
- Kiểm tra mạng và hạn mức tài khoản.
- Vào Cài đặt nhà cung cấp, ngắt rồi kết nối lại nếu thông tin xác thực đã hết hạn.

## Trạng thái ký số và cảnh báo khi cài

Dự án đã nộp hồ sơ tham gia chương trình ký mã miễn phí dành cho phần mềm nguồn mở của SignPath Foundation và đang chờ xét duyệt. Trong thời gian chờ, các bản phát hành hiện tại chưa có chữ ký số xác minh nhà phát hành. Windows SmartScreen hoặc macOS Gatekeeper vì thế có thể hiển thị cảnh báo.

Trạng thái này không có nghĩa Microsoft hoặc Apple đã từ chối dự án hay phần mềm không được phép cài. Ký số giúp hệ điều hành xác minh nguồn phát hành và tính toàn vẹn của tệp; nó không phải giấy phép sử dụng phần mềm do Microsoft hoặc Apple cấp.

Trước khi tiếp tục:

1. Chỉ tải tệp từ [GitHub Releases của kho này](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases).
2. Tải `SHA256SUMS.txt` trong cùng bản phát hành.
3. Đối chiếu mã SHA-256 của tệp đã tải.
4. Chỉ chọn **Thông tin thêm → Vẫn chạy** trên Windows hoặc **Open Anyway** trên macOS khi mã khớp.

Trên Microsoft Edge, người dùng có thể gặp thêm hai màn hình trước SmartScreen. Xem đúng vị trí **See more**, mũi tên cạnh **Delete** và **Keep anyway** trong [hướng dẫn cài Windows bằng hình ảnh](docs/cai-dat-windows-bang-anh.md).

| 1. Bấm See more                                                                                                 | 2. Chọn Keep trong menu tải xuống                                                                        |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| ![Edge báo Hermes chưa được tải xuống phổ biến](docs/assets/windows-install/edge-warning-see-more-v25.jpg)      | ![Menu tải xuống của Edge có lựa chọn Keep](docs/assets/windows-install/edge-download-menu-keep-v25.jpg) |
| **3. Kiểm tra tên tệp và nguồn tải**                                                                            | **4. Mở mũi tên và chọn Keep anyway**                                                                    |
| ![Edge hiện Publisher Unknown vì bộ cài chưa ký số](docs/assets/windows-install/edge-publisher-unknown-v25.jpg) | ![Edge hiện lựa chọn Keep anyway](docs/assets/windows-install/edge-keep-anyway-v25.jpg)                  |

Các phiên bản Edge có thể bỏ qua một trong các màn hình trên. Dòng `Publisher: Unknown` phản ánh trạng thái chưa ký số. Nếu tệp bị tải lặp và có thêm `(1)` hoặc `(2)` trong tên, hãy xác nhận bằng SHA-256 thay vì chỉ nhìn tên tệp.

Cảnh báo trong thời gian chờ ký số không tự chứng minh tệp an toàn hoặc nguy hiểm. Mã băm và nguồn tải giúp bạn xác minh tệp có đúng với bản GitHub đã công bố hay không. Nếu Microsoft Defender nêu tên một mối đe dọa cụ thể, hãy dừng cài đặt và gửi báo cáo; không tắt Defender, SmartScreen hoặc chính sách bảo mật của toàn máy. Trạng thái hồ sơ được cập nhật tại [Code signing policy](CODE_SIGNING_POLICY.md).

## Riêng tư và dữ liệu

**Thông tin đăng nhập và dữ liệu của mỗi người được lưu riêng trên máy của mình.** Bộ cài không chứa tài khoản, khóa API, mã OAuth hoặc dữ liệu trò chuyện của người đóng gói. Dự án không vận hành máy chủ tập trung để thu thập thông tin đăng nhập.

Khi bạn chủ động dùng một nhà cung cấp AI, công cụ web, trình duyệt, nền tảng nhắn tin hoặc dịch vụ mạng, dữ liệu cần thiết sẽ được dịch vụ đó xử lý theo điều khoản và chính sách quyền riêng tư riêng. Không đăng khóa API, mã OAuth, nội dung riêng tư hoặc log chứa bí mật vào issue công khai.

## Cập nhật, sao lưu và gỡ cài đặt

### Cập nhật

Bản cộng đồng nhận mã và bản phát hành từ `LucDinhLe/hermes-agent-vietnamese`. Các thay đổi từ Hermes Agent gốc được rà soát và kiểm thử trước khi đồng bộ để hạn chế làm mất phần Việt hóa.

Tài khoản, phiên làm việc, cấu hình và bộ nhớ nằm trong thư mục dữ liệu người dùng, tách khỏi bộ cài. Cập nhật không chủ động xóa các dữ liệu này.

### Sao lưu

Mở **Trung tâm chỉ huy → Bảo trì → Tạo bản sao lưu**. Khi hoàn tất, bấm **Mở vị trí bản sao lưu** để lấy tệp `.zip`. Để chuyển máy hoặc cài lại, chọn **Khôi phục từ bản sao lưu**, xác nhận và khởi động lại Hermes.

Xem [hướng dẫn sao lưu và khôi phục từng bước](docs/sao-luu-khoi-phuc.md). Không chia sẻ bản sao lưu công khai vì tệp có thể chứa lịch sử, cấu hình hoặc thông tin xác thực.

### Gỡ cài đặt

Trên Windows, mở **Settings → Apps → Installed apps** rồi gỡ Hermes. Trên macOS, xóa ứng dụng khỏi Applications. Trên Linux, gỡ bằng trình quản lý gói hoặc xóa AppImage.

Gỡ ứng dụng không tự động xóa thư mục dữ liệu nhằm tránh mất lịch sử ngoài ý muốn. Chỉ xóa thư mục dữ liệu khi bạn chắc chắn không cần tài khoản, phiên và bộ nhớ cũ.

## Phạm vi dự án và miễn trừ trách nhiệm

Đây là bản cộng đồng độc lập được phát triển từ [Hermes Agent](https://github.com/NousResearch/hermes-agent) theo giấy phép MIT. Giấy phép, thuật toán, kiến trúc và tính năng lõi vẫn theo dự án gốc. Bản cộng đồng bổ sung lớp Việt hóa, tài liệu, đóng gói đa nền tảng và điều chỉnh tương thích cho người dùng Việt.

Hermes được cung cấp theo nguyên trạng, không kèm cam kết bảo hành. Kết quả AI có thể sai; hệ thống, model và dịch vụ bên thứ ba có thể thay đổi hoặc gián đoạn. Người dùng chịu trách nhiệm kiểm tra kết quả, quyền đã cấp và hậu quả của các thao tác đã chấp thuận.

Xem [LICENSE](LICENSE), [miễn trừ trách nhiệm bằng tiếng Việt](DISCLAIMER.md) và [chính sách bảo mật](SECURITY.md).

## Cần hỗ trợ?

- [Báo lỗi hoặc đề xuất bản dịch](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues)
- [Xem các bản phát hành](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases)
- [Đọc tài liệu kỹ thuật Hermes gốc](https://hermes-agent.nousresearch.com/docs/)

Khi báo lỗi, hãy cho biết hệ điều hành, kiến trúc máy, bước bị lỗi và ảnh chụp thông báo. Hãy che địa chỉ email, khóa API, mã OAuth và dữ liệu cá nhân trước khi đăng.
