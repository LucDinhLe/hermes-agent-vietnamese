# Hướng dẫn cài đặt và kết nối Hermes Vietnamese

<!-- current-release:start -->
**Latest hiện tại là [2026.9.4](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.4), dành cho Windows x64, macOS Apple Silicon và Linux x64.** Bản community pilot chưa phải stable; Windows chưa ký số, macOS ký ad-hoc, Linux không có cơ chế ký. Ứng dụng báo khi có bản mới kèm SHA-256, không tự tải hay tự cài. Trên macOS, lần mở đầu vào **System Settings → Privacy & Security** bấm **Open Anyway**; nếu báo "damaged", chạy `xattr -cr /Applications/HermesVietnamese.app`. Trên Linux, cấp quyền chạy cho AppImage (`chmod +x`) hoặc cài gói deb.

- Windows x64: [Hermes-2026.9.4-win-x64.exe](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/Hermes-2026.9.4-win-x64.exe), **345852734 byte**, SHA-256 `3cd30aaad47167c439bb6637af3c531ceffc4e2f74d7a808e3a9c105e3938990`.
- Cùng bộ cài Windows với tên tương thích cũ: [Hermes-Vietnamese-Windows-x64-Setup.exe](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/Hermes-Vietnamese-Windows-x64-Setup.exe). Chỉ chạy một bộ cài.
- macOS Apple Silicon (M1 trở lên): [Hermes-2026.9.4-mac-arm64.dmg](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/Hermes-2026.9.4-mac-arm64.dmg), **385594943 byte**, SHA-256 `8ebc605c66c9cc8eeed6fc314b71cbdabeedea6c62c297035296729571284d8c`.
- Linux x64 AppImage: [Hermes-2026.9.4-linux-x86_64.AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/Hermes-2026.9.4-linux-x86_64.AppImage), **397516248 byte**, SHA-256 `26cfec58e6776f49d5e65cbdd62908119349f7406a4fc549bc417d839134249d`.
- Linux x64 gói deb (Ubuntu/Debian): [Hermes-2026.9.4-linux-amd64.deb](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/Hermes-2026.9.4-linux-amd64.deb), **320996796 byte**, SHA-256 `fc513d2a836ee5c6ca9762a627bb14b01d5a2cb4e09b234fd81439b61018e351`.
- [SHA256SUMS.txt](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/SHA256SUMS.txt) gom mã kiểm tra của mọi tệp.
<!-- current-release:end -->

## Bảy điều nên biết trước khi cài

1. **Bộ cài chưa ký số.** Windows và Edge sẽ cảnh báo nhà phát hành chưa xác định. Chỉ đi tiếp khi bạn tải từ trang phát hành chính thức của dự án và mã SHA-256 khớp với mã công bố ở đầu trang này.
2. **Windows, macOS Apple Silicon và Linux x64 đều có bộ cài.** macOS chỉ hỗ trợ máy dùng chip Apple Silicon (M1 trở lên), Mac dùng chip Intel chưa được hỗ trợ. Windows ARM64 và Linux ARM64 vẫn chưa nằm trong phạm vi phát hành này.
3. **Ứng dụng cài song song với bản Hermes cũ.** Mã sản phẩm và thư mục dữ liệu đều riêng nên bản cũ giữ nguyên, mở lại được bất cứ lúc nào. Lối tắt mới mang tên "Hermes Vietnamese" và có thể thay tên lối tắt cũ trên màn hình.
4. **Lần mở đầu tiên, ứng dụng hỏi có nhập dữ liệu từ bản cũ không.** Chọn nhập thì cấu hình, phiên làm việc, trí nhớ và kỹ năng được sao chép sang thư mục mới. Bản cũ giữ nguyên vì đây là sao chép chứ không phải di chuyển.
5. **Ứng dụng không kèm tài khoản AI.** Bạn kết nối bằng tài khoản hoặc khóa API của chính mình, và mỗi nhà cung cấp có điều kiện, hạn mức, chi phí riêng.
6. **Hermes làm việc trực tiếp trên máy bạn.** Nó đọc và sửa tệp, chạy công cụ, thao tác trong phạm vi quyền bạn cấp. Hãy bắt đầu bằng tệp thử hoặc bản sao, và kiểm tra kết quả trước những việc quan trọng.
7. **Đây là bản dùng thử cộng đồng, chưa có bảo hành thương mại.** Dữ liệu quan trọng cần được [sao lưu](docs/sao-luu-khoi-phuc.md) trước khi giao việc lớn.

