export function normalizeBrowserAddress(raw: string): string | null {
  const value = raw.trim()

  if (!value) {
    return null
  }

  const withProtocol = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:[/?#]|$)/i.test(value)
    ? `http://${value}`
    : /^[a-z][a-z\d+.-]*:/i.test(value)
      ? value
      : `https://${value}`

  try {
    const url = new URL(withProtocol)

    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}
