"""Deterministic work-profile recommendations for fresh Hermes profiles.

This module deliberately has no provider or network dependency.  It turns the
work areas and common tasks a person selects during first-run onboarding into a
small allowlist of already-installed skills.  Applying a profile only mutates
the ``skills`` section of the supplied config; callers remain responsible for
persisting it through Hermes' normal config writer.
"""

from __future__ import annotations

import hashlib
import json
import unicodedata
from dataclasses import dataclass
from typing import Iterable, Mapping, MutableMapping, Sequence


WORK_PROFILE_VERSION = 1
DEFAULT_RECOMMENDATION_LIMIT = 12
MIN_RECOMMENDATION_SIZE = 8
MAX_RECOMMENDATION_SIZE = 15


@dataclass(frozen=True)
class SkillRecommendation:
    skills: tuple[str, ...]
    reasons: Mapping[str, str]
    used_provider: bool = False


@dataclass(frozen=True)
class WorkProfileState:
    completed: bool
    skipped: bool
    legacy: bool
    allowed: tuple[str, ...] | None
    work_areas: tuple[str, ...] = ()
    common_tasks: tuple[str, ...] = ()


@dataclass(frozen=True)
class TaskSkillDiscovery:
    """A local-only routing result for a future session or child agent."""

    selected: tuple[str, ...]
    recommended: tuple[str, ...]
    reasons: Mapping[str, str]
    used_provider: bool = False
    used_network: bool = False
    model_attempts: int = 0


AREA_SKILLS: Mapping[str, tuple[str, ...]] = {
    "research_learning": (
        "grounded-citations",
        "arxiv",
        "llm-wiki",
        "obsidian",
        "pdf",
        "document-to-action-items",
        "session-librarian",
        "google-workspace",
        "docx",
        "powerpoint",
        "xlsx",
        "meeting-action-items",
    ),
    "leadership_business": (
        "document-to-action-items",
        "meeting-action-items",
        "google-workspace",
        "session-librarian",
        "obsidian",
        "docx",
        "powerpoint",
        "xlsx",
        "grounded-citations",
        "pdf",
        "competitor-news-monitor",
        "product-price-monitor",
    ),
    "writing_content": (
        "grounded-citations",
        "obsidian",
        "docx",
        "google-workspace",
        "session-librarian",
        "document-to-action-items",
        "pdf",
        "powerpoint",
        "humanizer",
        "baoyu-infographic",
        "youtube-content",
        "gif-search",
    ),
    "software_building": (
        "hermes-agent",
        "codebase-inspection",
        "github-code-review",
        "github-issue-to-pr",
        "github-pr-workflow",
        "github-repo-management",
        "systematic-debugging",
        "test-driven-development",
        "requesting-code-review",
        "simplify-code",
        "merge-reconciler",
        "session-librarian",
    ),
    "office_productivity": (
        "google-workspace",
        "document-to-action-items",
        "meeting-action-items",
        "docx",
        "xlsx",
        "powerpoint",
        "pdf",
        "session-librarian",
        "obsidian",
        "email-inbox-triage",
        "ocr-and-documents",
        "teams-meeting-pipeline",
    ),
    "creative_media": (
        "baoyu-infographic",
        "excalidraw",
        "p5js",
        "manim-video",
        "ascii-art",
        "gif-search",
        "songwriting-and-ai-music",
        "youtube-content",
        "humanizer",
        "powerpoint",
        "obsidian",
        "session-librarian",
    ),
}


AREA_LABELS = {
    "research_learning": "research and learning",
    "leadership_business": "leadership and business operations",
    "writing_content": "writing and content",
    "software_building": "software and product building",
    "office_productivity": "office productivity",
    "creative_media": "creative and media work",
}


KEYWORD_AREAS: Mapping[str, tuple[str, ...]] = {
    "research_learning": (
        "nghien cuu",
        "hoc thuat",
        "tai lieu",
        "trich dan",
        "research",
        "evidence",
        "citation",
        "book",
        "sach",
    ),
    "leadership_business": (
        "doanh nghiep",
        "lanh dao",
        "quan tri",
        "van hanh",
        "tu van",
        "business",
        "leadership",
        "operations",
        "consulting",
    ),
    "writing_content": (
        "viet",
        "noi dung",
        "bai",
        "content",
        "writing",
        "newsletter",
        "social",
    ),
    "software_building": (
        "phan mem",
        "lap trinh",
        "code",
        "debug",
        "software",
        "github",
        "ung dung",
        "app",
    ),
    "office_productivity": (
        "hop",
        "email",
        "bang tinh",
        "thuyet trinh",
        "office",
        "spreadsheet",
        "presentation",
        "meeting",
    ),
    "creative_media": (
        "video",
        "hinh anh",
        "do hoa",
        "am nhac",
        "creative",
        "media",
        "design",
    ),
}


