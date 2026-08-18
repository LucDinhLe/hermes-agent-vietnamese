# Rà soát cảnh báo bảo mật cho vi-v0.20.0-15

Ngày đối chiếu: 2026-08-15. Nguồn: GitHub Code Scanning của fork, OSV Scanner
2.3.8 đúng phiên bản workflow đang ghim, lockfile cục bộ và nội dung đóng gói
Desktop.

## Kết luận theo khả năng đi vào sản phẩm

| Nhóm cảnh báo | Alert GitHub | Phân loại | Xử lý v15 | Bằng chứng |
|---|---:|---|---|---|
| `cryptography 48.0.1` / CVE-2026-69247, 69248, 69249 | 8, 10, 11, 18, 19, 20 | Runtime Python; ba alert bị lặp qua hai lượt quét | Nâng pin và lock lên `50.0.0` | `uv sync --extra all --extra dingtalk --extra teams --extra azure-identity --extra dev --locked` cài thành công; 174 regression tests đạt; OSV không còn báo `cryptography` |
| `tar 6.2.1` / 12 advisory, trong đó một cặp CVE/GHSA trùng nội dung | 1, 2, 4, 5, 6, 7, 9, 12, 13, 14, 15, 17, 23 | Optional/build. Không được stage vào runtime, nhưng có thể chạy khi cài native dependency nên vẫn là rủi ro chuỗi cung ứng build | Root override toàn cây lên `tar 7.5.22` | `npm ls tar --all` chỉ còn `7.5.22`; `npm rebuild get-windows` đạt; Windows staging tests đạt; OSV không còn báo `tar` |
| `nanoid 3.3.17` / CVE-2026-67213 | 22 | Website-only | Nâng website override và lock lên `3.3.18` | Test lock semantic đạt; OSV không còn báo `nanoid` |
| `image-size 2.0.2` / CVE-2025-71329, 71330 | 3, 16 | Website build-only qua Docusaurus; không nằm trong Desktop, bootstrap hay runtime Python | Chưa có fixed version trong OSV; giữ lại và theo dõi | OSV còn đúng hai cảnh báo này, đều trỏ `website/package-lock.json`; Desktop `build.files` chỉ lấy `dist`, `assets`, `public`, `package.json` |

GitHub có 22 alert đang mở, dù số alert cao nhất là 23 vì số 21 không còn trong
tập hiện hành. Bảng trên phân loại đủ cả 22 alert; không dùng số thứ tự lớn nhất
làm số lượng.

## Nội dung gói Desktop

- Electron main/preload được bundle tự chứa; chỉ `node-pty` và `get-windows` được
  stage riêng dưới `dist/node_modules`.
- Bản stage của `get-windows` thay loader `node-pre-gyp` bằng resolver trực tiếp
  tới binding đã chọn, nên không mang `node-pre-gyp`, `cacache` hoặc `tar` vào
  runtime.
- Cấu hình electron-builder không sao chép cây `node_modules` chung.
- Sau build/pack, phải quét lại `app.asar`, `app.asar.unpacked` và thư mục
  resources để xác nhận không có package `tar`, `image-size` hoặc hồ sơ cá nhân.

## Hạn chế

- GitHub Code Scanning chỉ đóng alert sau khi commit được push và workflow OSV
  chạy; tại checkpoint cục bộ, bằng chứng là scan trực tiếp trên lockfile mới.
- Hai CVE `image-size` chưa có bản vá. Chúng không chặn Desktop v15 theo
  reachability hiện tại, nhưng vẫn chặn mọi tuyên bố rằng toàn repo sạch cảnh báo.
