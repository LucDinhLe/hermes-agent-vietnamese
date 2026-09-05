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
  const m = release.macosArm64
  const l = release.linuxX64
  const deb = l?.deb
  const compat = w.compatibilityFilename
  const update = release.updateFeedEnabled
    ? 'Ứng dụng báo khi có bản mới kèm SHA-256, không tự tải hay tự cài.'
    : 'Cập nhật thủ công bằng bộ cài đầy đủ, không có cập nhật tự động nền.'
  const platforms = ['Windows x64', ...(m ? ['macOS Apple Silicon'] : []), ...(l ? ['Linux x64'] : [])]
  const platformList = platforms.length === 1 ? platforms[0] : `${platforms.slice(0, -1).join(', ')} và ${platforms[platforms.length - 1]}`
  const signing = `Windows chưa ký số${m ? ', macOS ký ad-hoc' : ''}${l ? ', Linux không có cơ chế ký' : ''}`
  const macNote = m
    ? ` Trên macOS, lần mở đầu vào **System Settings → Privacy & Security** bấm **Open Anyway**; nếu báo "damaged", chạy \`xattr -cr /Applications/HermesVietnamese.app\`.`
    : ''
  const linuxNote = l ? ` Trên Linux, cấp quyền chạy cho AppImage (\`chmod +x\`)${deb ? ' hoặc cài gói deb' : ''}.` : ''

  // Dòng liệt kê từng tệp cho README.vi và hướng dẫn cài
  const items = [
    `- Windows x64: [${w.filename}](${dl(w.filename)}), **${w.size} byte**, SHA-256 \`${w.sha256}\`.`,
    ...(compat ? [`- Cùng bộ cài Windows với tên tương thích cũ: [${compat}](${dl(compat)}). Chỉ chạy một bộ cài.`] : []),
    ...(m ? [`- macOS Apple Silicon (M1 trở lên): [${m.filename}](${dl(m.filename)}), **${m.size} byte**, SHA-256 \`${m.sha256}\`.`] : []),
    ...(l ? [`- Linux x64 AppImage: [${l.filename}](${dl(l.filename)}), **${l.size} byte**, SHA-256 \`${l.sha256}\`.`] : []),
    ...(deb ? [`- Linux x64 gói deb (Ubuntu/Debian): [${deb.filename}](${dl(deb.filename)}), **${deb.size} byte**, SHA-256 \`${deb.sha256}\`.`] : []),
    `- [SHA256SUMS.txt](${dl('SHA256SUMS.txt')}) gom mã kiểm tra của mọi tệp.`
  ].join('\n')

  const tableRows = [
    `| Windows x64 | [${w.filename}](${dl(w.filename)}) | ${w.size} | \`${w.sha256}\` |`,
    ...(compat ? [`| Windows x64, tên tương thích cũ | [${compat}](${dl(compat)}) | ${w.size} | \`${w.sha256}\` |`] : []),
    ...(m ? [`| macOS Apple Silicon | [${m.filename}](${dl(m.filename)}) | ${m.size} | \`${m.sha256}\` |`] : []),
    ...(l ? [`| Linux x64 AppImage | [${l.filename}](${dl(l.filename)}) | ${l.size} | \`${l.sha256}\` |`] : []),
    ...(deb ? [`| Linux x64 deb | [${deb.filename}](${dl(deb.filename)}) | ${deb.size} | \`${deb.sha256}\` |`] : []),
    `| Mã kiểm tra toàn vẹn | [SHA256SUMS.txt](${dl('SHA256SUMS.txt')}) | | |`
  ].join('\n')

  const readmeLinks = [
    `**[Tải cho Windows x64](${dl(w.filename)})**`,
    ...(m ? [`**[Tải cho macOS Apple Silicon](${dl(m.filename)})**`] : []),
    ...(l ? [`**[Tải cho Linux x64 (AppImage)](${dl(l.filename)})**`] : []),
    '[Hướng dẫn cài đặt và kết nối](README.vi.md)'
  ].join(' · ')

  const readmeDetails = [
    `Bộ cài Windows \`${w.filename}\` có kích thước **${w.size} byte**, SHA-256 \`${w.sha256}\`.${compat ? ` Tệp [${compat}](${dl(compat)}) có cùng nội dung và mã kiểm tra, chỉ cần tải một trong hai.` : ''}`,
    ...(m ? [`Bản macOS \`${m.filename}\` có kích thước **${m.size} byte**, SHA-256 \`${m.sha256}\`.`] : []),
    ...(l ? [`Bản Linux \`${l.filename}\` có kích thước **${l.size} byte**, SHA-256 \`${l.sha256}\`.${deb ? ` Gói [${deb.filename}](${dl(deb.filename)}) có kích thước **${deb.size} byte**, SHA-256 \`${deb.sha256}\`.` : ''}`] : []),
    `Đối chiếu với [SHA256SUMS.txt](${dl('SHA256SUMS.txt')}) của cùng bản phát hành.`
  ].join('\n\n')

  return {
    'README.md': `> **Bản tải mặc định/Latest: [Hermes Vietnamese ${release.version}](${tagUrl})** là **community pilot công khai, chưa phải stable**, dành cho ${platformList}. ${signing}. ${update}${macNote}${linuxNote}

| Máy đang dùng | Tải trực tiếp | Kích thước | SHA-256 |
| --- | --- | --- | --- |
| Windows 10/11, chip x64 | [Bộ cài x64](${dl(w.filename)})${compat ? ` · [tên tương thích cũ](${dl(compat)})` : ''} | ${w.size} byte | \`${w.sha256}\` |
${m ? `| macOS 12+, Apple Silicon (M1 trở lên) | [DMG](${dl(m.filename)}) | ${m.size} byte | \`${m.sha256}\` |\n` : ''}${l ? `| Linux x64 | [AppImage](${dl(l.filename)})${deb ? ` · [DEB](${dl(deb.filename)})` : ''} | ${l.size} byte${deb ? ` · ${deb.size} byte` : ''} | \`${l.sha256}\`${deb ? `<br>\`${deb.sha256}\`` : ''} |\n` : ''}
Đối chiếu mã với [SHA256SUMS.txt](${dl('SHA256SUMS.txt')}) của cùng bản phát hành trước khi chạy.`,
    'README.vi.md': `**Latest hiện tại là [${release.version}](${tagUrl}), dành cho ${platformList}.** Bản community pilot chưa phải stable; ${signing}. ${update}${macNote}${linuxNote}

${items}`,
    'docs/cai-dat-windows-bang-anh.md': `Latest là [${release.version}](${tagUrl}), community pilot chưa phải stable; ${signing}. ${update}

${items}`,
    '.github/release-notes-vietnamese.md': `> **Latest hiện tại là [${release.version}](${tagUrl}), dành cho ${platformList}.** Đây là community pilot chưa phải stable; ${signing}. ${update}${macNote}${linuxNote}

| Nền tảng | Tải xuống | Kích thước (byte) | SHA-256 |
| --- | --- | --- | --- |
${tableRows}`
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