FALLBACK_SKILLS = (
    "session-librarian",
    "document-to-action-items",
    "google-workspace",
    "obsidian",
    "grounded-citations",
    "docx",
    "pdf",
    "powerpoint",
    "xlsx",
    "meeting-action-items",
    "hermes-agent",
    "codebase-inspection",
    "systematic-debugging",
    "test-driven-development",
    "github-code-review",
)


def _normalize_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def _unique_clean(values: Iterable[str]) -> tuple[str, ...]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        clean = str(value).strip()
        if clean and clean not in seen:
            seen.add(clean)
            result.append(clean)
    return tuple(result)


def recommend_skills(
    *,
    work_areas: Sequence[str],
    common_tasks: Sequence[str],
    installed_skills: Iterable[str],
    limit: int = DEFAULT_RECOMMENDATION_LIMIT,
) -> SkillRecommendation:
    """Return a deterministic, installed-only starter skill recommendation."""
    installed = {str(name).strip() for name in installed_skills if str(name).strip()}
    capped_limit = min(MAX_RECOMMENDATION_SIZE, max(MIN_RECOMMENDATION_SIZE, int(limit)))
    selected_areas = list(_unique_clean(work_areas))
    task_text = _normalize_text(" ".join(_unique_clean(common_tasks)))

    for area, keywords in KEYWORD_AREAS.items():
        if area not in selected_areas and any(keyword in task_text for keyword in keywords):
            selected_areas.append(area)

    ranked: list[str] = []
    reasons: dict[str, str] = {}

    def offer(skill: str, reason: str) -> None:
        if skill in installed and skill not in reasons and len(ranked) < capped_limit:
            ranked.append(skill)
            reasons[skill] = reason

    for area in selected_areas:
        label = AREA_LABELS.get(area, area.replace("_", " "))
        for skill in AREA_SKILLS.get(area, ()):
            offer(skill, f"Useful for {label}.")

    for skill in FALLBACK_SKILLS:
        if len(ranked) >= min(MIN_RECOMMENDATION_SIZE, len(installed)):
            break
        offer(skill, "A lightweight foundation for organizing and completing work.")

    return SkillRecommendation(skills=tuple(ranked), reasons=reasons)


def _areas_for_task(task: str) -> tuple[str, ...]:
    task_text = _normalize_text(task)
    return tuple(
        area
        for area, keywords in KEYWORD_AREAS.items()
        if any(keyword in task_text for keyword in keywords)
    )


def discover_task_skills(
    *,
    task: str,
    installed_skills: Iterable[str],
    allowed_skills: Iterable[str],
    limit: int = 8,
) -> TaskSkillDiscovery:
    """Discover task skills locally without changing the running session.

    Only skills already present in ``allowed_skills`` are returned in
    ``selected``. Installed-but-not-allowed matches are recommendations for an
    explicit future permission change; this function never mutates config and
    has no provider, model, or network dependency.
    """
    installed = {str(name).strip() for name in installed_skills if str(name).strip()}
    allowed = {
        str(name).strip()
        for name in allowed_skills
        if str(name).strip() and str(name).strip() in installed
    }
    capped_limit = min(8, max(3, int(limit)))
    areas = _areas_for_task(task)
    if not areas:
        return TaskSkillDiscovery(selected=(), recommended=(), reasons={})

    ranked: list[str] = []
    reasons: dict[str, str] = {}
    for area in areas:
        label = AREA_LABELS.get(area, area.replace("_", " "))
        for skill in AREA_SKILLS.get(area, ()):
            if skill in installed and skill not in reasons:
                ranked.append(skill)
                reasons[skill] = f"Useful for {label}."

    selected = tuple(skill for skill in ranked if skill in allowed)[:capped_limit]
    recommended = tuple(skill for skill in ranked if skill not in allowed)[:capped_limit]
    visible = set(selected) | set(recommended)
    return TaskSkillDiscovery(
        selected=selected,
        recommended=recommended,
        reasons={skill: reason for skill, reason in reasons.items() if skill in visible},
    )


