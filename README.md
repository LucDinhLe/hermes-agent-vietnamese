<p align="center">
  <img src="assets/banner.png" alt="Hermes Vietnamese" width="100%">
</p>

# Hermes Vietnamese

**Bản cộng đồng giúp người Việt cài Hermes Agent như một ứng dụng thông thường, kết nối model của mình và bắt đầu giao việc mà không phải tự dựng môi trường lập trình.**

Hermes là một AI agent có thể trò chuyện, làm việc với tệp, chạy lệnh, dùng trình duyệt, ghi nhớ qua nhiều phiên, học kỹ năng và chạy tác vụ theo lịch. Dự án này ra đời vì đường tiếp cận từ mã nguồn của Hermes Agent vẫn là một rào cản với người dùng phổ thông Việt Nam. Việc tự chuẩn bị Git, Python, Node.js, dependency, dòng lệnh và tài liệu tiếng Anh dễ làm người mới dừng lại trước khi thấy được năng lực thật của Hermes.

Hermes Vietnamese đóng gói phần lõi đó thành trải nghiệm Desktop Việt/Anh có hướng dẫn rõ từ lúc tải về tới phiên làm việc đầu tiên, trên Windows, macOS và Linux. Lõi Hermes bên trong giữ nguyên từng byte so với bản gốc của Nous Research; dự án chỉ duy trì lớp vỏ gồm ứng dụng, tài liệu và công cụ đóng gói, nên người dùng nhận đúng hành vi cùng các bản sửa lỗi của dự án gốc. Dự án phục vụ người dùng cá nhân, người làm nội dung, đào tạo, nghiên cứu, vận hành và các nhóm nhỏ muốn thử một AI agent có thể thao tác trên máy dưới quyền kiểm soát của chính họ. Đây vẫn là bản pilot cộng đồng, chưa phù hợp với công việc trọng yếu cần phần mềm đã ký số, hỗ trợ thương mại hoặc cam kết bảo hành.

