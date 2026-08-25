from hermes_cli.capability_profile import (
    apply_work_profile,
    recommend_skills,
    work_profile_state,
)


INSTALLED = {
    "document-to-action-items",
    "docx",
    "google-workspace",
    "grounded-citations",
    "meeting-action-items",
    "obsidian",
    "pdf",
    "powerpoint",
    "session-librarian",
    "xlsx",
    "arxiv",
    "llm-wiki",
    "hermes-agent",
    "codebase-inspection",
    "github-code-review",
    "systematic-debugging",
    "test-driven-development",
}


def test_recommendation_is_local_bounded_and_only_uses_installed_skills():
    result = recommend_skills(
        work_areas=["research_learning", "leadership_business"],
        common_tasks=[
            "Nghiên cứu và viết sách",
            "Soạn tài liệu đào tạo",
            "Tư vấn vận hành doanh nghiệp",
        ],
        installed_skills=INSTALLED,
    )

    assert 8 <= len(result.skills) <= 15
    assert set(result.skills) <= INSTALLED
    assert "grounded-citations" in result.skills
    assert "document-to-action-items" in result.skills
    assert "google-workspace" in result.skills
    assert result.reasons["grounded-citations"]
    assert result.used_provider is False


def test_apply_profile_atomically_separates_allowed_from_disabled():
    config = {"skills": {"disabled": []}, "model": {"default": "mock-model"}}
    allowed = {
        "grounded-citations",
        "document-to-action-items",
        "google-workspace",
        "obsidian",
        "session-librarian",
        "docx",
        "powerpoint",
        "pdf",
    }

    updated = apply_work_profile(
        config,
        installed_skills=INSTALLED,
        allowed_skills=allowed,
        work_areas=["research_learning"],
        common_tasks=["Nghiên cứu và viết tài liệu đào tạo"],
        skipped=False,
    )

    assert updated is config
    assert set(config["skills"]["allowed"]) == allowed
    assert set(config["skills"]["disabled"]) == INSTALLED - allowed
    assert config["skills"]["work_profile"]["completed"] is True
    assert config["skills"]["work_profile"]["skipped"] is False
    assert config["model"] == {"default": "mock-model"}


def test_legacy_profile_is_preserved_until_the_user_explicitly_applies():
    config = {"skills": {"disabled": ["pdf"]}}

    state = work_profile_state(config, installed_skills=INSTALLED)

    assert state.completed is False
    assert state.legacy is True
    assert state.allowed is None
    assert config == {"skills": {"disabled": ["pdf"]}}


def test_skip_completes_birth_with_every_skill_disabled():
    config = {}

    apply_work_profile(
        config,
        installed_skills=INSTALLED,
        allowed_skills=set(),
        work_areas=[],
        common_tasks=[],
        skipped=True,
    )

    state = work_profile_state(config, installed_skills=INSTALLED)
    assert state.completed is True
    assert state.skipped is True
    assert state.allowed == ()
    assert set(config["skills"]["disabled"]) == INSTALLED