def _selection_hash(allowed: Sequence[str]) -> str:
    payload = json.dumps(list(allowed), ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def apply_work_profile(
    config: MutableMapping[str, object],
    *,
    installed_skills: Iterable[str],
    allowed_skills: Iterable[str],
    work_areas: Sequence[str],
    common_tasks: Sequence[str],
    skipped: bool,
) -> MutableMapping[str, object]:
    """Apply an explicitly confirmed work profile to a config mapping."""
    installed = {str(name).strip() for name in installed_skills if str(name).strip()}
    allowed = {str(name).strip() for name in allowed_skills if str(name).strip()}
    unknown = allowed - installed
    if unknown:
        raise ValueError(f"Cannot allow skills that are not installed: {', '.join(sorted(unknown))}")

    skills_value = config.get("skills")
    skills_config: MutableMapping[str, object]
    if isinstance(skills_value, MutableMapping):
        skills_config = skills_value
    else:
        skills_config = {}
        config["skills"] = skills_config

    allowed_sorted = sorted(allowed)
    skills_config["allowed"] = allowed_sorted
    skills_config["disabled"] = sorted(installed - allowed)
    skills_config["work_profile"] = {
        "version": WORK_PROFILE_VERSION,
        "completed": True,
        "skipped": bool(skipped),
        "work_areas": list(_unique_clean(work_areas)),
        "common_tasks": list(_unique_clean(common_tasks)),
        "selection_hash": _selection_hash(allowed_sorted),
    }
    return config


def reconcile_allowed_skill_catalog(
    config: MutableMapping[str, object], *, installed_skills: Iterable[str]
) -> bool:
    """Fail closed when an installed catalog grows under an allowlist.

    Legacy profiles have no ``skills.allowed`` key and remain untouched. Once
    the key exists it is authoritative: every installed skill outside it is
    disabled, including skills added by a later bundled sync. Existing stale
    disabled entries are retained so an uninstalled skill cannot silently
    reactivate if it returns later.
    """
    skills_value = config.get("skills")
    if not isinstance(skills_value, MutableMapping):
        return False
    allowed_value = skills_value.get("allowed")
    if not isinstance(allowed_value, (list, tuple, set, frozenset)):
        return False

    allowed = {str(name).strip() for name in allowed_value if str(name).strip()}
    installed = {str(name).strip() for name in installed_skills if str(name).strip()}
    disabled_value = skills_value.get("disabled")
    disabled = (
        {str(name).strip() for name in disabled_value if str(name).strip()}
        if isinstance(disabled_value, (list, tuple, set, frozenset))
        else set()
    )
    next_disabled = (disabled | (installed - allowed)) - allowed
    normalized_allowed = sorted(allowed)
    normalized_disabled = sorted(next_disabled)
    changed = (
        list(allowed_value) != normalized_allowed
        or not isinstance(disabled_value, list)
        or disabled_value != normalized_disabled
    )
    if changed:
        skills_value["allowed"] = normalized_allowed
        skills_value["disabled"] = normalized_disabled
    return changed


def work_profile_state(
    config: Mapping[str, object], *, installed_skills: Iterable[str]
) -> WorkProfileState:
    """Read work-profile state without mutating legacy or upgraded profiles."""
    skills_value = config.get("skills")
    skills_config = skills_value if isinstance(skills_value, Mapping) else {}
    profile_value = skills_config.get("work_profile")
    profile = profile_value if isinstance(profile_value, Mapping) else {}
    completed = profile.get("completed") is True
    allowed_value = skills_config.get("allowed")
    allowed = (
        tuple(sorted({str(name).strip() for name in allowed_value if str(name).strip()}))
        if isinstance(allowed_value, (list, tuple, set, frozenset))
        else None
    )
    installed = {str(name).strip() for name in installed_skills if str(name).strip()}
    if allowed is not None:
        allowed = tuple(name for name in allowed if name in installed)

    return WorkProfileState(
        completed=completed,
        skipped=profile.get("skipped") is True,
        legacy=not completed and allowed is None,
        allowed=allowed,
        work_areas=_unique_clean(profile.get("work_areas", ()))
        if isinstance(profile.get("work_areas"), (list, tuple))
        else (),
        common_tasks=_unique_clean(profile.get("common_tasks", ()))
        if isinstance(profile.get("common_tasks"), (list, tuple))
        else (),
    )
