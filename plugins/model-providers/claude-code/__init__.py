"""Official Claude Code subscription process provider."""

from providers import register_provider
from providers.base import ProviderProfile


claude_code = ProviderProfile(
    name="claude-code",
    aliases=("claude-pro",),
    api_mode="chat_completions",
    display_name="Claude Pro / Max (Claude Code)",
    description="Official Claude Code process using Claude subscription limits",
    signup_url="https://claude.ai/upgrade",
    auth_type="external_process",
    base_url="claude-code://local",
    supports_health_check=False,
    fallback_models=("sonnet", "opus", "haiku"),
    default_aux_model="haiku",
)

register_provider(claude_code)
