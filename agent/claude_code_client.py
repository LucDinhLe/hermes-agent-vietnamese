"""OpenAI-compatible facade over the official Claude Code CLI.

The bridge intentionally treats Claude Code as a process boundary.  It never
opens Claude's credential store and never receives an OAuth token.  Account
status and inference both go through documented Claude CLI commands.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading
import uuid
from collections import deque
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Iterator

from agent.message_content import flatten_message_text
from agent.redact import redact_sensitive_text
from hermes_cli._subprocess_compat import windows_hide_flags
from tools.environments.local import hermes_subprocess_env


CLAUDE_CODE_MARKER_BASE_URL = "claude-code://local"
_DEFAULT_TIMEOUT_SECONDS = 900.0

# These variables can make Claude Code use API billing or a cloud backend.
# The subscription bridge deliberately removes them from its child process.
_METERED_OR_ALTERNATE_ENV_VARS = frozenset(
    {
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_AUTH_TOKEN",
        "ANTHROPIC_TOKEN",
        "ANTHROPIC_BASE_URL",
        "CLAUDE_CODE_OAUTH_TOKEN",
        "CLAUDE_CODE_USE_BEDROCK",
        "CLAUDE_CODE_USE_VERTEX",
        "CLAUDE_CODE_USE_FOUNDRY",
        "AWS_BEARER_TOKEN_BEDROCK",
    }
)


def build_claude_code_env() -> dict[str, str]:
    """Return a sanitized environment that cannot silently select API billing."""
    # Claude authenticates through its own official credential store. It has no
    # reason to inherit OpenAI, Gemini, GitHub, tool, or messaging secrets from
    # Hermes, so start from the strict credential-free subprocess environment.
    env = hermes_subprocess_env(inherit_credentials=False)
    for key in _METERED_OR_ALTERNATE_ENV_VARS:
        env.pop(key, None)
    return env


def resolve_claude_command(command: str | None = None) -> str:
    requested = (
        str(command or "").strip()
        or os.getenv("HERMES_CLAUDE_CODE_COMMAND", "").strip()
        or "claude"
    )
    resolved = shutil.which(requested)
    if resolved:
        return resolved

    # The official native installer puts Claude in ~/.local/bin. Desktop
    # processes launched from Explorer/Finder often inherit a smaller PATH
    # than an interactive terminal, so a working `claude` command can appear
    # missing to the Hermes gateway. Only add this fallback for the default
    # command; explicit overrides must remain authoritative.
    if not command and not os.getenv("HERMES_CLAUDE_CODE_COMMAND", "").strip():
        names = ("claude.exe", "claude") if os.name == "nt" else ("claude",)
        for name in names:
            candidate = Path.home() / ".local" / "bin" / name
            if candidate.is_file() and (os.name == "nt" or os.access(candidate, os.X_OK)):
                return str(candidate)

    return requested


def probe_claude_code_auth(command: str | None = None, *, timeout: float = 15.0) -> dict[str, Any]:
    """Ask Claude Code for non-secret account status.

    The returned mapping contains no token, credential path, email, or org id.
    """
    resolved = resolve_claude_command(command)
    try:
        completed = subprocess.run(
            [resolved, "auth", "status"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            env=build_claude_code_env(),
            creationflags=windows_hide_flags(),
        )
    except FileNotFoundError:
        return {
            "logged_in": False,
            "installed": False,
            "source": "claude_code_cli",
            "error": "Claude Code CLI is not installed or is not on PATH.",
        }
    except subprocess.TimeoutExpired:
        return {
            "logged_in": False,
            "installed": True,
            "source": "claude_code_cli",
            "error": "Claude Code did not return account status in time.",
        }
    except OSError as exc:
        return {
            "logged_in": False,
            "installed": False,
            "source": "claude_code_cli",
            "error": redact_sensitive_text(str(exc), force=True),
        }

    raw = (completed.stdout or "").strip()
    try:
        status = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        status = {}

    logged_in = bool(status.get("loggedIn"))
    auth_method = str(status.get("authMethod") or "").strip()
    api_provider = str(status.get("apiProvider") or "").strip()
    subscription_safe = logged_in and auth_method == "claude.ai" and api_provider == "firstParty"
    error = ""
    if completed.returncode != 0 or not logged_in:
        error = "Claude Code is signed out. Run `claude auth login`."
    elif not subscription_safe:
        error = (
            "Claude Code is not using a first-party claude.ai subscription. "
            "Sign out, remove API/cloud routing variables, then run `claude auth login`."
        )

    return {
        "logged_in": subscription_safe,
        "installed": True,
        "subscription_safe": subscription_safe,
        "auth_method": auth_method,
        "api_provider": api_provider,
        "source": "claude_code_cli",
        "source_label": "Claude Code CLI (claude.ai subscription)",
        "error": error or None,
    }


def _format_transcript(messages: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    labels = {
        "system": "System context",
        "user": "User",
        "assistant": "Assistant",
        "tool": "Tool result",
    }
    for message in messages:
        if not isinstance(message, dict):
            continue
        content = flatten_message_text(message.get("content"))
        if not content.strip():
            continue
        role = str(message.get("role") or "context").strip().lower()
        parts.append(f"{labels.get(role, 'Context')}:\n{content.strip()}")
    return "\n\n".join(parts).strip()


def _latest_user_text(messages: list[dict[str, Any]]) -> str:
    for message in reversed(messages):
        if isinstance(message, dict) and str(message.get("role") or "").lower() == "user":
            text = flatten_message_text(message.get("content")).strip()
            if text:
                return text
    return _format_transcript(messages)


def _contains_true(value: Any, key: str) -> bool:
    if isinstance(value, dict):
        if value.get(key) is True:
            return True
        return any(_contains_true(item, key) for item in value.values())
    if isinstance(value, list):
        return any(_contains_true(item, key) for item in value)
    return False


def _find_value(value: Any, key: str) -> Any:
    if isinstance(value, dict):
        if key in value:
            return value[key]
        for item in value.values():
            found = _find_value(item, key)
            if found is not None:
                return found
    elif isinstance(value, list):
        for item in value:
            found = _find_value(item, key)
            if found is not None:
                return found
    return None


def _usage_namespace(data: dict[str, Any] | None) -> SimpleNamespace:
    data = data or {}
    input_tokens = int(data.get("input_tokens") or 0)
    output_tokens = int(data.get("output_tokens") or 0)
    cache_read = int(data.get("cache_read_input_tokens") or 0)
    return SimpleNamespace(
        prompt_tokens=input_tokens,
        completion_tokens=output_tokens,
        total_tokens=input_tokens + output_tokens,
        prompt_tokens_details=SimpleNamespace(cached_tokens=cache_read),
    )


def _stream_chunk(*, content: str | None, finish_reason: str | None, model: str, usage: Any = None):
    delta = SimpleNamespace(
        role="assistant",
        content=content,
        tool_calls=None,
        reasoning_content=None,
        reasoning=None,
    )
    return SimpleNamespace(
        choices=[SimpleNamespace(index=0, delta=delta, finish_reason=finish_reason)],
        model=model,
        usage=usage,
    )


class _ClaudeChatCompletions:
    def __init__(self, client: "ClaudeCodeClient"):
        self._client = client

    def create(self, **kwargs: Any) -> Any:
        return self._client._create_chat_completion(**kwargs)


class _ClaudeChatNamespace:
    def __init__(self, client: "ClaudeCodeClient"):
        self.completions = _ClaudeChatCompletions(client)


class ClaudeCodeClient:
    """Minimal OpenAI client shape backed by ``claude -p`` stream JSON."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        command: str | None = None,
        args: list[str] | None = None,
        cwd: str | None = None,
        **_: Any,
    ):
        self.api_key = api_key or "claude-code-subscription"
        self.base_url = base_url or CLAUDE_CODE_MARKER_BASE_URL
        self._command = resolve_claude_command(command)
        self._extra_args = list(args or [])
        self._cwd = os.path.abspath(cwd or os.getcwd())
        self._session_id = str(uuid.uuid4())
        self._started_session = False
        self._active_process: subprocess.Popen[str] | None = None
        self._lock = threading.Lock()
        self.chat = _ClaudeChatNamespace(self)
        self.is_closed = False

    def close(self) -> None:
        """Cancel an active request. Completed clients remain reusable."""
        with self._lock:
            proc = self._active_process
            self._active_process = None
        if proc is None or proc.poll() is not None:
            return
        self.is_closed = True
        try:
            proc.terminate()
            proc.wait(timeout=2)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass

    def abort_from_any_thread(self) -> None:
        """Terminate the stdio child; safe for the watchdog/poll thread."""
        self.close()

    def _create_chat_completion(
        self,
        *,
        model: str | None = None,
        messages: list[dict[str, Any]] | None = None,
        timeout: Any = None,
        stream: bool = False,
        **_: Any,
    ) -> Any:
        timeout_seconds = _DEFAULT_TIMEOUT_SECONDS
        if isinstance(timeout, (int, float)):
            timeout_seconds = float(timeout)

        iterator = self._stream_response(
            model=model or "sonnet",
            messages=messages or [],
            timeout_seconds=timeout_seconds,
        )
        if stream:
            return iterator

        text_parts: list[str] = []
        final_usage = _usage_namespace(None)
        for chunk in iterator:
            if chunk.choices:
                text_parts.append(chunk.choices[0].delta.content or "")
            if chunk.usage is not None:
                final_usage = chunk.usage
        assistant = SimpleNamespace(
            content="".join(text_parts),
            tool_calls=[],
            reasoning=None,
            reasoning_content=None,
            reasoning_details=None,
        )
        return SimpleNamespace(
            choices=[SimpleNamespace(message=assistant, finish_reason="stop")],
            usage=final_usage,
            model=model or "sonnet",
        )

    def _stream_response(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        timeout_seconds: float,
    ) -> Iterator[SimpleNamespace]:
        from agent.turn_budget import require_observable_model_runtime

        require_observable_model_runtime(provider="claude-code")
        status = probe_claude_code_auth(self._command)
        if not status.get("logged_in"):
            raise RuntimeError(str(status.get("error") or "Claude Code subscription is not connected."))

        first_turn = not self._started_session
        prompt = _format_transcript(messages) if first_turn else _latest_user_text(messages)
        argv = [
            self._command,
            "-p",
            "--output-format",
            "stream-json",
            "--include-partial-messages",
            "--verbose",
            "--model",
            model,
        ]
        if first_turn:
            argv.extend(
                [
                    "--session-id",
                    self._session_id,
                    "--append-system-prompt",
                    (
                        "You are serving as the official Claude Code backend for Hermes. "
                        "Be transparent about that boundary. Use only Claude Code's own "
                        "tools and permission system; do not fabricate Hermes tool calls."
                    ),
                ]
            )
        else:
            argv.extend(["--resume", self._session_id])
        argv.extend(self._extra_args)

        try:
            proc = subprocess.Popen(
                argv,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                cwd=self._cwd,
                env=build_claude_code_env(),
                creationflags=windows_hide_flags(),
            )
        except FileNotFoundError as exc:
            raise RuntimeError("Claude Code CLI is missing. Install it, then run `claude auth login`.") from exc

        self.is_closed = False
        with self._lock:
            self._active_process = proc

        stderr_tail: deque[str] = deque(maxlen=30)

        def _read_stderr() -> None:
            if proc.stderr is None:
                return
            for line in proc.stderr:
                stderr_tail.append(line.rstrip())

        threading.Thread(target=_read_stderr, daemon=True).start()

        if proc.stdin is None or proc.stdout is None:
            proc.kill()
            raise RuntimeError("Claude Code did not expose its stream pipes.")
        proc.stdin.write(prompt)
        proc.stdin.close()

        emitted_text = False
        overage_checked = False
        pending_text: list[str] = []
        result_text = ""
        result_usage: dict[str, Any] = {}
        try:
            for raw_line in proc.stdout:
                try:
                    event = json.loads(raw_line)
                except json.JSONDecodeError:
                    continue

                if event.get("type") == "rate_limit_event":
                    overage_status = str(_find_value(event, "overageStatus") or "").strip().lower()
                    if _contains_true(event, "isUsingOverage") or overage_status != "rejected":
                        self.close()
                        raise RuntimeError(
                            "Claude Extra Usage is enabled or could not be proven disabled. "
                            "Turn off Extra Usage in Claude settings, then try again."
                        )
                    overage_checked = True
                    for buffered in pending_text:
                        emitted_text = True
                        yield _stream_chunk(content=buffered, finish_reason=None, model=model)
                    pending_text.clear()

                if event.get("type") == "system" and event.get("subtype") == "init":
                    api_key_source = event.get("apiKeySource")
                    if api_key_source not in {None, "", "none"}:
                        self.close()
                        raise RuntimeError(
                            "Claude Code selected an API-key billing source. Hermes stopped the request."
                        )

                if event.get("type") == "stream_event":
                    nested = event.get("event") or {}
                    delta = nested.get("delta") or {}
                    if nested.get("type") == "content_block_delta" and delta.get("type") == "text_delta":
                        text = str(delta.get("text") or "")
                        if text:
                            if overage_checked:
                                emitted_text = True
                                yield _stream_chunk(content=text, finish_reason=None, model=model)
                            else:
                                pending_text.append(text)

                if event.get("type") == "result":
                    if event.get("subtype") != "success" or event.get("is_error") is True:
                        message = str(event.get("result") or event.get("error") or "Claude Code request failed.")
                        raise RuntimeError(redact_sensitive_text(message, force=True))
                    result_text = str(event.get("result") or "")
                    result_usage = event.get("usage") if isinstance(event.get("usage"), dict) else {}

            return_code = proc.wait(timeout=timeout_seconds)
            if return_code != 0:
                detail = redact_sensitive_text("\n".join(stderr_tail).strip(), force=True)
                raise RuntimeError(detail or f"Claude Code exited with status {return_code}.")

            if not overage_checked:
                raise RuntimeError(
                    "Claude Code did not report Extra Usage status, so Hermes blocked the response for billing safety."
                )

            if result_text and not emitted_text:
                yield _stream_chunk(content=result_text, finish_reason=None, model=model)
            self._started_session = True
            yield _stream_chunk(content=None, finish_reason="stop", model=model)
            yield SimpleNamespace(choices=[], model=model, usage=_usage_namespace(result_usage))
        finally:
            with self._lock:
                if self._active_process is proc:
                    self._active_process = None
