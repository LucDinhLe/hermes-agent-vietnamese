"""Run the v32.1 task-capability benchmark against an isolated profile."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from hermes_cli.capability_benchmark import run_capability_benchmark
from hermes_constants import get_default_hermes_root


DEFAULT_PARENT = (
    "codebase-inspection",
    "systematic-debugging",
    "test-driven-development",
    "github-code-review",
    "requesting-code-review",
    "simplify-code",
)
DEFAULT_CHILD = DEFAULT_PARENT[:4]


def _csv(value: str) -> tuple[str, ...]:
    return tuple(part.strip() for part in value.split(",") if part.strip())


def _assert_isolated(home: Path) -> None:
    real_root = get_default_hermes_root().resolve()
    resolved = home.resolve()
    if resolved == real_root or real_root in resolved.parents:
        raise SystemExit(
            "Refusing to benchmark a real Hermes profile; pass a copied isolated home."
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--isolated-home", type=Path, required=True)
    parser.add_argument("--parent-skills", type=_csv, default=DEFAULT_PARENT)
    parser.add_argument("--session-skills", type=_csv)
    parser.add_argument("--child-skills", type=_csv, default=DEFAULT_CHILD)
    parser.add_argument("--simple-prompt", default="Xin chao")
    args = parser.parse_args()

    home = args.isolated_home.resolve()
    _assert_isolated(home)
    report = run_capability_benchmark(
        skills_dir=home / "skills",
        parent_skills=args.parent_skills,
        session_skills=args.session_skills or args.parent_skills,
        child_skills=args.child_skills,
        simple_prompt=args.simple_prompt,
        main_responder=lambda prompt: f"offline mock: {prompt}",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