## Vì sao có bản này

Bản gốc của Nous Research đòi người dùng tự dựng môi trường Python và chạy một chuỗi lệnh trước khi mở được ứng dụng. Bản Việt hóa gói sẵn phần đó vào một bộ cài, dịch toàn bộ giao diện cùng tài liệu sang tiếng Việt, và giữ lõi nguyên vẹn từng byte so với bản gốc để bạn vẫn nhận đúng hành vi cùng các bản sửa lỗi của Nous Research. Chi tiết khác biệt nằm ở [trang giới thiệu](README.md#bản-này-khác-bản-gốc-chỗ-nào).

## Kiểm tra máy có phù hợp không

**Windows.** Mở **Cài đặt → Hệ thống → Giới thiệu**, xem dòng **Loại hệ thống**. Bản Windows dùng cho máy x64; máy ARM64 và hệ điều hành 32-bit không nằm trong phạm vi đã nghiệm thu.

**macOS.** Mở menu Apple, chọn **About This Mac (Giới thiệu về Mac này)**, xem dòng **Chip**. Máy hiện dòng **Apple M…** (M1, M2, M3, M4 trở lên) dùng được bản này. Máy hiện dòng **Intel** chưa được hỗ trợ vì bộ cài macOS chỉ dựng riêng cho Apple Silicon.

**Linux.** Mở terminal và chạy `uname -m`. Kết quả `x86_64` dùng được bản Linux x64. Bản AppImage chạy được trên hầu hết bản phân phối, gói `.deb` chỉ dành riêng cho Ubuntu/Debian.

Các lượt kiểm thử tự động chạy trên Windows x64, macOS Apple Silicon và Linux x64 của GitHub; không có cam kết đã thử mọi bản phân phối Linux, mọi phiên bản macOS hoặc mọi chính sách máy cơ quan. Windows ARM64 và Linux ARM64 chưa nằm trong phạm vi phát hành. Chỉ dùng bộ cài phù hợp với máy và không vượt cơ chế bảo vệ của hệ điều hành để thử một gói không được hỗ trợ.

## Cài nhanh trong ba bước

### 1. Tải và cài ứng dụng

1. Tải bộ cài đúng nền tảng ở đầu trang và đối chiếu mã SHA-256.
2. Nếu đang dùng Hermes, thực hiện phần [cập nhật và sao lưu](#cập-nhật-sao-lưu-và-gỡ-cài-đặt) trước.

#### Windows

Mở bộ cài `.exe` và làm theo hướng dẫn. Cài mới có thể chọn phạm vi một người dùng hoặc toàn máy; cài toàn máy có thể yêu cầu quyền quản trị Windows. Mở Hermes, chọn ngôn ngữ nếu được hỏi và chờ chuẩn bị lõi đóng gói sẵn. Nếu Windows/Edge cảnh báo, đọc [hướng dẫn bằng hình ảnh](docs/cai-dat-windows-bang-anh.md). Không tắt Defender, SmartScreen hoặc chính sách bảo mật toàn máy.

#### macOS

Mở tệp `.dmg` rồi kéo **HermesVietnamese.app** (hiện tên "Hermes Vietnamese" trong Finder) vào thư mục **Applications**. Lần mở đầu tiên, macOS chặn ứng dụng và báo "Apple could not verify...". Bấm **Done** hoặc **Cancel**, mở **System Settings → Privacy & Security**, cuộn tới mục Security, bấm **Open Anyway** cạnh Hermes Vietnamese, xác nhận rồi mở lại ứng dụng.

Nếu macOS báo ứng dụng "is damaged and can't be opened" (thường gặp với tệp Safari tải về, do cờ quarantine gây xung đột), mở Terminal và chạy `xattr -cr /Applications/HermesVietnamese.app`, rồi mở lại ứng dụng. Lệnh này chỉ gỡ cờ "tải từ Internet" trên riêng tệp này.

Lý do macOS chặn ứng dụng là bộ cài được ký ad-hoc, không dùng chứng thư Apple Developer, nên Gatekeeper không xác minh được nhà phát hành. Đây là thao tác một lần cho mỗi máy. Không tắt Gatekeeper toàn hệ thống để tránh cảnh báo này. Xem thêm [chính sách ký mã](CODE_SIGNING_POLICY.md).

#### Linux

**AppImage.** Tải tệp, cấp quyền chạy bằng `chmod +x Hermes-*.AppImage` (hoặc chuột phải → Properties → cho phép chạy như chương trình), rồi bấm đúp hoặc chạy từ terminal. Một số bản phân phối cần cài FUSE 2 trước; trên Ubuntu 22.04 trở lên chạy `sudo apt install libfuse2`.

**Gói deb, dành cho Ubuntu/Debian.** Chạy `sudo apt install ./Hermes-<phiên bản>-linux-amd64.deb`, sau đó mở **Hermes Vietnamese** từ menu ứng dụng. Các bản phân phối khác dùng AppImage.

Linux không có cơ chế ký mã. Xác minh tệp bằng SHA-256 thay vì dựa vào chữ ký.

#### Xác minh mã SHA-256

Trên Windows, mở PowerShell trong thư mục tải xuống và chạy `Get-FileHash <tên tệp> -Algorithm SHA256`. Trên macOS, mở Terminal và chạy `shasum -a 256 <tên tệp>`. Trên Linux, chạy `sha256sum <tên tệp>`. So kết quả với `SHA256SUMS.txt` của cùng bản phát hành ở đầu trang.

Bản này dùng mã sản phẩm và thư mục dữ liệu riêng với các bản Hermes cũ, nên cài song song thay vì ghi đè. Trên Windows, lối tắt "Hermes Vietnamese" có thể thay tên lối tắt cũ, nhưng bản cũ vẫn còn nguyên trong danh sách Ứng dụng và vẫn mở được. Trên macOS và Linux, thư mục dữ liệu là `~/.hermes-vietnamese`; bản Hermes cũ dùng `~/.hermes`. Lần mở đầu tiên, nếu máy có dữ liệu Hermes cũ, ứng dụng hỏi "Nhập dữ liệu từ bản Hermes cũ?" rồi sao chép (không xóa hay di chuyển) cấu hình, phiên làm việc, trí nhớ, kỹ năng và các thiết lập khác sang thư mục mới. Bản cũ giữ nguyên nên luôn dùng được để quay lại nếu cần.

Python 3.12.10 và thư viện bắt buộc đã ở trong bộ cài, trên cả ba nền tảng. Bạn không cần tự cài môi trường lập trình hoặc tải `install.ps1` để khởi động lõi. Internet vẫn cần cho tải bộ cài, xác thực, dịch vụ AI và một số công cụ tùy chọn.

### 2. Kết nối model

Chọn nhà cung cấp tại màn kết nối hoặc **Cài đặt → Model/Nhà cung cấp**. Dùng tài khoản hoặc khóa của chính bạn. Nếu chưa muốn kết nối, chọn bỏ qua khi giao diện cho phép và cấu hình sau.

### 3. Thử một phiên mới

Chọn model trong ô nhập, bấm dấu `+` ở thanh tab, gửi một yêu cầu đơn giản. Khi đã nhận trả lời, đóng/mở lại và kiểm tra phiên còn trong danh sách. Không thử lần đầu bằng thao tác xóa tệp, giao dịch hoặc công việc quan trọng.

## Kết nối ChatGPT, Claude và Gemini

### ChatGPT qua OpenAI OAuth

Chọn **OpenAI OAuth (ChatGPT)**, hoàn tất xác thực trong trình duyệt rồi quay lại Hermes. Tài khoản phải có quyền sử dụng qua kết nối tương ứng. Làm theo hướng dẫn bảo mật của OpenAI nếu xác thực bị từ chối.

Đăng nhập thành công chỉ xác nhận tài khoản, không bảo đảm mọi model đều khả dụng. Quyền và mã model qua Codex, OpenAI API hay một gateway khác có thể khác nhau. Không tự đổi dấu chấm/gạch nối trong mã model để đoán tên.

### Claude Pro/Max qua Claude Code

Chọn **Claude Pro / Max (qua Claude Code)** và làm theo luồng xác thực. Chọn model mà tài khoản và cầu nối thực tế hỗ trợ. Danh mục có thể thay đổi; bản phát hành không mở khóa model ngoài quyền được cấp.

Cầu nối này khác Anthropic API key. Không coi gói Claude web là hạn mức API. Nếu giao diện báo điều kiện Claude Code hoặc Extra Usage chưa được xác minh, xử lý điều kiện đó trước; không nhập khóa API để vượt lỗi khi chưa muốn dùng API tính phí riêng.

### Google Gemini bằng khóa API

1. Tạo khóa của chính bạn tại [Google AI Studio](https://aistudio.google.com/apikey).
2. Chọn **Google Gemini (khóa API)** trong Hermes.
3. Nhập khóa, kết nối và chọn model được dự án API cho phép.

Hermes hỗ trợ đường Gemini API; việc người khác dùng được Gemini không chứng minh một tài khoản/model khác sẽ dùng được. Gói Gemini trên web và quyền API cần được kiểm tra riêng. Google Vertex AI là lựa chọn nâng cao cho người đã cấu hình dự án Google Cloud. Bản này không hướng dẫn nhập lại mã OAuth Gemini CLI vào Hermes.

### Nhà cung cấp khác và model cục bộ

Dùng danh mục nhà cung cấp của đúng bản đã cài. Mỗi kết nối có yêu cầu tài khoản, hạn mức và điều khoản riêng. Với model cục bộ hoặc điểm cuối tương thích, bạn phải chuẩn bị máy chủ model; bộ cài không chứa sẵn model AI.

## Xử lý lỗi kết nối thường gặp

### HTTP 404 model, bao gồm Luna

- Kiểm tra model ở **ô nhập của phiên** và nhà cung cấp/gateway đang chọn.
- Làm mới danh sách model hoặc chọn model được kết nối đó xác nhận hỗ trợ. `404` có thể do sai mã, định tuyến hoặc thiếu quyền; chỉ ảnh lỗi chưa đủ để chọn một nguyên nhân chắc chắn.
- Không đăng khóa API, mã OAuth hay toàn bộ cấu hình để nhờ hỗ trợ.

### Đọc ảnh đính kèm không ra đúng nội dung

Kiểm tra ảnh đã đính kèm thành công và thử trong một phiên mới. Kết quả đọc ảnh phụ thuộc model và kết nối. Nếu lỗi lặp lại, gửi ảnh đã che dữ liệu riêng cùng bước tái hiện.

### Bấm dấu cộng không tạo được phiên

Kiểm tra phiên bản đang chạy, đóng/mở lại đúng ứng dụng sau nâng cấp và chờ gateway kết nối. Nếu lỗi còn xảy ra, ghi rõ phiên bản, nguồn gateway và ảnh thanh tab; không xóa lịch sử để thử chữa lỗi.

### Khóa API hoặc xác thực bị từ chối

Kiểm tra đúng tài khoản/dự án, khóa còn hiệu lực, quyền model và hạn mức. Làm theo thông báo của nhà cung cấp. Không dùng mật khẩu web làm API key và không chia sẻ khóa lên Issues.

### Lỗi tải install.ps1 hoặc cảnh báo runtime không khớp

Xác nhận đang chạy đúng bản mới nhất từ đường dẫn cài hiện tại, không mở nhầm lối tắt Experimental cũ. Lõi của bộ cài này đã được đóng gói sẵn. Nếu vẫn gặp lỗi, giữ nguyên dữ liệu, chụp thông báo và lấy nhật ký đã loại bí mật; không tự cập nhật checkout lõi hoặc xóa runtime để làm mất bằng chứng.

## Trạng thái ký số và cảnh báo khi cài

Bản Windows chưa ký số nên Windows có thể hiển thị nhà phát hành chưa xác định hoặc cảnh báo uy tín. Bản macOS ký ad-hoc, chưa qua notarization của Apple, nên Gatekeeper chặn ở lần mở đầu tiên; xem bước xử lý ở mục [macOS](#macos) phía trên. Bản Linux không có cơ chế ký mã. Xem thêm [chính sách ký mã](CODE_SIGNING_POLICY.md).

Chỉ cân nhắc tiếp tục qua cảnh báo uy tín khi nguồn tải và SHA-256 khớp. Mã băm xác nhận đúng tệp đã công bố, không bảo đảm phần mềm không có lỗi. Nếu Defender phát hiện mối đe dọa cụ thể hoặc máy cơ quan chặn bằng chính sách, dừng và liên hệ người quản trị. Không tắt bảo vệ toàn máy hoặc Gatekeeper toàn hệ thống.

## Cập nhật, sao lưu và gỡ cài đặt

### Cập nhật

1. Chờ công việc kết thúc, sao lưu theo [hướng dẫn](docs/sao-luu-khoi-phuc.md), kiểm tra bản sao đọc được.
2. Đóng Hermes và dừng gateway/bot nền theo cách đang vận hành. Đóng cửa sổ chưa chắc dừng mọi công việc nền.
3. Tải bộ cài từ [Latest](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/latest), kiểm tra mã rồi cài đè. Không chọn gỡ toàn bộ dữ liệu.
4. Mở lại, kiểm tra phiên bản, lịch sử và kết nối. Khởi động lại gateway/bot đã tạm dừng khi sẵn sàng.

Cài đè giữ dữ liệu theo thiết kế và đã được kiểm thử trên hồ sơ cô lập. Vẫn cần bản sao lưu cho dữ liệu thật. Nếu có lỗi, giữ nhật ký và dùng bản sao đã xác minh để phục hồi; bản quay lui là `v2026.9.2`. Không khôi phục đè khi chưa sao lưu dữ liệu mới hơn.

Đợt pilot này không có luồng tự tải hay tự cài, trên cả ba nền tảng. Ứng dụng chỉ tự kiểm tra bản mới mỗi ngày (hoặc bấm "Kiểm tra ngay" trong mục Giới thiệu) và báo tên tệp, kích thước, mã SHA-256 kèm nút mở trang tải; việc tải và chạy bộ cài vẫn do bạn tự thực hiện. Ứng dụng tự chọn đúng tệp cho nền tảng đang chạy, bạn không cần tự phân biệt Windows, macOS hay Linux. Bản cũ hơn dùng cơ chế kiểm tra khác nên có thể không thấy được thông báo này; nếu vậy, hãy tự vào trang phát hành để tải bản mới. Không dùng `git pull` hay cập nhật lõi riêng để thay phiên bản ứng dụng.

### Sao lưu

Mở **Trung tâm chỉ huy → Bảo trì → Tạo bản sao lưu**, chờ hoàn tất rồi kiểm tra tệp. Nếu không thấy mục này hoặc ứng dụng không mở, xem cách sao lưu thư mục thủ công trong [hướng dẫn sao lưu](docs/sao-luu-khoi-phuc.md). Bản sao có thể chứa thông tin xác thực, cần giữ riêng tư.

### Gỡ cài đặt

- **Chỉ gỡ ứng dụng, giữ thư mục dữ liệu.** Windows dùng trình gỡ cài trong **Cài đặt → Ứng dụng**. macOS kéo **HermesVietnamese.app** (hiện tên "Hermes Vietnamese" trong Finder) từ **Applications** vào Thùng rác. Linux xóa tệp AppImage, hoặc gỡ gói deb qua trình quản lý gói của Ubuntu/Debian.
- **Gỡ GUI + agent, giữ dữ liệu** trong Hermes loại ứng dụng/runtime, giữ dữ liệu người dùng để cài lại.
- **Gỡ toàn bộ** xóa cả vùng dữ liệu đã chọn. Chỉ dùng khi đã đọc cảnh báo, kiểm tra sao lưu và thực sự muốn xóa.

Vì bản này dùng thư mục dữ liệu riêng với các bản Hermes cũ (`~/.hermes-vietnamese` trên macOS/Linux), gỡ bản mới không đụng tới dữ liệu hay bản cài cũ; bản cũ vẫn còn nguyên nếu bạn muốn quay lại tạm thời.

## Phiên bản và nguồn gốc

Số phiên bản có dạng **năm.tháng.lần cập nhật trong tháng**; phần cuối không phải ngày. Bạn có thể xem [ghi chú phát hành](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/latest) và [mã nguồn tương ứng](https://github.com/LucDinhLe/hermes-agent-vietnamese/tree/main).

## Riêng tư và hỗ trợ

Hermes Vietnamese là dự án cá nhân độc lập của [Lê Đình Lực](https://github.com/LucDinhLe), dựa trên Hermes Agent của Nous Research theo [MIT](LICENSE). Phần lõi giữ nguyên từng byte so với bản gốc, dự án chỉ duy trì lớp vỏ Việt hóa. Bộ cài không mang tài khoản, khóa hay lịch sử của người đóng gói. Dịch vụ AI và công cụ mạng bạn dùng có chính sách dữ liệu riêng.

Xem [miễn trừ và quyền riêng tư](DISCLAIMER.md), [báo bảo mật](SECURITY.md), [báo lỗi](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues). Khi báo lỗi, ghi bản đang chạy, hệ điều hành, kiến trúc, bước tái hiện và ảnh đã che thông tin cá nhân. Phần mềm được cung cấp theo nguyên trạng, chưa có bảo hành thương mại.
