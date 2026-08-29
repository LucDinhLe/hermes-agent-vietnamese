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
  candidateExit,
  upstreamRuns
}) {
  const candidateFailures = parseVitestFailures(candidateLog)
  const candidateComplete = hasCompleteVitestSummary(candidateLog)
  const normalizedUpstreamRuns = upstreamRuns.map(({ log, exitCode }) => ({
    exitCode,
    complete: hasCompleteVitestSummary(log),
    logSha256: sha256(log),
    failures: parseVitestFailures(log)
  }))
  const upstreamFailures = [...new Set(normalizedUpstreamRuns.flatMap((run) => run.failures))].sort()
  const upstreamFailureSet = new Set(upstreamFailures)
  const additionalFailures = candidateFailures.filter((failure) => !upstreamFailureSet.has(failure))
  const upstreamComplete = normalizedUpstreamRuns.every((run) => run.complete)
  const upstreamUnparseable = normalizedUpstreamRuns.some(
    (run) => run.exitCode !== 0 && run.failures.length === 0
  )
  const everyUpstreamRunPassed = normalizedUpstreamRuns.every((run) => run.exitCode === 0)

  let allowed = false
  let reason

  if (candidateExit === 0 && candidateComplete) {
    allowed = true
    reason = 'candidate-electron-suite-passed'
  } else if (!candidateComplete) {
    reason = 'candidate-log-incomplete'
  } else if (candidateFailures.length === 0) {
    reason = 'candidate-failed-without-parseable-test-identities'
  } else if (!upstreamComplete) {
    reason = 'upstream-log-incomplete'
  } else if (upstreamUnparseable) {
    reason = 'upstream-failed-without-parseable-test-identities'
  } else if (everyUpstreamRunPassed) {
    reason = 'candidate-failed-while-pristine-upstream-passed'
  } else if (additionalFailures.length > 0) {
    reason = 'candidate-introduced-electron-failures'
  } else {
    allowed = true
    reason = 'candidate-failures-contained-by-pristine-upstream-controls'
  }

  return {
    schemaVersion: 2,
    allowed,
    reason,
    candidate: {
      exitCode: candidateExit,
      complete: candidateComplete,
      logSha256: sha256(candidateLog),
      failures: candidateFailures
    },
    upstream: {
      complete: upstreamComplete,
      runs: normalizedUpstreamRuns,
      failures: upstreamFailures
    },
    additionalFailures
  }
}

export function parseCli(argv) {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error(`Invalid argument near ${key ?? '<end>'}`)
    }
    const normalizedKey = key.slice(2)
    values.set(normalizedKey, [...(values.get(normalizedKey) ?? []), value])
  }

  for (const required of ['candidate-log', 'candidate-exit', 'upstream-log', 'upstream-exit', 'output']) {
    if (!values.has(required)) throw new Error(`Missing --${required}`)
  }

  const candidateExit = Number(values.get('candidate-exit')[0])
  const upstreamLogs = values.get('upstream-log')
  const upstreamExits = values.get('upstream-exit').map(Number)
  if (!Number.isInteger(candidateExit) || upstreamExits.some((value) => !Number.isInteger(value))) {
    throw new Error('Exit codes must be integers')
  }
  if (upstreamLogs.length !== upstreamExits.length) {
    throw new Error('Each --upstream-log requires one --upstream-exit')
  }

  return {
    candidateLogPath: values.get('candidate-log')[0],
    candidateExit,
    upstreamRuns: upstreamLogs.map((logPath, index) => ({
      logPath,
      exitCode: upstreamExits[index]
    })),
    outputPath: values.get('output')[0]
  }
}

function main() {
  const options = parseCli(process.argv.slice(2))
  const result = compareElectronBaseline({
    candidateLog: readFileSync(options.candidateLogPath, 'utf8'),
    candidateExit: options.candidateExit,
    upstreamRuns: options.upstreamRuns.map(({ logPath, exitCode }) => ({
      log: readFileSync(logPath, 'utf8'),
      exitCode
    }))
  })

  writeFileSync(options.outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  console.log(`[electron-baseline] ${result.reason}`)
  console.log(`[electron-baseline] candidate failures: ${result.candidate.failures.length}; upstream controls: ${result.upstream.runs.length}; upstream union: ${result.upstream.failures.length}; additional: ${result.additionalFailures.length}`)
  for (const failure of result.additionalFailures) console.error(`[electron-baseline] additional: ${failure}`)
  if (!result.allowed) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
