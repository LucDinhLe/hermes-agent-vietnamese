/**
 * mac-bundle-symlinks.mjs — dọn liên kết mềm (symlink) trong .app trước khi ký.
 *
 * `codesign --verify --deep --strict` từ chối bundle có symlink trỏ ra ngoài bundle, trỏ bằng
 * đường dẫn tuyệt đối, hoặc trỏ tới đích không tồn tại ("invalid destination for symbolic link
 * in bundle"). Payload Python/Node đóng gói vào Resources có thể mang vài liên kết như vậy.
 *
 * Quy tắc:
 *   - đích tuyệt đối nhưng vẫn nằm trong bundle → viết lại thành liên kết tương đối
 *   - đích nằm ngoài bundle hoặc không tồn tại  → xoá liên kết (ghi log để biết là gì)
 * Thuần hàm trên hệ tệp, không phụ thuộc gì ngoài node:fs.
 */

import fs from 'node:fs'
import path from 'node:path'

export function normalizeBundleSymlinks(appDir, log = console.log) {
  const root = path.resolve(appDir)
  const fixed = []
  const removed = []

  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)

      if (entry.isSymbolicLink()) {
        const target = fs.readlinkSync(full)
        const resolved = path.resolve(path.dirname(full), target)
        const inside = resolved === root || resolved.startsWith(root + path.sep)
        const exists = fs.existsSync(resolved)

        if (!inside || !exists) {
          fs.unlinkSync(full)
          removed.push({ link: path.relative(root, full), target, reason: !inside ? 'ngoài bundle' : 'đích không tồn tại' })
        } else if (path.isAbsolute(target)) {
          const relative = path.relative(path.dirname(full), resolved)
          fs.unlinkSync(full)
          fs.symlinkSync(relative, full)
          fixed.push({ link: path.relative(root, full), from: target, to: relative })
        }
      } else if (entry.isDirectory()) {
        walk(full)
      }
    }
  }

  walk(root)

  for (const f of fixed) log(`[mac-symlinks] viết lại tương đối: ${f.link} (${f.from} → ${f.to})`)

  for (const r of removed) log(`[mac-symlinks] xoá: ${r.link} → ${r.target} (${r.reason})`)

  return { fixed, removed }
}
