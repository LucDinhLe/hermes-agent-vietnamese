// render-current-release.mjs — ghi lại khối <!-- current-release:start/end --> trong các
// tài liệu công khai từ .github/public-release.json, để workflow kênh chính cập nhật
// README/hướng dẫn/ghi chú phát hành cùng một lần với feed, và check-public-docs.mjs
// luôn xanh. Chạy: node scripts/render-current-release.mjs [--check]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPO = 'LucDinhLe/hermes-agent-vietnamese'

export function renderBlocks(release) {
  const base = `https://github.com/${REPO}/releases`
  const tagUrl = `${base}/tag/${release.tag}`
  const dl = name => `${base}/download/${release.tag}/${name}`
  const w = release.windowsX64
  const [exe, compat] = release.downloadFiles
  const update = release.updateFeedEnabled
    ? 'Ứng dụng báo khi có bản mới kèm SHA-256, không tự tải hay tự cài.'
    : 'Cập nhật thủ công bằng bộ cài đầy đủ, không có cập nhật tự động nền.'

  return {
    'README.md': `> **Bản tải mới nhất là [${release.version}](${tagUrl}), dành cho Windows x64.** Đây là bản dùng thử cộng đồng (community pilot), chưa ký số và chưa phải stable. Windows có thể hiển thị cảnh báo khi tải hoặc cài. Chưa có bộ cài cho macOS, Linux hoặc Windows ARM64 trong bản phát hành này.

**[Tải bộ cài Windows x64](${dl(exe)})** · [Hướng dẫn cài đặt và kết nối](README.vi.md)

<details>
<summary>Kiểm tra tệp tải về</summary>

Bộ cài \`${exe}\` có kích thước **${w.size} byte**. Đối chiếu mã SHA-256 với [SHA256SUMS.txt](${dl('SHA256SUMS.txt')}):

\`\`\`text
${w.sha256}
\`\`\`

[Tệp tải thay thế ${compat}](${dl(compat)}) có cùng nội dung và mã kiểm tra. Chỉ cần tải một trong hai tệp.

</details>`,
    'README.vi.md': `**Latest hiện tại là [${release.version}](${tagUrl}), chỉ dành cho Windows x64.** Bản community pilot chưa ký số, chưa phải stable. ${update}

- [${exe}](${dl(exe)}).
- [${compat}](${dl(compat)}), cùng nội dung với tên tương thích cũ. Chỉ chạy một bộ cài.
- [SHA256SUMS.txt](${dl('SHA256SUMS.txt')}).

Hai tệp \`.exe\` đều có kích thước **${w.size} byte**, SHA-256:

\`\`\`text
${w.sha256}
\`\`\``,
    'docs/cai-dat-windows-bang-anh.md': `Latest là [${release.version}](${tagUrl}), community pilot Windows x64 chưa ký số, chưa phải stable.

1. Tải [${exe}](${dl(exe)}).
2. Tên tương thích [${compat}](${dl(compat)}) có cùng nội dung. Chỉ chạy một tệp.
3. Đối chiếu [SHA256SUMS.txt](${dl('SHA256SUMS.txt')}) của cùng bản phát hành.

Hai bộ cài có kích thước **${w.size} byte**, SHA-256 \`${w.sha256}\`. ${update}`,
    '.github/release-notes-vietnamese.md': `> **Latest hiện tại là [${release.version}](${tagUrl}), chỉ phát hành Windows x64.** Đây là community pilot chưa ký số, chưa phải stable. ${update}

| Tệp | Tải xuống |
| --- | --- |
| Bộ cài Windows x64 | [${exe}](${dl(exe)}) |
| Cùng bộ cài, tên tương thích đường tải cũ | [${compat}](${dl(compat)}) |
| Mã kiểm tra toàn vẹn | [SHA256SUMS.txt](${dl('SHA256SUMS.txt')}) |

Chỉ tải **một** trong hai tệp \`.exe\`. Cả hai có cùng nội dung, kích thước **${w.size} byte** và SHA-256:

\`\`\`text
${w.sha256}
\`\`\``
  }
}

const BLOCK_RE = /<!-- current-release:start -->[\s\S]*?<!-- current-release:end -->/

export function applyBlocks(release, readFile, writeFile) {
  const blocks = renderBlocks(release)
  const changed = []

  for (const file of release.documentationFiles) {
    const block = blocks[file]

    if (!block) {
      throw new Error(`render-current-release: không có mẫu cho ${file}`)
    }

    const text = readFile(file)

    if (!BLOCK_RE.test(text)) {
      throw new Error(`${file}: thiếu khối current-release`)
    }

    // Tiêu đề ghi chú phát hành mang số bản
    let next = text.replace(BLOCK_RE, `<!-- current-release:start -->\n${block}\n<!-- current-release:end -->`)

    if (file === '.github/release-notes-vietnamese.md') {
      next = next.replace(/^# Hermes Vietnamese \d{4}\.\d+\.\d+/m, `# Hermes Vietnamese ${release.version}`)
    }

    if (next !== text) {
      writeFile(file, next)
      changed.push(file)
    }
  }

  return changed
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const release = JSON.parse(fs.readFileSync(path.join(ROOT, '.github', 'public-release.json'), 'utf8'))
  const check = process.argv.includes('--check')
  const pending = []
  const changed = applyBlocks(
    release,
    f => fs.readFileSync(path.join(ROOT, f), 'utf8'),
    (f, t) => (check ? pending.push(f) : fs.writeFileSync(path.join(ROOT, f), t))
  )

  if (check && pending.length) {
    console.error(`[render-current-release] tài liệu lệch feed: ${pending.join(', ')}`)
    process.exit(1)
  }

  console.log(`[render-current-release] ${check ? 'khớp' : 'đã ghi'}: ${(check ? [] : changed).join(', ') || 'không đổi'}`)
}
