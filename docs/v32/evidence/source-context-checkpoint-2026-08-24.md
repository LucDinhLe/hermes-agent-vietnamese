# V32 source receipt — context continuity checkpoint

Date: 2026-08-24 (Asia/Saigon)

Status: checkpoint evidence; final exact-candidate rerun remains required.

## Source state

- Branch: `feat/v32-token-context-ux`
- Implementation tip before the test changes:
  `ffa71a84065f9272bb65df28787fe80470f72558`
- Worktree: intentionally dirty with the regression and its test-only fixes.
- Provider/network: disabled; deterministic mock provider and isolated SQLite.

## Environment

- Windows NT `10.0.26200.0`, build `26200`, x64 OS/process.
- Python `3.11.15` from the repository `.venv`.
- Git `2.55.0.windows.3`.
- Pinned candidate Node runtime available: `26.5.1` x64. Node was not used by
  this Python source receipt.

## Canonical command

Python was invoked only through the repository test wrapper using Git Bash:

```text
scripts/run_tests.sh
  tests/run_agent/test_v32_long_context_continuity.py
  tests/run_agent/test_native_compaction.py
  tests/run_agent/test_codex_app_server_compaction.py
  tests/run_agent/test_413_compression.py
  tests/run_agent/test_in_place_compaction.py
  tests/run_agent/test_preflight_compression_cap_e2e.py
  tests/run_agent/test_compression_persistence.py
  tests/agent/test_context_compressor_summary_continuity.py
  tests/agent/test_error_classifier.py
  scripts/test_benchmark_v32_offline.py -q
```

## Result

- Exit code: `0`
- Duration: `79.1s`
- Files: `10`
- Passed: `246`
- Failed: `0`
- Retry/flaky pass: `0`
- Live calls/quota consumed: `0`

Component receipts:

- v32 >350k continuity: 1
- native compaction: 77
- Codex app-server compaction: 4
- 413/context recovery: 26
- in-place compaction: 10
- preflight compression cap E2E: 1
- compression persistence/relaunch: 12
- summary continuity: 9
- error classifier: 105
- offline benchmark contract: 1

## Behavioral proof

- Logical history is at least 350,000 rough-estimated tokens.
- The real `AIAgent.run_conversation` path compacts before provider wire exceeds
  the 208,000 local planning threshold.
- Compaction retains the exact task, Windows path, commit, context error and
  decision anchors.
- SQLite is closed and reopened to emulate relaunch; a fresh agent reloads the
  session and completes the next user turn with all anchors intact.
- A 100,000-character tool result is persisted before context recovery. Parent
  context receives a bounded `<persisted-output>` pointer; the artifact retains
  the exact full payload.
- Quota, billing, rate-limit, context overflow and provider failures remain
  distinct classifier outcomes.

## Final-lock rule

This receipt proves the implementation checkpoint. It must not be relabeled as
the immutable candidate receipt. After the final clean commit is frozen, the
same canonical group and the full source matrix must be rerun on that exact SHA.
