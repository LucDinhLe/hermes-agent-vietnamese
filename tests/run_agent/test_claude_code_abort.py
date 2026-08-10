from unittest.mock import MagicMock


def test_watchdog_uses_thread_safe_subprocess_abort_hook():
    from run_agent import AIAgent

    client = MagicMock()
    client.abort_from_any_thread = MagicMock()
    agent = AIAgent.__new__(AIAgent)
    agent.provider = "claude-code"
    agent.model = "haiku"
    agent.base_url = "claude-code://local"
    agent._request_client_cache = {
        "client": client,
        "kwargs": {},
        "poisoned": False,
        "in_use": True,
    }

    agent._abort_request_openai_client(client, reason="interrupt_abort")

    client.abort_from_any_thread.assert_called_once_with()
    assert agent._request_client_cache["poisoned"] is True
