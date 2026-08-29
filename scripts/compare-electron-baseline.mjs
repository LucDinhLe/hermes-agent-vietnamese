import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const ANSI_PATTERN = /\x1B\[[0-?]*[ -/]*[@-~]/g
const TEST_FILE_PATTERN = /((?:electron|scripts)[\\/][^\s]+\.test\.(?:ts|mjs))/

function normalizeLog(log) {
  return log.replace(ANSI_PATTERN, '').replaceAll('\\', '/')
}

export function parseVitestFailures(log) {
  const failures = new Set()

  for (const rawLine of normalizeLog(log).split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!/\bFAIL\b/.test(line)) continue

    const fileMatch = line.match(TEST_FILE_PATTERN)
    if (!fileMatch) continue

    const file = fileMatch[1]
    const suffix = line.slice((fileMatch.index ?? 0) + fileMatch[0].length)
    const separator = suffix.indexOf(' > ')
    const testName = separator >= 0
      ? suffix.slice(separator + 3).replace(/\s+/g, ' ').trim()
      : '<file-level failure>'

    failures.add(`${file} > ${testName || '<unnamed failure>'}`)
  }

  return [...failures].sort()
}

export function hasCompleteVitestSummary(log) {
  const normalized = normalizeLog(log)
  return /\bTest Files\b/.test(normalized) && /^\s*Tests\s+/m.test(normalized)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function compareElectronBaseline({
  candidateLog,
  upstreamLog,
  candidateExit,
  upstreamExit
}) {
  const candidateFailures = parseVitestFailures(candidateLog)
  const upstreamFailures = parseVitestFailures(upstreamLog)
  const candidateComplete = hasCompleteVitestSummary(candidateLog)
  const upstreamComplete = hasCompleteVitestSummary(upstreamLog)
  const upstreamFailureSet = new Set(upstreamFailures)
  const additionalFailures = candidateFailures.filter((failure) => !upstreamFailureSet.has(failure))

  let allowed = false
  let reason

  if (candidateExit === 0 && candidateComplete) {
    allowed = true
    reason = 'candidate-electron-suite-passed'
  } else if (!candidateComplete) {
    reason = 'candidate-log-incomplete'
  } else if (candidateFailures.length === 0) {
    reason = 'candidate-failed-without-parseable-test-identities'
  } else if (upstreamExit === 0) {
    reason = 'candidate-failed-while-pristine-upstream-passed'
  } else if (!upstreamComplete) {
    reason = 'upstream-log-incomplete'
  } else if (upstreamFailures.length === 0) {
    reason = 'upstream-failed-without-parseable-test-identities'
  } else if (additionalFailures.length > 0) {
    reason = 'candidate-introduced-electron-failures'
  } else {
    allowed = true
    reason = 'candidate-failures-contained-by-pristine-upstream-baseline'
  }

  return {
    schemaVersion: 1,
    allowed,
    reason,
    candidate: {
      exitCode: candidateExit,
      complete: candidateComplete,
      logSha256: sha256(candidateLog),
      failures: candidateFailures
    },
    upstream: {
      exitCode: upstreamExit,
      complete: upstreamComplete,
      logSha256: sha256(upstreamLog),
      failures: upstreamFailures
    },
    additionalFailures
  }
}

function parseCli(argv) {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error(`Invalid argument near ${key ?? '<end>'}`)
    }
    values.set(key.slice(2), value)
  }

  for (const required of ['candidate-log', 'candidate-exit', 'upstream-log', 'upstream-exit', 'output']) {
    if (!values.has(required)) throw new Error(`Missing --${required}`)
  }

  const candidateExit = Number(values.get('candidate-exit'))
  const upstreamExit = Number(values.get('upstream-exit'))
  if (!Number.isInteger(candidateExit) || !Number.isInteger(upstreamExit)) {
    throw new Error('Exit codes must be integers')
  }

  return {
    candidateLogPath: values.get('candidate-log'),
    candidateExit,
    upstreamLogPath: values.get('upstream-log'),
    upstreamExit,
    outputPath: values.get('output')
  }
}

function main() {
  const options = parseCli(process.argv.slice(2))
  const result = compareElectronBaseline({
    candidateLog: readFileSync(options.candidateLogPath, 'utf8'),
    upstreamLog: readFileSync(options.upstreamLogPath, 'utf8'),
    candidateExit: options.candidateExit,
    upstreamExit: options.upstreamExit
  })

  writeFileSync(options.outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(`[electron-baseline] ${result.reason}`)
  console.log(`[electron-baseline] candidate failures: ${result.candidate.failures.length}; upstream failures: ${result.upstream.failures.length}; additional: ${result.additionalFailures.length}`)
  for (const failure of result.additionalFailures) console.error(`[electron-baseline] additional: ${failure}`)
  if (!result.allowed) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