Dự án được phát triển từ [Hermes Agent](https://github.com/NousResearch/hermes-agent) của Nous Research theo [giấy phép MIT](LICENSE), do [Lê Đình Lực](https://github.com/LucDinhLe) phát triển và duy trì như một dự án cá nhân vì cộng đồng, trước hết cho học viên các chương trình đào tạo ứng dụng AI của anh, sau đó mở cho cộng đồng dùng chung. Đây là bản phân phối độc lập, không phải bản phát hành chính thức của Nous Research, OpenAI, Anthropic, Google, Microsoft hoặc Apple.

<p align="center">
  <a href="https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/latest"><img src="https://img.shields.io/badge/Tải_bản_mới_nhất-Windows_·_macOS_·_Linux-F97316?style=for-the-badge" alt="Tải Hermes Vietnamese bản mới nhất"></a>
  <a href="README.vi.md"><img src="https://img.shields.io/badge/Hướng_dẫn-Cài_đặt_%26_kết_nối-DC2626?style=for-the-badge" alt="Hướng dẫn cài đặt và kết nối"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/Giấy_phép-MIT-16A34A?style=for-the-badge" alt="Giấy phép MIT"></a>
</p>

<!-- current-release:start -->
> **Bản tải mặc định/Latest: [Hermes Vietnamese 2026.9.4](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/v2026.9.4)** là **community pilot công khai, chưa phải stable**, dành cho Windows x64, macOS Apple Silicon và Linux x64. Windows chưa ký số, macOS ký ad-hoc, Linux không có cơ chế ký. Ứng dụng báo khi có bản mới kèm SHA-256, không tự tải hay tự cài. Trên macOS, lần mở đầu vào **System Settings → Privacy & Security** bấm **Open Anyway**; nếu báo "damaged", chạy `xattr -cr /Applications/HermesVietnamese.app`. Trên Linux, cấp quyền chạy cho AppImage (`chmod +x`) hoặc cài gói deb.

| Máy đang dùng | Tải trực tiếp | Kích thước | SHA-256 |
| --- | --- | --- | --- |
| Windows 10/11, chip x64 | [Bộ cài x64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/Hermes-2026.9.4-win-x64.exe) | 345852734 byte | `3cd30aaad47167c439bb6637af3c531ceffc4e2f74d7a808e3a9c105e3938990` |
| macOS 12+, Apple Silicon (M1 trở lên) | [DMG](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/Hermes-2026.9.4-mac-arm64.dmg) | 385594943 byte | `8ebc605c66c9cc8eeed6fc314b71cbdabeedea6c62c297035296729571284d8c` |
| Linux x64 | [AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/Hermes-2026.9.4-linux-x86_64.AppImage) · [DEB](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/Hermes-2026.9.4-linux-amd64.deb) | 397516248 byte · 320996796 byte | `26cfec58e6776f49d5e65cbdd62908119349f7406a4fc549bc417d839134249d`<br>`fc513d2a836ee5c6ca9762a627bb14b01d5a2cb4e09b234fd81439b61018e351` |

Đối chiếu mã với [SHA256SUMS.txt](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/v2026.9.4/SHA256SUMS.txt) của cùng bản phát hành trước khi chạy.
<!-- current-release:end -->

## Điểm mạnh so với cách tự cài Hermes Agent từ mã nguồn

| Nhu cầu của người dùng | Hermes Vietnamese bổ sung |
| --- | --- |
| Cài như ứng dụng thông thường | Bộ cài có giao diện cho Windows x64, macOS Apple Silicon và Linux x64; Python 3.11 cùng toàn bộ thư viện bắt buộc đã nằm trong bộ cài. Người dùng không phải cài Git, Python, Node.js hay chạy lệnh nào để hoàn tất lần đầu. |
| Bắt đầu bằng tiếng Việt | Giao diện tiếng Việt mặc định, chuyển nhanh VI/EN; tên model, thương hiệu và giá trị kỹ thuật giữ nguyên để dễ đối chiếu tài liệu quốc tế. |
| Đi từ cài đặt tới giao việc | Quy trình ba bước gồm chọn ngôn ngữ, chuẩn bị Hermes, kết nối model; có hướng dẫn riêng cho ChatGPT, Claude, Gemini, khóa API và model cục bộ, kèm [hướng dẫn cài Windows bằng hình ảnh](docs/cai-dat-windows-bang-anh.md). |
| Làm nhiều việc trong một cửa sổ | Tab nhiều phiên có nút `+`/`×`, danh sách phiên, Terminal tích hợp, vùng Tệp và Trình duyệt dùng chung ở panel phải. |
| Giữ nguyên lõi gốc, không sửa lõi | Lõi Hermes Agent trong bộ cài khớp từng byte với thẻ phát hành của Nous Research ghi trong `engine.lock`; máy chủ dựng chạy `scripts/engine-sync.mjs check` ở mỗi lần phát hành để chứng minh điều này. Người dùng không nhận thêm rủi ro từ một nhánh sửa riêng. |
| Cài song song, dữ liệu riêng, đường quay lui | Mã sản phẩm và thư mục dữ liệu riêng nên bản mới đứng cạnh bản Hermes cũ. Lần mở đầu, ứng dụng hỏi trước khi sao chép cấu hình và lịch sử từ bản cũ sang; bản cũ giữ nguyên để quay lại khi cần. |
| Dễ kiểm tra và phục hồi | Mọi tệp phát hành có SHA-256 trong `SHA256SUMS.txt`; ứng dụng báo khi có bản mới kèm mã kiểm tra và nút mở trang tải, không tự tải hay tự cài; có hai chế độ gỡ cài đặt và hướng dẫn sao lưu. |
| Giữ năng lực lõi Hermes | Vẫn dùng hệ thống model, công cụ, bộ nhớ, kỹ năng, lịch chạy, AI agent phụ và Gateway của dự án gốc; bản cộng đồng tập trung vào trải nghiệm cài đặt và sử dụng cho người Việt. |

Hermes Vietnamese không tặng kèm model AI, tài khoản trả phí hoặc hạn mức API. Người dùng tự chọn nhà cung cấp và chịu điều khoản, chi phí của dịch vụ đó.

## Từ tải về đến giao việc trong ba bước

### Bước 1. Tải về và cài đặt

Mở [trang phát hành mới nhất](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/latest), chọn đúng hệ điều hành và kiến trúc theo bảng ở đầu trang. Trong lần mở đầu tiên:

1. Chọn **Tiếng Việt** hoặc **English**.
2. Chờ ứng dụng chuẩn bị lõi đóng gói sẵn, thường dưới một phút.
3. Nếu máy có dữ liệu của bản Hermes cũ, chọn nhập hoặc bắt đầu mới. Nhập là sao chép, bản cũ giữ nguyên.

Người dùng không cần mở Terminal, chạy lệnh hay sửa tệp cấu hình. Internet vẫn cần cho tải bộ cài, đăng nhập và dịch vụ AI trực tuyến.

Mỗi hệ điều hành có một bước vượt cảnh báo riêng vì bộ cài chưa qua chứng thư thương mại:

- **Windows** báo `Publisher: Unknown` hoặc `isn't commonly downloaded`. Mở **See more**, bấm mũi tên cạnh **Delete** và chọn **Keep anyway**; xem [hướng dẫn từng bước bằng hình ảnh](docs/cai-dat-windows-bang-anh.md).
- **macOS** chặn lần mở đầu với thông báo "Apple could not verify". Bấm Done, mở **System Settings → Privacy & Security**, bấm **Open Anyway** rồi mở lại. Nếu báo "damaged", chạy `xattr -cr /Applications/HermesVietnamese.app` trong Terminal.
- **Linux** cần cấp quyền chạy cho AppImage bằng `chmod +x`, hoặc cài gói deb bằng `sudo apt install ./<tệp>.deb`.

| Edge báo tệp chưa được tải phổ biến | Mở mũi tên cạnh Delete và chọn Keep anyway |
| --- | --- |
| ![Edge yêu cầu bấm See more](docs/assets/windows-install/edge-warning-see-more-v25.jpg) | ![Edge hiện lựa chọn Keep anyway](docs/assets/windows-install/edge-keep-anyway-v25.jpg) |

Chỉ bỏ chặn khi tải đúng kho này và SHA-256 khớp; nếu Microsoft Defender nêu tên một mối đe dọa cụ thể thì dừng cài đặt. Không tắt SmartScreen, Defender hoặc Gatekeeper trên toàn máy.

### Kiểm tra máy trước khi tải

- **Windows:** nhấn `Windows + I` → **Hệ thống → Giới thiệu**. Máy cần Windows 10/11 bản 64-bit. Dòng **Loại hệ thống** ghi `x64-based processor` thì tải được; máy ARM64 chưa có bộ cài.
- **macOS:** mở menu Apple → **About This Mac**. Máy cần macOS 12 trở lên. Dòng **Chip** bắt đầu bằng `Apple M` thì tải được; máy Intel chưa có bộ cài.
- **Linux:** mở **Settings → About** để xem kiến trúc, hoặc chạy `uname -m`. `x86_64` tải được; `aarch64` chưa có bộ cài. AppImage chạy trên hầu hết bản phân phối, gói deb dành cho Ubuntu/Debian.

Xem thêm [hướng dẫn kiểm tra cấu hình, cài đặt và xử lý cảnh báo](README.vi.md#kiểm-tra-máy-có-phù-hợp-không).

### Bước 2. Kết nối model

Màn **Kết nối model** hiện ngay ba lựa chọn phổ biến, theo thứ tự dễ hiểu:

1. **OpenAI OAuth (ChatGPT)** dùng tài khoản ChatGPT của bạn.
2. **Claude Pro / Max (qua Claude Code)** dùng tài khoản Claude Pro hoặc Max của bạn.
3. **Google Gemini (khóa API)** dùng khóa tạo tại Google AI Studio.

Ngay bên dưới là toàn bộ kết nối tài khoản và khóa API mà lõi Hermes đang cài hỗ trợ. Danh sách lấy từ lõi nên nhà cung cấp mới sẽ xuất hiện mà không cần sửa riêng giao diện tiếng Việt. Bạn cũng có thể chọn **Tôi sẽ chọn nhà cung cấp sau** để vào ứng dụng trước.

| Lựa chọn | Bạn cần có | Cách tính phí |
| --- | --- | --- |
| ChatGPT OAuth | Tài khoản ChatGPT có quyền dùng Codex | Theo gói và giới hạn của tài khoản ChatGPT |
| Claude Pro / Max | Gói Claude Pro hoặc Max và đăng nhập Claude Code | Dùng quyền lợi gói Claude; cầu nối từ chối Extra Usage để tránh chuyển sang mức dùng tính thêm |
| Google Gemini | Khóa API Google AI Studio | Theo hạn mức miễn phí hoặc thanh toán API của Google AI Studio |
| Anthropic API | Khóa API Anthropic | Tính phí API riêng, không dùng chung gói Claude Pro/Max |
| Nhà cung cấp khác | Tài khoản hoặc khóa tương ứng | Theo chính sách của dịch vụ bạn chọn |

Hermes không tặng kèm gói model trả phí. Mỗi người tự đăng nhập tài khoản hoặc nhập khóa API của mình. Xem thao tác từng bước tại [Kết nối ChatGPT, Claude và Gemini](README.vi.md#kết-nối-chatgpt-claude-và-gemini).

#### Dùng Gemini bằng khóa Google AI Studio

Đây là đường chính thức để có Gemini trong Hermes, mở cho mọi tài khoản Google và không cần dự án Google Cloud.

1. Mở [Google AI Studio](https://aistudio.google.com/apikey), đăng nhập tài khoản Google rồi bấm tạo khóa API. Khóa hiện một lần, hãy sao chép và cất chỗ an toàn.
2. Trong Hermes chọn **Google Gemini (khóa API)**, dán khóa vào và kết nối.
3. Chọn model trong danh sách hiện ra, chẳng hạn Gemini 2.5 Pro cho việc cần suy luận sâu và Gemini 2.5 Flash cho việc cần nhanh.

Google cho một hạn mức miễn phí mỗi ngày, vượt hạn mức thì tính theo lượng dùng của AI Studio; hạn mức và giá do Google công bố, hãy xem tại trang giá của họ trước khi giao việc lớn. Người đã có dự án Google Cloud có thể chọn Vertex AI thay cho AI Studio.

Bản này không đăng nhập Gemini bằng tài khoản Google theo kiểu Gemini CLI, vì [điều khoản Gemini CLI không cho phần mềm bên thứ ba dùng lại dịch vụ qua OAuth này](https://github.com/google-gemini/gemini-cli/blob/main/docs/resources/tos-privacy.md) và Google chỉ mở cửa đó cho một số tài khoản. Khóa AI Studio đi đúng điều khoản và giữ tài khoản Google của bạn an toàn.

### Bước 3. Bắt đầu giao việc

Chọn model mặc định rồi giao một mục tiêu bằng tiếng Việt hoặc ngôn ngữ bạn muốn, chẳng hạn "Đọc tài liệu này và tóm tắt các việc cần làm". Sau thiết lập, Hermes mở không gian làm việc đầy đủ với:

- Hội thoại và tác vụ nhiều bước.
- Đọc, tạo và chỉnh sửa tệp theo quyền được cấp.
- Terminal tích hợp, công cụ trình duyệt, kỹ năng và bộ nhớ.
- AI agent phụ, lịch chạy và kết nối nền tảng nhắn tin khi được cấu hình.

Hãy bắt đầu với tệp thử hoặc bản sao, kiểm tra kết quả và cân nhắc trước những thao tác quan trọng.

## Hermes có thể làm gì?

| Khả năng | Mô tả |
| --- | --- |
| Làm việc với máy tính | Đọc và sửa tệp, chạy lệnh, duyệt web và thực thi mã theo quyền người dùng cấp. |
| Bộ nhớ và kỹ năng | Ghi nhớ qua nhiều phiên, tìm lại hội thoại và tạo hoặc cải thiện kỹ năng từ trải nghiệm. |
| Nhiều nhà cung cấp AI | Kết nối ChatGPT, Claude Pro/Max, Gemini API, Nous Portal, OpenRouter, Bedrock, Vertex AI và nhiều điểm cuối tương thích khác. |
| Tự động hóa | Tạo lịch chạy, giao việc cho AI agent phụ và gửi kết quả tới các kênh đã cấu hình. |
| Nền tảng nhắn tin | Có thể kết nối Telegram, Discord, Slack, WhatsApp và các nền tảng khác qua Gateway. |
| Nhiều môi trường chạy | Hỗ trợ máy cá nhân, Docker, SSH và một số môi trường máy chủ từ xa. |

Tài liệu kỹ thuật đầy đủ của dự án gốc nằm tại [hermes-agent.nousresearch.com/docs](https://hermes-agent.nousresearch.com/docs/).

## Riêng tư và dữ liệu đăng nhập

**Thông tin đăng nhập và dữ liệu của mỗi người được lưu riêng trên máy của mình.** Bộ cài không chứa tài khoản, khóa API, mã OAuth hoặc lịch sử trò chuyện của người đóng gói. Dự án này không vận hành máy chủ tập trung để thu thập thông tin đăng nhập của người dùng.

Khi bạn gửi yêu cầu tới một nhà cung cấp AI hoặc dịch vụ mạng, nội dung cần thiết sẽ được dịch vụ đã chọn xử lý theo điều khoản và chính sách quyền riêng tư của họ. AI agent có thể chạy lệnh và thao tác với tệp trong phạm vi được cấp, vì vậy hãy đọc yêu cầu quyền trước khi chấp thuận và kiểm tra kết quả trước các thao tác quan trọng. Xem [miễn trừ và quyền riêng tư](DISCLAIMER.md).

## Trạng thái ký số của bộ cài

Bộ cài Windows chưa có chữ ký số xác minh nhà phát hành nên SmartScreen có thể cảnh báo. Bản macOS được ký ad-hoc, tức có chữ ký hợp lệ nhưng không gắn với chứng thư Apple Developer và chưa qua notarization, nên Gatekeeper chặn ở lần mở đầu và người dùng bấm Open Anyway một lần cho mỗi máy. Linux không có cơ chế ký mã, người dùng đối chiếu SHA-256.

Đây là trạng thái kỹ thuật của một dự án cộng đồng chưa có chứng thư thương mại, không có nghĩa Microsoft hoặc Apple đã từ chối dự án hay phần mềm không được phép cài. Chứng thư ký mã dùng để xác minh nguồn phát hành; nó không phải giấy phép sử dụng phần mềm do Microsoft hoặc Apple cấp. Khi dự án có tài khoản Apple Developer, bản macOS sẽ được ký Developer ID và notarize; mã cho việc đó đã sẵn trong kho.

Chỉ tải từ [trang phát hành chính thức của kho này](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases) và đối chiếu mã trong `SHA256SUMS.txt` trước khi cài. Không tắt cơ chế bảo mật của hệ điều hành trên toàn máy. Xem [chính sách ký mã](CODE_SIGNING_POLICY.md) và [hướng dẫn xử lý cảnh báo](README.vi.md#trạng-thái-ký-số-và-cảnh-báo-khi-cài).

## Cập nhật và giữ phần tiếng Việt

Bản cộng đồng nhận cập nhật từ kho `LucDinhLe/hermes-agent-vietnamese`. Mỗi bản phát hành ghim đúng một thẻ phát hành của Hermes Agent gốc trong `engine.lock` và mang lõi đó nguyên vẹn từng byte; lớp Việt hóa nằm riêng ở ứng dụng Desktop, tài liệu và công cụ đóng gói, nên nâng lõi lên bản mới của Nous Research là thay một dòng ghim rồi dựng lại, không phải rà từng tệp.

Ứng dụng tự kiểm tra bản mới mỗi ngày, hoặc khi bạn bấm **Kiểm tra ngay** trong mục Giới thiệu, rồi báo tên tệp, kích thước, mã SHA-256 kèm nút mở trang tải. Ứng dụng không tự tải hay tự cài; bạn tải bộ cài đúng nền tảng và tự chạy. Tài khoản, cấu hình, phiên làm việc và bộ nhớ nằm trong thư mục dữ liệu người dùng, tách khỏi tệp ứng dụng, nên cài bản mới không xóa dữ liệu đó. Trước thay đổi lớn hoặc khi chuyển máy, mở **Trung tâm chỉ huy → Bảo trì → Tạo bản sao lưu** rồi giữ tệp `.zip` ở nơi an toàn. Xem [hướng dẫn sao lưu và khôi phục](docs/sao-luu-khoi-phuc.md).

## Nguồn gốc, giấy phép và miễn trừ

Dự án được phát triển từ [Hermes Agent](https://github.com/NousResearch/hermes-agent) của [Nous Research](https://nousresearch.com) theo giấy phép MIT. Giấy phép, kiến trúc, thuật toán và tính năng lõi vẫn thuộc phạm vi của dự án gốc. Bản cộng đồng bổ sung lớp Việt hóa, tài liệu, đóng gói đa nền tảng và bộ cài cho người dùng Việt, không sửa lõi.

Phần mềm được cung cấp theo nguyên trạng, không kèm cam kết bảo hành. Kết quả AI có thể sai; dịch vụ bên thứ ba có thể thay đổi model, giới hạn hoặc chính sách. Người dùng chịu trách nhiệm kiểm tra kết quả và quyền đã cấp. Xem [LICENSE](LICENSE) và [miễn trừ trách nhiệm bằng tiếng Việt](DISCLAIMER.md).

## Báo lỗi và đóng góp

- [Báo lỗi cài đặt, kết nối hoặc bản dịch](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues). Khi báo lỗi, ghi phiên bản, hệ điều hành, kiến trúc, bước tái hiện và ảnh đã che thông tin riêng.
- [Đọc hướng dẫn đầy đủ bằng tiếng Việt](README.vi.md).
- [Xem phạm vi bảo trì](MAINTAINERS.md).
- Báo cáo vấn đề bảo mật theo [SECURITY.md](SECURITY.md). Không đăng khóa API, mã OAuth hoặc dữ liệu cá nhân trong issue công khai.
