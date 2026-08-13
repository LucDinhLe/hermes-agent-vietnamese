from hermes_cli import auth
from hermes_cli.model_switch import list_authenticated_providers
from hermes_cli.models import provider_model_ids
from hermes_cli.providers import get_provider, normalize_provider


def test_claude_code_is_distinct_from_metered_anthropic_provider():
    assert normalize_provider("claude-code") == "claude-code"
    assert normalize_provider("claude-pro") == "claude-code"
    assert normalize_provider("claude") == "anthropic"
    assert get_provider("claude-code").auth_type == "external_process"


def test_claude_code_exposes_concrete_model_versions():
    models = provider_model_ids("claude-code", force_refresh=False)

    assert len(models) > 1
    assert all(model.startswith("claude-") for model in models)


def test_external_credentials_never_return_real_secret(monkeypatch):
    monkeypatch.setattr(
        "agent.claude_code_client.probe_claude_code_auth",
        lambda *_: {"installed": True, "logged_in": True},
    )
    monkeypatch.setattr(
        "agent.claude_code_client.resolve_claude_command",
        lambda *_: "claude",
    )

    creds = auth.resolve_external_process_provider_credentials("claude-code")

    assert creds["provider"] == "claude-code"
    assert creds["base_url"] == "claude-code://local"
    assert creds["api_key"] == "claude-code-subscription"


def test_signed_in_claude_code_is_selectable_with_models(monkeypatch):
    monkeypatch.setattr("agent.models_dev.fetch_models_dev", lambda: {})
    monkeypatch.setattr(
        auth,
        "get_external_process_provider_status",
        lambda provider_id: {
            "installed": True,
            "logged_in": provider_id == "claude-code",
        },
    )

    rows = list_authenticated_providers(current_provider="openai-codex")

    claude = next(row for row in rows if row["slug"] == "claude-code")
    expected = provider_model_ids("claude-code", force_refresh=False)
    assert claude["models"] == expected
    assert claude["total_models"] == len(expected)
