# Hermes Vietnamese V33 shell

Kho này chứa **lớp sản phẩm tiếng Việt**, không chứa một bản fork khác của động
cơ Hermes. Upstream được khóa bằng tag + commit trong `engine.lock.json`; script
materialize dựng một worktree dùng một lần, áp đúng overlay và patch đã khai báo,
rồi ghi receipt SHA để build/test đúng cây đó.

## Kiểm tra source và build chẩn đoán local

Yêu cầu: Node.js `>=22.22`, npm, Git và một checkout có object tag được khóa
trong `engine.lock.json`.

```powershell
cd "C:\Users\AUS-PRO\OneDrive\Tài liệu\Tom\projects\hermes-vietnamese-shell"
$shellRoot = (Get-Location).Path
$shellCommit = git rev-parse HEAD
npm test
npm run verify
npm run materialize -- --engine-dir "C:\Users\AUS-PRO\OneDrive\Tài liệu\Tom\projects\hermes-v33-work"
```

Cây đã dựng nằm ở `.work/engine-<12-ký-tự-commit>` và đường dẫn thật được script
in ra. Từ đó chạy gate upstream, rồi build đúng một lần:

```powershell
cd ".work\engine-<12-ký-tự-commit>"
npm ci
npm run typecheck --workspace apps/desktop
Push-Location apps/desktop
npm exec -- vitest run --project ui src/i18n/vi-community.test.ts src/plugins/hermes-vietnamese/plugin.test.tsx src/plugins/hermes-vietnamese/support-report.test.ts
npm exec -- vitest run --project electron electron/vietnamese-identity-migration.test.ts --maxWorkers=1
Pop-Location
npm run check:test:plugins --workspace apps/desktop
node "$shellRoot\scripts\verify-materialized-tree.mjs" --tree (Get-Location).Path --shell-commit $shellCommit --require-clean-shell
npm run build --workspace apps/desktop
```

Đây là build chẩn đoán có `releaseMode: false`, chưa phải installer và chưa được
phép phát hành. Hai full suite `test:ui` và `test:desktop:platforms` vẫn phải chạy
ở gate candidate/baseline, nhưng hiện có lỗi nền upstream được ghi riêng trong
`docs/UPSTREAM-BASELINE.md`; chúng không được đổi thành xanh giả để phục vụ build
chẩn đoán. **Không launch build này trên máy đang cài Hermes thật**: dù đổi cả
hai data root, upstream vẫn đăng ký handler `hermes://` ở mức hệ điều hành và có
thể ghi đè protocol của bản đang dùng. Smoke launch chỉ được chạy trong Windows
Sandbox/VM dùng một lần cho tới khi có seam tắt protocol registration được test
fail-closed.

## Dựng candidate sau khi đã push

Candidate phải dùng một output mới và `--release`. Chế độ này từ chối shell bẩn,
commit chỉ có ở máy local, remote sai kho, hoặc remote đã đổi head kể từ lần
fetch. Chạy toàn bộ gate source trước, sau đó build **một lần** và đóng gói đúng
output đó:

```powershell
$shellRoot = (Get-Location).Path
$shellCommit = git rev-parse HEAD
$candidateRoot = Join-Path $shellRoot ".work\candidate-<commit>"
npm run materialize -- --engine-dir "C:\duong-dan\hermes-upstream" --output $candidateRoot --release
Set-Location $candidateRoot
npm ci
npm run typecheck --workspace apps/desktop
npm run test:ui --workspace apps/desktop
npm run test:desktop:platforms --workspace apps/desktop
npm run check:test:plugins --workspace apps/desktop
node "$shellRoot\scripts\verify-materialized-tree.mjs" --tree $candidateRoot --shell-commit $shellCommit --require-clean-shell
npm run build --workspace apps/desktop
npm run builder --workspace apps/desktop -- --dir --publish never
Set-Location $shellRoot
npm run verify:provenance -- --resources "$candidateRoot\apps\desktop\release\win-unpacked\resources" --shell-commit $shellCommit --require-release
```

Không chạy `pack` hoặc `dist:*` sau `build`, vì các script upstream đó tự build
lại và viết lại build stamp. NSIS/lifecycle/rollback vẫn là gate riêng trên
profile dùng một lần; builder thành công không đồng nghĩa được phép phát hành.

## Nâng lõi về tag upstream mới

Sau khi fetch tag upstream vào checkout động cơ, một lệnh sẽ xác minh tag chú
thích, đọc đúng version, thử áp tuần tự toàn bộ core patch, rồi cập nhật cả lock
và provenance của patch. Metadata mà người dùng nhìn thấy cũng được lấy từ cùng
một kết quả đã xác minh, nên trang hỗ trợ không thể âm thầm báo phiên bản lõi
cũ:

```powershell
npm run engine:update -- --engine-dir "C:\duong-dan\hermes-upstream" --tag vYYYY.M.D
npm test
npm run verify
```

Thêm `--dry-run` để kiểm tra mà không sửa lock. Cả chế độ này vẫn cần truy cập
remote chính thức: updater đối chiếu live cả object của annotated tag lẫn commit
được peel, nên một tag tự tạo trong fork/local không thể mang provenance của
NousResearch. Workflow Windows x64 đọc tag trực tiếp từ lock, materialize cây
sạch và chạy typecheck, lint, renderer, Electron, plugin cùng build; workflow
không publish release.

Lệnh cập nhật chỉ tạo một thay đổi có thể review; nó không tự biến thay đổi đó
thành release. Sau mỗi tag mới vẫn phải đọc diff, chạy gate và ghi baseline mới
cho các lỗi upstream nếu có.

## Ranh giới bảo trì

- `edition/vietnamese/overlay/`: tệp do bản Việt sở hữu, gồm locale và bundled
  desktop plugin.
- `patches/series.json`: sổ mọi chỉnh sửa bắt buộc vào file upstream; mỗi patch
  phải có lý do, đường dẫn, test và điều kiện gỡ bỏ.
- `scripts/materialize-vietnamese.mjs`: từ chối tag/SHA sai, output có sẵn,
  mọi đường dẫn ngoài `apps/desktop/`, alias nguy hiểm trên Windows và thay đổi
  nguồn xảy ra giữa lúc materialize.
- `apps/desktop/build/edition-receipt.json` trong cây dựng: bằng chứng liên kết
  engine, shell, overlay và patch SHA. Receipt được đóng cùng install stamp vào
  resources; `verify:provenance` đối chiếu cả bản build và bản đã đóng gói.

Danh tính cài đặt độc lập đã được đặt trước nhưng còn khóa. Không đổi `appId`,
protocol hay data root cho tới khi migration và rollback đã qua lifecycle trên
profile dùng một lần.
