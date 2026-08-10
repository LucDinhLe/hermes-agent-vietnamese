import io
import json

import pytest

from agent import claude_code_client as bridge


class _Input(io.StringIO):
    def close(self):
        self.saved = self.getvalue()
        super().close()


class _Process:
    def __init__(self, events, *, returncode=0, stderr=""):
        self.stdin = _Input()
        self.stdout = io.StringIO("".join(json.dumps(event) + "\n" for event in events))
        self.stderr = io.StringIO(stderr)
        self.returncode = None
        self._final_returncode = returncode
        self.terminated = False

    def poll(self):
        return self.returncode

    def wait(self, timeout=None):
        if self.returncode is None:
            self.returncode = self._final_returncode
        return self.returncode

    def terminate(self):
        self.terminated = True
        self.returncode = -15

    def kill(self):
        self.returncode = -9


def _successful_events(text="OK"):
    return [
        {"type": "system", "subtype": "init", "apiKeySource": "none"},
        {
            "type": "rate_limit_event",
            "rate_limit_info": {"isUsingOverage": False, "overageStatus": "rejected"},
        },
        {
            "type": "stream_event",
            "event": {
                "type": "content_block_delta",
                "delta": {"type": "text_delta", "text": text},
            },
        },
        {
            "type": "result",
            "subtype": "success",
            "result": text,
            "usage": {"input_tokens": 5, "output_tokens": 1, "cache_read_input_tokens": 2},
        },
    ]


def test_subscription_environment_strips_metered_and_cloud_routes(monkeypatch):
    for key in bridge._METERED_OR_ALTERNATE_ENV_VARS:
        monkeypatch.setenv(key, "secret-or-route")

    env = bridge.build_claude_code_env()

    assert not bridge._METERED_OR_ALTERNATE_ENV_VARS.intersection(env)


def test_subscription_environment_does_not_leak_other_provider_or_gateway_secrets(monkeypatch):
    for key in ("OPENAI_API_KEY", "GEMINI_API_KEY", "GITHUB_TOKEN", "TELEGRAM_BOT_TOKEN"):
        monkeypatch.setenv(key, "must-not-reach-claude")

    env = bridge.build_claude_code_env()

    assert "OPENAI_API_KEY" not in env
    assert "GEMINI_API_KEY" not in env
    assert "GITHUB_TOKEN" not in env
    assert "TELEGRAM_BOT_TOKEN" not in env


def test_auth_probe_accepts_only_first_party_claude_subscription(monkeypatch):
    completed = type(
        "Completed",
        (),
        {
            "returncode": 0,
            "stdout": json.dumps(
                {"loggedIn": True, "authMethod": "claude.ai", "apiProvider": "firstParty", "email": "hidden@example.com"}
            ),
            "stderr": "",
        },
    )()
    monkeypatch.setattr(bridge.subprocess, "run", lambda *args, **kwargs: completed)

    status = bridge.probe_claude_code_auth("claude")

    assert status["logged_in"] is True
    assert status["subscription_safe"] is True
    assert "email" not in status
    assert "token" not in json.dumps(status).lower()


def test_auth_probe_rejects_api_key_route(monkeypatch):
    completed = type(
        "Completed",
        (),
        {
            "returncode": 0,
            "stdout": json.dumps({"loggedIn": True, "authMethod": "apiKey", "apiProvider": "firstParty"}),
            "stderr": "",
        },
    )()
    monkeypatch.setattr(bridge.subprocess, "run", lambda *args, **kwargs: completed)

    status = bridge.probe_claude_code_auth("claude")

    assert status["logged_in"] is False
    assert "subscription" in status["error"]


def test_streaming_translates_text_usage_and_resumes_session(monkeypatch):
    monkeypatch.setattr(bridge, "probe_claude_code_auth", lambda *_: {"logged_in": True})
    processes = [_Process(_successful_events("ONE")), _Process(_successful_events("TWO"))]
    calls = []

    def _popen(argv, **kwargs):
        calls.append(list(argv))
        return processes[len(calls) - 1]

    monkeypatch.setattr(bridge.subprocess, "Popen", _popen)
    client = bridge.ClaudeCodeClient(command="claude", cwd=".")

    first = list(
        client.chat.completions.create(
            model="haiku",
            messages=[{"role": "user", "content": "first"}],
            stream=True,
        )
    )
    second = list(
        client.chat.completions.create(
            model="haiku",
            messages=[
                {"role": "user", "content": "first"},
                {"role": "assistant", "content": "ONE"},
                {"role": "user", "content": "second"},
            ],
            stream=True,
        )
    )

    assert "".join(c.choices[0].delta.content or "" for c in first if c.choices) == "ONE"
    assert first[-1].usage.total_tokens == 6
    assert "--session-id" in calls[0]
    assert "--resume" in calls[1]
    assert processes[0].stdin.saved == "User:\nfirst"
    assert processes[1].stdin.saved == "second"
    assert "".join(c.choices[0].delta.content or "" for c in second if c.choices) == "TWO"


def test_stream_stops_when_extra_usage_is_active(monkeypatch):
    monkeypatch.setattr(bridge, "probe_claude_code_auth", lambda *_: {"logged_in": True})
    process = _Process(
        [{"type": "rate_limit_event", "rate_limit_info": {"isUsingOverage": True}}]
    )
    monkeypatch.setattr(bridge.subprocess, "Popen", lambda *args, **kwargs: process)
    client = bridge.ClaudeCodeClient(command="claude", cwd=".")

    with pytest.raises(RuntimeError, match="Extra Usage"):
        list(
            client.chat.completions.create(
                model="haiku",
                messages=[{"role": "user", "content": "hello"}],
                stream=True,
            )
        )

    assert process.terminated is True


def test_stream_stops_when_extra_usage_is_enabled_but_not_yet_used(monkeypatch):
    monkeypatch.setattr(bridge, "probe_claude_code_auth", lambda *_: {"logged_in": True})
    process = _Process(
        [
            {
                "type": "rate_limit_event",
                "rate_limit_info": {"isUsingOverage": False, "overageStatus": "allowed"},
            }
        ]
    )
    monkeypatch.setattr(bridge.subprocess, "Popen", lambda *args, **kwargs: process)
    client = bridge.ClaudeCodeClient(command="claude", cwd=".")

    with pytest.raises(RuntimeError, match="Turn off Extra Usage"):
        list(
            client.chat.completions.create(
                model="haiku",
                messages=[{"role": "user", "content": "hello"}],
                stream=True,
            )
        )


def test_stream_stops_when_claude_reports_api_key_source(monkeypatch):
    monkeypatch.setattr(bridge, "probe_claude_code_auth", lambda *_: {"logged_in": True})
    process = _Process([{"type": "system", "subtype": "init", "apiKeySource": "ANTHROPIC_API_KEY"}])
    monkeypatch.setattr(bridge.subprocess, "Popen", lambda *args, **kwargs: process)
    client = bridge.ClaudeCodeClient(command="claude", cwd=".")

    with pytest.raises(RuntimeError, match="API-key billing"):
        list(
            client.chat.completions.create(
                model="haiku",
                messages=[{"role": "user", "content": "hello"}],
                stream=True,
            )
        )
