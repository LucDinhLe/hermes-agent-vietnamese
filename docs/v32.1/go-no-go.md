# Hermes Vietnamese v32.1 — quyết định phát hành

Ngày khóa rà soát source: 2026-08-27

## Quyết định

**Source GO, Release NO-GO** cho `vi-v0.32.1-2`.

Phần khắc phục yếu điểm v32 và cổng chống mất/ẩn phiên đã hoàn tất trong source.
Chưa được build, tag, stage, công khai hoặc thay GitHub Latest vì chưa có exact
lifecycle receipt trên installer cuối cùng.

## Source candidate

| Thuộc tính                | Giá trị                                    |
| ------------------------- | ------------------------------------------ |
| Branch                    | `integration/v32.1-project-session-safety` |
| Source hardening commit   | `f821cee6b644a67351a735e5dbc1ae82e045ba47` |
| Tag dự kiến               | `vi-v0.32.1-2`                             |
| Desktop version dự kiến   | `0.32.1-vi.2`                              |
| Release class             | `community-prerelease`                     |
| Phạm vi nghiệm thu/public | Windows 10/11 x64                          |

Commit trên là controller source đã kiểm thử, chưa phải exact candidate commit
cuối cùng nếu hồ sơ/descriptor còn cần một commit bổ sung trước khi tag.

## Gate đã đạt

- Hợp nhất UI adaptive capabilities và hotfix project/session trên cùng nhánh.
- Ẩn/Xóa Dự án chỉ tác động `projects.db`; regression source bảo vệ
  `state.db`, session rows và message rows.
- Project scope không tồn tại qua relaunch; có lối **Tất cả dự án**; dự án đang
  mở giữ hàng Dự án và nút xổ xuống hiển thị đủ cây phiên.
- Repo scan, auto archive và auto prune tắt mặc định.
- Exact lifecycle harness thêm gate `projectSessionSafety`: hash nội dung và số
  hàng trước/sau Ẩn/Xóa, relaunch, tìm và tiếp tục phiên.
- `vi-v0.32.1-2` chỉ dựng Windows x64; Authenticode được ghi rõ `NotSigned`,
  không có signer certificate và không được quảng cáo stable/final.
- Promotion riêng kiểm tag/commit/size/SHA-256, private draft, staging run,
  lifecycle run, evidence seal và tự rollback về v32 nếu hậu kiểm lỗi.
- Gate hiện tại: policy 18/18; release/metadata 38/38; promotion validator 3/3;
  workflow contract 16/16; typecheck, lint 0 error, Prettier, YAML, PowerShell và
  diff check đều đạt.

## Gate còn thiếu

1. GitHub CLI đăng nhập lại; đẩy exact source branch và tạo tag bất biến.
2. Một lượt build duy nhất của Windows x64 từ exact tag.
3. Ghi size/SHA-256, xác minh trạng thái `NotSigned` và private draft đúng byte.
4. Exact lifecycle trên GitHub-hosted Windows VM dùng một lần, gồm update
   v32→v32.1, project/session safety, repair, uninstall và rollback vi39.
5. Controller commit cập nhật `.github/public-release.json` bằng exact
   size/hash; promotion chỉ chạy sau khi người sở hữu cho phép hành động public.

## Dữ liệu và an toàn người dùng

- Không cài candidate lên profile Hermes thật.
- Không sửa, di chuyển hay dọn `%LOCALAPPDATA%\hermes` của Đại ca.
- Không tải phiên, dự án hoặc bản sao lưu lên cloud Hermes.
- Mọi nghiệm thu ghi dữ liệu chỉ chạy trong profile/máy ảo dùng một lần.

## Rủi ro còn lại

1. Installer chưa ký có thể bị SmartScreen hoặc Smart App Control cảnh báo/chặn;
   người dùng phải được báo rõ và không được hướng dẫn tắt bảo vệ toàn máy.
2. Chưa có lifecycle receipt nên chưa được tuyên bố lỗi hiển thị/mất phiên đã
   hết trên installer cuối cùng, dù source regression đã đạt.
3. GitHub auth hiện không hợp lệ; không có remote branch/tag/draft để bên thứ ba
   tiếp quản hoặc chạy CI.
4. v32 public hiện vẫn unsigned; giữ nguyên làm previous/rollback publication
   cho tới khi v32.1 vượt đủ gate.

## Rollback

- Nếu promotion v32.1 hậu kiểm lỗi: trả `vi-v0.32.1-2` về draft/prerelease và
  khôi phục `vi-v0.32.0-1` làm GitHub Latest.
- Rollback cài đặt đã khóa cho lifecycle: `vi-v0.20.4-39`, commit
  `d270974d2651e72f169fffe34c955eeae7977458`, SHA-256
  `e4e0b60d7821b0e72af7b79e745b723c035f588c49bb11782778214a3e0c6d31`.

## Hành động public

Chưa có. Không push, tag, build, stage, publish hoặc đổi Latest trong lượt khóa
source này.

## Bước nhỏ nhất tiếp theo

Đăng nhập lại GitHub, freeze exact tag, build đúng một lần, chạy lifecycle và
chỉ promotion khi mọi receipt đều xanh.
