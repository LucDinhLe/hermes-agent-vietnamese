// Cờ tính năng của vỏ Hermes Vietnamese cho những phần giao diện cần route
// mà lõi Hermes Agent nguyên bản (engine.lock) không có. Mặc định TẮT.
// Bật lúc build: VITE_VI_FEATURES=work-profile,mcp-assignments
// Bản thử nghiệm 2 sẽ cấp các route này qua plugin, khi đó bật cờ lại.
//
// Sổ ghi: docs/patch-ledger.md (nhóm YELLOW), docs/parity-scan.md.

export type ViFeature =
  | 'work-profile' // /api/skills/work-profile*, /api/skills/discover
  | 'mcp-assignments' // /api/mcp/assignments
  | 'advisor' // gateway config.set key=advisor, task 'advisor' trong /api/models/auxiliary (Advisor riêng của fork)

const raw: string = (import.meta.env?.VITE_VI_FEATURES as string | undefined) ?? ''

const enabled = new Set(
  raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
)

export function viFeature(name: ViFeature): boolean {
  return enabled.has(name)
}
