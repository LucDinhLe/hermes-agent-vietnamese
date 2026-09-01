export interface SupportReportInput {
  architecture?: string | null
  displayName: string
  engineCommit: string
  engineVersion: string
  locale: string
  platform?: string | null
  productVersion: string
  technicalVersion: string
}

const PLATFORM_LABELS: Record<string, string> = {
  darwin: 'macOS',
  linux: 'Linux',
  macintel: 'macOS',
  win32: 'Windows',
  win64: 'Windows'
}

function cleanCoarseValue(value: string | null | undefined): string {
  if (!value) {
    return 'unknown'
  }

  const trimmed = value.trim()

  if (!trimmed || /[\\/]|@|\bUsers?\b|\bhome\b/i.test(trimmed)) {
    return 'unknown'
  }

  return trimmed.slice(0, 80)
}

export function buildSupportReport(input: SupportReportInput, now = new Date()): string {
  const rawPlatform = cleanCoarseValue(input.platform).toLowerCase()
  const platform = PLATFORM_LABELS[rawPlatform] ?? cleanCoarseValue(input.platform)
  const architecture = cleanCoarseValue(input.architecture)

  return [
    `${input.displayName} ${input.productVersion}`,
    `Edition version: ${input.technicalVersion}`,
    `Engine: Hermes Agent ${input.engineVersion} (${input.engineCommit.slice(0, 12)})`,
    `OS: ${platform} · Architecture: ${architecture}`,
    `UI language: ${cleanCoarseValue(input.locale)}`,
    `Reported at: ${now.toISOString()}`
  ].join('\n')
}
