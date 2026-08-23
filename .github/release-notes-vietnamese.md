<p align="center">
  <img src="https://raw.githubusercontent.com/LucDinhLe/hermes-agent-vietnamese/70b2418fdb2b35a714d4a813c6894cdbbec0a370/assets/banner.png" alt="Hermes Vietnamese" width="100%">
</p>

## Hermes Vietnamese

**Một Agent chủ trì, nhiều Agent chuyên trách cùng làm việc trong từng phiên.**

Hermes Vietnamese v31.0 là ứng dụng AI agent chạy trên máy tính. Người dùng có
thể giao một công việc cho Agent chủ trì, rồi mời thêm các Agent chuyên trách
cùng nghiên cứu, viết, phản biện hoặc kiểm tra kết quả. Các Agent chỉ tham gia
trong phiên hoặc dự án được chọn, nên người dùng vẫn kiểm soát model, dữ liệu,
công cụ và chi phí. Ứng dụng cũng tích hợp tệp, Terminal, trình duyệt, dự án và
lịch tự động trong một giao diện tiếng Việt.

Bản phát hành này do
[Lê Đình Lực (LucDinhLe)](https://github.com/LucDinhLe) phát triển và duy trì
như một dự án cá nhân phục vụ cộng đồng, dựa trên mã nguồn mở
[Hermes Agent](https://github.com/NousResearch/hermes-agent) của Nous Research
theo giấy phép MIT. Đây là bản phân phối độc lập, không phải bản phát hành chính
thức của Nous Research hay của các nhà cung cấp model AI.

| Thông tin                       | Giá trị                                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| Tên sản phẩm                    | **Hermes Vietnamese v31.0**                                                                        |
| Nhãn phát hành                  | `vi-v0.31.0-7`                                                                                     |
| Phiên bản kỹ thuật Desktop      | `0.31.0-vi.7`                                                                                      |
| Lõi mã nguồn mở                 | Hermes Agent `0.20.4`                                                                              |
| Người phát triển bản tiếng Việt | **Lê Đình Lực (LucDinhLe)**                                                                        |
| Giấy phép                       | MIT                                                                                                |
| Lớp phát hành                   | **Community prerelease**, chưa phải stable                                                         |
| Bản quay lui đã diễn tập        | [`vi-v0.20.4-39`](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.4-39) |

> **Lưu ý quan trọng:** đây là bản community prerelease để cộng đồng trải
> nghiệm và phản hồi. Windows x64 đã vượt exact-artifact smoke bằng đúng tệp
> đang phát hành. Năm target còn lại mới đạt cổng build native và chưa có smoke
> trên máy người dùng. Bản tải mặc định/Latest vẫn là `vi-v0.20.0-25`.

### Bản này phù hợp với ai?

- Người muốn dùng AI agent bằng tiếng Việt và vẫn chuyển được sang English.
- Người muốn cài một ứng dụng Desktop thay vì tự chuẩn bị Git, Python, Node.js
  và dependency từ mã nguồn.
- Người làm nội dung, đào tạo, nghiên cứu, vận hành, lập trình hoặc quản lý dự
  án cần AI có thể đọc tệp, chạy lệnh, dùng trình duyệt và ghi nhớ qua nhiều
  phiên.
- Người muốn tổ chức nhiều Agent theo vai trò, ví dụ Agent nghiên cứu, Agent
  viết, Agent phản biện và Agent kiểm tra kỹ thuật.
- Người muốn dùng tài khoản hoặc API key của chính mình và kiểm soát model,
  quyền truy cập cùng chi phí.
- Người chấp nhận bản thử nghiệm cộng đồng, biết sao lưu dữ liệu quan trọng và
  sẵn sàng gửi phản hồi khi gặp lỗi.

Bản này chưa phù hợp với hệ thống trọng yếu cần phần mềm đã ký số, hỗ trợ thương
mại, bảo hành hoặc nghiệm thu đầy đủ trên đúng loại máy đang sử dụng.

## Thế mạnh so với cách dùng Hermes Agent mặc định từ mã nguồn

Hermes Vietnamese giữ năng lực lõi của Hermes Agent, đồng thời bổ sung một lớp
Desktop, Việt hóa, đóng gói và kiểm soát vận hành cho người dùng phổ thông.

| Nhu cầu                       | Hermes Vietnamese v31.0 bổ sung                                                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cài đặt dễ hơn                | Bộ cài riêng cho Windows, macOS và Linux. Runtime thiết yếu cùng dependency của đúng phiên bản được đóng gói, giảm nhu cầu tự cài công cụ lập trình.             |
| Bắt đầu bằng tiếng Việt       | Giao diện tiếng Việt mặc định, có English đầy đủ. Tên model, nhà cung cấp và giá trị kỹ thuật vẫn được giữ để đối chiếu tài liệu quốc tế.                        |
| Làm việc theo dự án           | Có trang Dự án, ghim và sắp xếp dự án, mở phiên đúng thư mục, giữ trạng thái sau khi khởi động lại.                                                              |
| Nhiều phiên trong một cửa sổ  | Phiên có tab riêng, có thể đổi tên, chuyển nhanh hoặc chia panel để xử lý và đối chiếu nhiều việc song song.                                                     |
| Panel công việc tích hợp      | Panel phải chứa Tệp, Terminal và Trình duyệt nhiều tab. Người dùng và Agent có thể cùng quan sát một không gian làm việc.                                        |
| Agents cộng tác theo phiên    | Nút **Agents** luôn hiện trong từng phiên. Có tìm kiếm roster, mời nhiều Agent, phân biệt Agent chủ trì với Agent cộng tác và lưu phạm vi theo phiên hoặc dự án. |
| Quản lý Agent đầy đủ          | Trang **Quản lý Agents** hỗ trợ tạo, sửa, sao chép, xóa, nhóm, năng lực, kỹ năng, công cụ, MCP và tác vụ định kỳ.                                                |
| Kiểm soát ngữ cảnh và chi phí | Mỗi phiên hiển thị mức dùng cửa sổ ngữ cảnh, ước tính chi phí USD và model đang làm việc. Chi phí là ước tính kỹ thuật, không thay thế hóa đơn của nhà cung cấp. |
| Advisor phản biện             | Có thể bật một model Advisor độc lập để kiểm kế hoạch, hướng phục hồi và kết quả cuối. Advisor chỉ đọc, không tự chạy công cụ thay Agent chính.                  |
| Tự động hóa gần gũi hơn       | Có 16 mẫu tác vụ định kỳ bằng tiếng Việt cho bản tin, email, tổng kết, theo dõi, học tập, sức khỏe và công việc cá nhân.                                         |
| Trình duyệt có phạm vi        | Hermes Connector chỉ nhập phiên đăng nhập của website sau khi người dùng chọn đúng domain và xác nhận. Có preview, thu hồi quyền và tách Electron session.       |
| Dễ bảo trì và quay lui        | Có manifest SHA-256, cập nhật theo release bất biến, repair, gỡ giữ dữ liệu, gỡ xóa dữ liệu và mốc rollback rõ ràng.                                             |

Hermes Vietnamese không tặng kèm model, tài khoản ChatGPT/Claude/Gemini, API
key hoặc hạn mức sử dụng. Người dùng chủ động chọn nhà cung cấp và chịu chi phí
theo tài khoản của mình.

## Những điểm nổi bật của v31.0

### 1. Agents trở thành cộng tác viên thật sự trong từng phiên

- Nút **Agents** nằm cố định ở thanh thông tin phiên, cạnh Context, chi phí và
  Advisor.
- Có thể tìm Agent trong roster dài và mời nhiều Agent vào cùng một phiên.
- Agent được mời không thay đổi Agent chủ trì, model chính, Gateway hay system
  prompt của phiên.
- Thành viên có thể được lưu theo phiên hoặc dự án, phù hợp với nhóm Agent dùng
  lặp lại cho một công việc dài hạn.
- Trang **Quản lý Agents** gom hồ sơ, nhóm, kỹ năng, công cụ, MCP và routine về
  một nơi ổn định.
- Dữ liệu Bot/Agent cũ vẫn được đọc. v31 chỉ thay lớp trình bày và không tự ý
  viết lại dữ liệu người dùng.

### 2. Context, chi phí và Advisor nằm ngay nơi làm việc

- Mức dùng cửa sổ ngữ cảnh được theo dõi riêng cho từng phiên.
- Chi phí API được ước tính từ token vào, token ra và cache theo bảng giá model
  đã biết.
- Model làm việc và model Advisor được tách rõ.
- Advisor có checkpoint cho kế hoạch, phục hồi và kết quả cuối.
- Tác vụ đơn giản có thể tắt Advisor để tránh lượt model phụ không cần thiết.

### 3. Một cửa sổ cho hội thoại, tệp, Terminal và trình duyệt

- Tạo và đổi tên nhiều phiên, mở thành tab hoặc chia panel.
- Panel phải co giãn độc lập và giữ Tệp, Terminal cùng nhiều tab Browser.
- Trang Dự án giúp nhóm các phiên theo thư mục thật trên máy.
- Trang Thống kê sử dụng tổng hợp token theo thời gian, dự án và model.
- Trạng thái quan trọng được giữ sau khi đóng rồi mở lại ứng dụng.

### 4. Gateway, Connector và quyền truy cập được làm rõ hơn

- Gateway tự làm mới trạng thái sau start hoặc restart, không cần bấm kiểm tra
  sức khỏe thủ công trong tình huống chuyển tiếp bình thường.
- Chrome/Edge Connector xin quyền theo đúng hostname ở cả HTTP và HTTPS.
- Preview chỉ hiển thị metadata, không hiển thị giá trị cookie hoặc bí mật.
- Người dùng có thể thu hồi quyền đã cấp; phiên website được nhập vào vùng
  Electron tách biệt.
- Mật khẩu, autofill, bookmark và toàn bộ hồ sơ trình duyệt không được sao chép
  vào Hermes.

### 5. Cài đè, sửa chữa và gỡ cài đặt có phạm vi rõ

- Giữ nguyên app ID và vùng dữ liệu để bản mới nhận cấu hình, dự án, phiên và
  trạng thái onboarding hiện có.
- Repair cùng byte không làm mất profile hoặc dữ liệu Desktop.
- Gỡ giữ dữ liệu xóa ứng dụng và mục đăng ký của đúng bản đang chạy nhưng giữ
  profile cùng userData.
- Gỡ xóa dữ liệu chỉ xóa vùng đã chọn. Bản cài all-users hoặc bản ở đường dẫn
  khác không thuộc phạm vi sẽ không bị đụng tới.
- Đường nâng cấp từ `vi-v0.20.4-39` và rollback về bản đó đã được diễn tập trên
  tài khoản smoke cô lập.

## Tải đúng bản cho máy

Luôn tải từ release này và đối chiếu với
[`SHA256SUMS.txt`](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-7/SHA256SUMS.txt).

| Máy đang dùng           | Tệp cài v31.0                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 10/11 x64       | [Bộ cài Windows x64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-7/Hermes-Vietnamese-Windows-x64-Setup.exe)        |
| Windows 10/11 ARM64     | [Bộ cài Windows ARM64](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-7/Hermes-Vietnamese-Windows-arm64-Setup.exe)    |
| Mac chip Apple M-series | [macOS Apple Silicon DMG](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-7/Hermes-Vietnamese-macOS-Apple-Silicon.dmg) |
| Mac chip Intel          | [macOS Intel DMG](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-7/Hermes-Vietnamese-macOS-Intel.dmg)                 |
| Ubuntu/Debian x64       | [Linux x64 DEB](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-7/Hermes-Vietnamese-Linux-x64.deb)                     |
| Ubuntu/Debian ARM64     | [Linux ARM64 DEB](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-7/Hermes-Vietnamese-Linux-arm64.deb)                 |
| Fedora/RHEL x64         | [Linux x64 RPM](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-7/Hermes-Vietnamese-Linux-x64.rpm)                     |
| Fedora/RHEL ARM64       | [Linux ARM64 RPM](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-7/Hermes-Vietnamese-Linux-arm64.rpm)                 |
| Linux khác x64          | [Linux x64 AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-7/Hermes-Vietnamese-Linux-x64.AppImage)           |
| Linux khác ARM64        | [Linux ARM64 AppImage](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/download/vi-v0.31.0-7/Hermes-Vietnamese-Linux-arm64.AppImage)       |

SHA-256 của bộ cài Windows x64 đã nghiệm thu:

```text
cca0f3c0255e5e8736676a4d7ccb52c6e1b75eb73b94b8d1c3ca5dc91e57e840
```

## Lưu ý cài đặt dành cho người dùng

### Chọn đúng kiến trúc

- Windows có `x64-based processor` chọn x64; máy dùng chip ARM chọn ARM64.
- Mac dùng chip M1, M2, M3, M4 hoặc mới hơn chọn Apple Silicon; Mac chip Intel
  chọn bản Intel.
- Ubuntu/Debian ưu tiên `.deb`; Fedora/RHEL ưu tiên `.rpm`; Linux khác có thể
  thử AppImage phù hợp kiến trúc.
- Windows 32-bit và Linux ARM 32-bit chưa được đóng gói.

### Cảnh báo trên Windows

Bộ cài Windows chưa có Authenticode trong thời gian hồ sơ **SignPath
Foundation** đang chờ xét duyệt. Microsoft Edge hoặc SmartScreen có thể báo tệp
chưa phổ biến và hiển thị `Publisher: Unknown`.

Chỉ tiếp tục khi đường tải thuộc kho `LucDinhLe/hermes-agent-vietnamese`, tên
tệp đúng với máy và SHA-256 khớp manifest. Không tắt Microsoft Defender,
SmartScreen hoặc chính sách bảo mật của toàn máy. Nếu Defender nêu tên một mối
đe dọa cụ thể, hãy dừng cài và gửi báo cáo.

| 1. Chọn **See more**                                                                                                                                                                                                             | 2. Chọn **Keep** trong menu tải xuống                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Edge báo tệp Hermes chưa được tải xuống phổ biến](https://raw.githubusercontent.com/LucDinhLe/hermes-agent-vietnamese/70b2418fdb2b35a714d4a813c6894cdbbec0a370/docs/assets/windows-install/edge-warning-see-more-v25.jpg)      | ![Menu tải xuống của Edge có lựa chọn Keep](https://raw.githubusercontent.com/LucDinhLe/hermes-agent-vietnamese/70b2418fdb2b35a714d4a813c6894cdbbec0a370/docs/assets/windows-install/edge-download-menu-keep-v25.jpg) |
| **3. Kiểm tra nguồn tải và Publisher Unknown**                                                                                                                                                                                   | **4. Mở mũi tên rồi chọn Keep anyway**                                                                                                                                                                                |
| ![Edge hiển thị Publisher Unknown vì bộ cài chưa ký số](https://raw.githubusercontent.com/LucDinhLe/hermes-agent-vietnamese/70b2418fdb2b35a714d4a813c6894cdbbec0a370/docs/assets/windows-install/edge-publisher-unknown-v25.jpg) | ![Edge hiện lựa chọn Keep anyway](https://raw.githubusercontent.com/LucDinhLe/hermes-agent-vietnamese/70b2418fdb2b35a714d4a813c6894cdbbec0a370/docs/assets/windows-install/edge-keep-anyway-v25.jpg)                  |

Giao diện Edge có thể thay đổi hoặc bỏ qua một bước. Hướng dẫn chi tiết nằm tại
[Cài Windows bằng hình ảnh](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/70b2418fdb2b35a714d4a813c6894cdbbec0a370/docs/cai-dat-windows-bang-anh.md).

### Cảnh báo trên macOS và Linux

- Dự án **chưa tham gia Apple Developer Program**. Bản macOS chưa có Developer
  ID, notarization hoặc stapling nên Gatekeeper có thể cảnh báo hoặc chặn.
- Không tắt Gatekeeper hay cơ chế bảo vệ toàn máy. Nếu chính sách máy không cho
  phép ứng dụng chưa ký, hãy chờ bản đã ký hoặc chỉ thử trong môi trường riêng.
- AppImage có thể cần được đánh dấu cho phép thực thi trong Properties trước khi
  mở. Gói `.deb` hoặc `.rpm` nên được cài bằng trình quản lý phần mềm của hệ điều
  hành.

### Cài mới và cài đè

1. Sao lưu dữ liệu quan trọng trước khi thử bản prerelease.
2. Đóng Hermes và Gateway đang chạy.
3. Tải đúng tệp, kiểm SHA-256 rồi mở bộ cài.
4. Nếu đang dùng bản cũ tương thích, cài đè vào đúng phạm vi người dùng hiện
   tại để giữ cấu hình và lịch sử.
5. Mở Hermes, chọn ngôn ngữ, chờ runtime cùng Gateway sẵn sàng rồi kết nối model.
6. Thử một tác vụ nhỏ trước khi cấp quyền với thư mục hoặc website quan trọng.

## Hướng dẫn sử dụng hiệu quả bước đầu

### Bước 1. Kết nối model theo đúng nhu cầu

Mở **Cài đặt → Model/Nhà cung cấp** và chọn tài khoản phù hợp. Có thể dùng
OpenAI OAuth nếu tài khoản có quyền Codex, Claude Pro/Max qua Claude Code,
Gemini API hoặc provider khác được Hermes hỗ trợ. Mỗi dịch vụ có hạn mức và cách
tính phí riêng.

Gợi ý thực tế:

- Model nhanh, rẻ dùng cho phân loại, tóm tắt và chỉnh câu chữ.
- Model mạnh dùng cho lập kế hoạch, lập trình, nghiên cứu hoặc tác vụ nhiều bước.
- Chỉ bật Advisor khi công việc đáng để trả thêm một lượt kiểm tra.

### Bước 2. Tạo một dự án thay vì dồn mọi việc vào một phiên

Tạo dự án theo thư mục thật, ví dụ `Khóa học AI`, `Nội dung tháng 9` hoặc
`Website công ty`. Mỗi chủ đề lớn nên có phiên riêng. Cách này giúp ngữ cảnh gọn,
file đúng chỗ và chi phí dễ theo dõi.

### Bước 3. Dùng Agents theo vai trò rõ ràng

Tạo Agent với nhiệm vụ cụ thể, ví dụ:

- **Agent nghiên cứu** tìm nguồn và kiểm chứng dữ kiện.
- **Agent biên tập** giữ giọng văn và cấu trúc nội dung.
- **Agent kỹ thuật** đọc repository, chạy test và sửa lỗi.
- **Agent phản biện** tìm điểm yếu trước khi bàn giao.

Trong phiên, mở **Agents**, tìm roster và mời Agent cần thiết. Giữ một Agent chủ
trì chịu trách nhiệm tổng hợp để tránh nhiều người cùng lái một việc.

### Bước 4. Quan sát Context, chi phí và tiến trình

Khi mức dùng ngữ cảnh tăng cao, hãy kết thúc lát cắt hiện tại, ghi lại quyết định
và mở phiên mới nếu cần. Đừng giữ một phiên vô hạn cho mọi công việc. Dùng phần
ước tính chi phí để chọn model hợp lý; số này chỉ là ước tính kỹ thuật.

### Bước 5. Dùng panel phải để kiểm chứng công việc

- **Tệp** để xem tài liệu Agent đang đọc hoặc sửa.
- **Terminal** để theo dõi lệnh và kết quả kỹ thuật.
- **Trình duyệt** để mở nguồn, form và website cần thao tác.
- Tạo nhiều tab Browser khi cần đối chiếu, nhưng chỉ ghép Connector với đúng
  website thực sự cần dùng.

### Bước 6. Dùng Advisor cho checkpoint quan trọng

Bật Advisor trước những việc có rủi ro cao như xuất bản nội dung, sửa code,
phân tích dữ liệu hoặc ra quyết định. Yêu cầu Advisor kiểm ba điểm: mục tiêu có
đúng không, bằng chứng đã đủ chưa, kết quả cuối còn rủi ro gì. Tắt Advisor cho
tác vụ ngắn để tiết kiệm lượt model.

### Bước 7. Tự động hóa sau khi luồng thủ công đã ổn

Chỉ tạo tác vụ định kỳ sau khi đã chạy thử thủ công và kiểm tra đầu ra. Bắt đầu
với mẫu tiếng Việt, chọn lịch dễ quan sát và giữ quyền ở mức tối thiểu. Kiểm tra
Gateway nếu muốn nhận kết quả qua kênh nhắn tin.

## Dữ liệu, quyền và chi phí

- Bộ cài không chứa tài khoản, OAuth token, API key, lịch sử hoặc dữ liệu của
  người đóng gói.
- Thông tin đăng nhập và dữ liệu được lưu trong hồ sơ trên máy người dùng.
- Dữ liệu cần thiết có thể được gửi tới model hoặc dịch vụ mà người dùng chọn,
  theo điều khoản của dịch vụ đó.
- Hermes có thể chạy lệnh, sửa hoặc xóa tệp trong phạm vi được cấp. Hãy đọc yêu
  cầu quyền và kiểm tra kết quả trước thao tác quan trọng.
- Không đăng API key, mã OAuth, cookie, bản sao lưu hoặc log chưa làm sạch vào
  issue công khai.
- Cài đặt ứng dụng không tự phát sinh phí model. Chi phí chỉ phát sinh khi dùng
  provider hoặc dịch vụ có tính phí theo tài khoản của người dùng.

## Tình trạng nghiệm thu

- **Windows x64: exact-artifact smoke đạt** trên Windows 11 vật lý bằng đúng bộ
  cài công khai. Các lane gồm cài mới, runtime tích hợp, Gateway, phiên, dự án,
  Context, Agents, repair, nâng từ vi39, gỡ giữ dữ liệu, gỡ xóa dữ liệu và
  rollback.
- Windows ARM64, macOS Apple Silicon/Intel và Linux x64/ARM64 đã build trên
  runner native và khớp manifest nhưng **chưa có smoke trên máy người dùng**.
  Các target này mang phạm vi `BUILD-ONLY-PILOT`.
- Windows chưa Authenticode. SignPath Foundation là đường ký đang được theo
  đuổi.
- macOS chưa ký và chưa công chứng.
- Smoke runtime dùng provider loopback cô lập, không gọi model trả phí.

## Hỗ trợ, phản hồi và quay lui

Bản prerelease được công khai để lấy bằng chứng sử dụng thực tế. Khi báo lỗi,
hãy gửi:

- Hệ điều hành, phiên bản và kiến trúc máy.
- Tên tệp cài và SHA-256 nếu có thể.
- Các bước tái hiện, kết quả mong đợi và kết quả thực tế.
- Ảnh hoặc log đã xóa tên riêng, đường dẫn nhạy cảm và thông tin đăng nhập.

Liên kết hỗ trợ:

- [GitHub Issues](https://github.com/LucDinhLe/hermes-agent-vietnamese/issues)
- [README tiếng Việt](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/README.vi.md)
- [Hướng dẫn cài Windows bằng ảnh](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/70b2418fdb2b35a714d4a813c6894cdbbec0a370/docs/cai-dat-windows-bang-anh.md)
- [SECURITY.md](https://github.com/LucDinhLe/hermes-agent-vietnamese/blob/main/SECURITY.md)
- [Mốc quay lui vi-v0.20.4-39](https://github.com/LucDinhLe/hermes-agent-vietnamese/releases/tag/vi-v0.20.4-39)
- [Workflow dựng và staging](https://github.com/LucDinhLe/hermes-agent-vietnamese/actions/runs/32644972843)
- [Workflow promotion và hậu kiểm](https://github.com/LucDinhLe/hermes-agent-vietnamese/actions/runs/32653363289)

Phần mềm được cung cấp theo nguyên trạng theo giấy phép MIT, không kèm bảo hành.
Người dùng chịu trách nhiệm kiểm tra kết quả, quyền đã cấp, dữ liệu đã gửi và
chi phí dịch vụ trước khi cho Agent thực hiện thao tác quan trọng.

---

**Cập nhật metadata ngày 24/08/2026:** bổ sung phần giới thiệu, so sánh, ảnh
hướng dẫn Windows và hướng dẫn sử dụng; rút gọn tiêu đề hiển thị và làm rõ cách
Agents cộng tác trong từng phiên. Tag, commit, 31 asset, kích thước và checksum
của bản phát hành không thay đổi.
