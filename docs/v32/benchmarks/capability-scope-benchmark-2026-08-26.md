# Hermes v32.1 offline capability-scope benchmark

Date: 2026-08-26

Source checkpoint: the commit containing this evidence

Profile: isolated copy under repository `.tmp/`; never the real Hermes profile

## Method

`scripts/benchmark_v32_1_capabilities.py` renders the production Skill index
directly from an explicitly supplied isolated `skills/` directory. It does not
construct an agent. Network and process entry points are fail-closed during the
measurement. Token values use Hermes' own rough preflight estimator and are not
provider billing/tokenizer usage.

The isolated bundled baseline contains 82 packages. Windows/platform and
runtime relevance leave 72 Skills in the full rendered index. The task receipt
uses six Skills for parent/session and four for child, within the 3–8 target.

## Exact result

| Scope | Skills | Chars | UTF-8 bytes | Token estimate | Selection hash |
| --- | ---: | ---: | ---: | ---: | --- |
| Full catalog | 72 | 8,797 | 8,829 | 2,204 | `6697377534594a1ec5fd4de7d6a3f65cdbe81955296096a1d2d5cb0f878c6880` |
| Parent receipt | 6 | 2,257 | 2,269 | 565 | `6ccbfddbd88677a837d23cd1bcfbcaaefafcd4fd1e16470ae44b53253030a262` |
| Persisted session receipt | 6 | 2,257 | 2,269 | 565 | `6ccbfddbd88677a837d23cd1bcfbcaaefafcd4fd1e16470ae44b53253030a262` |
| Child receipt | 4 | 2,098 | 2,110 | 525 | `fab126f2ee4eef89ac0f5417ee508a354c8153028c38c491cb019861fa939c1a` |

The parent/session index is 6,540 chars smaller than the full catalog (74.34%
reduction). Parent and persisted session are byte- and hash-identical. The
child receives a separate narrower hash; it does not expand parent or sibling
scope.

## Simple prompt contract

One injected mock main responder handled `Xin chao`:

- main responses: 1
- tool calls: 0
- subagent calls: 0
- background reviews: 0
- live provider calls: 0
- network calls: 0
- process calls: 0

## Reproduce

```powershell
& .\.venv\Scripts\python.exe scripts\benchmark_v32_1_capabilities.py `
  --isolated-home .tmp\v32-1-capability-baseline-20260826-025456\hermes-home
```

The script refuses the default Hermes root and named profiles below that root.
Use a copied fixture/profile only.

## Limits

This is deterministic source evidence, not a live model-quality or provider
latency benchmark. It measures the exact Skill index text and Hermes token
estimate; it does not claim tokenizer-exact billed usage. MCP is intentionally
not measured here and remains the next fail-closed permission-router slice.
