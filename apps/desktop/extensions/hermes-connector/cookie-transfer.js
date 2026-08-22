export const CONNECTOR_PROTOCOL = 'hermes-cookie-transfer/1'

function toTransferCookie(cookie) {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    hostOnly: cookie.hostOnly,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    session: cookie.session,
    ...(cookie.expirationDate === undefined ? {} : { expirationDate: cookie.expirationDate }),
    sameSite: cookie.sameSite,
    storeId: cookie.storeId,
    ...(cookie.partitionKey == null ? {} : { partitionKey: cookie.partitionKey })
  }
}

function summarizeCookies(cookies, { url, userAgent, nowMs }) {
  const now = nowMs / 1000
  const unsupported = cookies.filter(item => item.partitionKey != null)
  const expired = cookies.filter(item => item.partitionKey == null && !item.session && item.expirationDate <= now)
  const importable = cookies.filter(item => item.partitionKey == null && (item.session || item.expirationDate > now))
  const expiries = importable.filter(item => !item.session).map(item => item.expirationDate)

  return {
    importable,
    preview: {
      protocol: CONNECTOR_PROTOCOL,
      browser: userAgent.includes('Edg/') ? 'edge' : 'chrome',
      hostname: new URL(url).hostname.toLowerCase(),
      cookieCount: importable.length,
      unsupportedCount: unsupported.length,
      expiredCount: expired.length,
      sessionCount: importable.filter(item => item.session).length,
      ...(expiries.length > 0 ? { earliestExpiry: Math.min(...expiries), latestExpiry: Math.max(...expiries) } : {})
    }
  }
}

export async function readCookieTransferPreview(cookiesApi, { url, storeId, userAgent, nowMs = Date.now() }) {
  // Chrome otherwise defaults cookie API calls to the unpartitioned jar. An
  // explicit empty key observes both jars so unsupported partitioned cookies
  // remain visible in the consent count. Let failures surface rather than
  // silently falling back to an incomplete preview.
  const sourceCookies = await cookiesApi.getAll({ url, storeId, partitionKey: {} })

  return summarizeCookies(sourceCookies.map(toTransferCookie), { url, userAgent, nowMs })
}
