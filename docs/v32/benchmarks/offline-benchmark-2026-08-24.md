# Hermes v32 offline benchmark evidence

Measured source revisions:

- Baseline: `3cce675cea2bfdfd2fd29352f35a529e827cf46f`
- Current: `596d188b2c19ef5ef8f67b87bff7b1c5fa7c8c5e`

> Every token number below is a **static estimate** from the corresponding
> revision's `agent.model_metadata` rough estimator. No model, provider, quota
> endpoint, tool handler, or network was called.

## Results

| Scenario | Baseline | Current |
|---|---:|---:|
| Fresh active input | 34,299 tokens (3.2666% of 1.05M) | 5,169 tokens (0.4923% of 1.05M) |
| Synthetic 10-turn Q&A active input | 35,077 tokens (3.3407%) | 5,947 tokens (0.5664%) |
| Active / granted tool schemas | 59 / 59 | 4 / 59 |
| Active schema bytes | 117,260 | 4,265 |
| Tool-heavy retained raw bytes (full inline + previews) | 188,500 | 24,576 |
| Fully inline raw bytes | 160,000 | 0 |
| Per-result / per-turn raw cap | 100,000 / 200,000 bytes | 9,500 / 38,000 bytes |
| Governor model attempts admitted from 14 planned | 14 (Governor unavailable; counterfactual) | 12; warning at 6; first pause at 13 |
| Governor tool calls admitted from 25 planned | 25 (Governor unavailable; counterfactual) | 20; warning at 8; first pause at 21 |
| Logical-history static estimate | 350,105 tokens (33.3433%) | 350,105 tokens (33.3433%) |
| Native / local compaction threshold | unavailable / 525,000 | 190,000 / 208,000 |
| Compaction planning decision at the fixture | no compaction due | native and local-fallback gates due |

The fresh and 10-turn estimates include the empty-profile system prompt,
conversation, and model-visible tool schemas. The tool-heavy fixture uses 24
ASCII results of 32,000 bytes each. Spill writes are captured in memory, so the
simulation does not create retained artifacts.

The synthetic conversation also records the cumulative estimate and the delta
added by each user/assistant pair:

| Turn | Baseline active (% of 1.05M) | Current active (% of 1.05M) | Pair delta |
|---:|---:|---:|---:|
| 1 | 34,357 (3.2721%) | 5,227 (0.4978%) | +78 |
| 2 | 34,434 (3.2794%) | 5,304 (0.5051%) | +77 |
| 3 | 34,515 (3.2871%) | 5,385 (0.5129%) | +81 |
| 4 | 34,594 (3.2947%) | 5,464 (0.5204%) | +79 |
| 5 | 34,671 (3.3020%) | 5,541 (0.5277%) | +77 |
| 6 | 34,753 (3.3098%) | 5,623 (0.5355%) | +82 |
| 7 | 34,834 (3.3175%) | 5,704 (0.5432%) | +81 |
| 8 | 34,915 (3.3252%) | 5,785 (0.5510%) | +81 |
| 9 | 34,995 (3.3329%) | 5,865 (0.5586%) | +80 |
| 10 | 35,077 (3.3407%) | 5,947 (0.5664%) | +82 |

Configuration hashes (canonical JSON of the measurement-relevant profile,
raw-output caps, Governor limits, context window, and compaction thresholds):

- Baseline: `77cd9e8ef39d397ee829c051f909a329a1d714c470b8cc0c6931150493b448f6`
- Current: `81f745a530267f8c5eb02997ca2d188ca75b8835cbbb717c1475df0c178e28bb`

## Isolation and reproducibility

Each commit is exported with `git archive` into its own automatically removed
temporary source root. Each child receives separate empty `HOME`, `HERMES_HOME`,
`APPDATA`, and temp directories. IPv4/IPv6 socket connections, DNS resolution,
and subprocess creation fail closed and have measured attempt counters. Network
and DNS attempts must remain zero; any attempted subprocess is counted and
blocked before process creation. Tool availability checks are fixed to true so both sides see the
same worst-case Telegram grant catalog; external plugin discovery is disabled,
and no tool handler executes. Provider request counts come from the mocked
client endpoints rather than a declared constant.

The child removes Hermes' PEP 660 editable-install finder before importing a
revision. This matters because the shared virtualenv points at the current
checkout; without removal it could supply a current-only module to the baseline.
An acceptance check requires the baseline to report that aggregate Governor is
unavailable.

Reproduce from the repository root:

```powershell
& .\.venv\Scripts\python.exe scripts\benchmark_v32_offline.py --baseline-ref 3cce675cea2bfdfd2fd29352f35a529e827cf46f --current-ref 596d188b2c19ef5ef8f67b87bff7b1c5fa7c8c5e --format markdown
```

Canonical focused regression command:

```powershell
& 'C:\Program Files\Git\bin\bash.exe' scripts/run_tests.sh scripts/test_benchmark_v32_offline.py
```

## Limitations

- These are deterministic planning/preflight estimates, not tokenizer-exact
  provider billing or live usage.
- No native or local compaction execution occurred; the 350K scenario reports
  which configured gates are due, not their runtime ordering or summary quality.
- Forced availability gives a stable worst-case Telegram catalog, not a specific
  user's installed/credentialed capability inventory.
- Baseline Governor counts are explicitly counterfactual because that revision
  has no aggregate `TurnGovernor` implementation.
- Simple-answer no-tool-loop behavior belongs to mocked agent regression tests;
  this provider-free harness does not claim live model-behavior evidence.
- The focused regression lives under `scripts/`, so it is intentionally run by
  the exact canonical command above rather than default `tests/` discovery.
- Both revision objects must exist locally. A shallow checkout without the
  baseline stops with a clear fetch-history message; the harness never silently
  substitutes another baseline.
