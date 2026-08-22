export const CONNECTOR_PROTOCOL = 'hermes-cookie-transfer/1'

export function cookiePermissionOrigins(url) {
  const { hostname } = new URL(url)
  return [`http://${hostname}/*`, `https://${hostname}/*`]
}

export function revocableCookiePermissionOrigins(url) {
  const parsed = new URL(url)
  return [...new Set([...cookiePermissionOrigins(parsed), `${parsed.origin}/*`])]
}

export async function hasAnyPermissionOrigin(permissionsApi, origins) {
  const grants = await Promise.all(origins.map(origin => permissionsApi.contains({ origins: [origin] })))
  return grants.some(Boolean)
}

export async function revokeCookiePermissions(permissionsApi, { origins, transportOrigins = [] }) {
  let failed = false

  for (const origin of origins) {
    let present
    try {
      present = await permissionsApi.contains({ origins: [origin] })
    } catch {
      present = true
    }

    if (!present) continue
    try {
      await permissionsApi.remove({ origins: [origin] })
    } catch {
      // A concurrent revoke can still satisfy the post-condition below.
    }
  }

  for (const origin of origins) {
    try {
      if (await permissionsApi.contains({ origins: [origin] })) failed = true
    } catch {
      failed = true
    }
  }

  let remainingOrigins
  try {
    const current = await permissionsApi.getAll()
    remainingOrigins = current.origins || []
  } catch {
    failed = true
  }

  if (remainingOrigins?.every(origin => transportOrigins.includes(origin))) {
    let present
    try {
      present = await permissionsApi.contains({ permissions: ['cookies'] })
    } catch {
      present = true
    }

    if (present) {
      try {
        await permissionsApi.remove({ permissions: ['cookies'] })
      } catch {
        // A concurrent revoke can still satisfy the post-condition below.
      }
    }

    try {
      if (await permissionsApi.contains({ permissions: ['cookies'] })) failed = true
    } catch {
      failed = true
    }
  }

  if (failed) throw new Error('COOKIE_PERMISSION_REVOKE_FAILED')
}

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
