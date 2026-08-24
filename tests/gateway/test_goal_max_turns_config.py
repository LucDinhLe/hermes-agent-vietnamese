import time

import pytest

from gateway.config import GatewayConfig, Platform, PlatformConfig
from gateway.platforms.base import MessageEvent, MessageType
from gateway.run import GatewayRunner
from gateway.session import SessionSource
from hermes_cli import goals


class _FakeSessionEntry:
    session_id = "sid-gateway-goal-config"


class _FakeSessionStore:
    def __init__(self):
        self.entry = _FakeSessionEntry()

    def get_or_create_session(self, source, **_kwargs):
        return self.entry

    def _generate_session_key(self, source):
        return "agent:main:discord:channel:goal-config"


@pytest.mark.asyncio
async def test_gateway_goal_uses_goals_max_turns_from_full_config(tmp_path, monkeypatch):
    """A cold, slow DB bootstrap must persist the configured /goal budget."""
    home = tmp_path / ".hermes"
    home.mkdir()
    (home / "config.yaml").write_text("goals:\n  max_turns: 7\n", encoding="utf-8")
    monkeypatch.setenv("HERMES_HOME", str(home))
    goals._DB_CACHE.clear()

    # Reproduce a cold profile whose schema/bootstrap work exceeds the
    # loop-thread grace window. Before the gateway constructed GoalManager on
    # its event loop, the command returned a success message but save_goal()
    # had no DB and silently lost the state.
    from hermes_state import SessionDB as RealSessionDB

    class SlowSessionDB(RealSessionDB):
        def __init__(self, *args, **kwargs):
            time.sleep(goals._DB_BOOTSTRAP_LOOP_WAIT_S + 0.1)
            super().__init__(*args, **kwargs)

    monkeypatch.setattr("hermes_state.SessionDB", SlowSessionDB)

    runner = object.__new__(GatewayRunner)
    runner.config = GatewayConfig(
        platforms={Platform.DISCORD: PlatformConfig(enabled=True, token="token")}
    )
    runner.session_store = _FakeSessionStore()
    runner.adapters = {}
    runner._queued_events = {}

    event = MessageEvent(
        text="/goal ship the benchmark",
        message_type=MessageType.TEXT,
        source=SessionSource(
            platform=Platform.DISCORD,
            chat_id="chat-goal-config",
            chat_type="channel",
            user_id="user-goal-config",
        ),
        message_id="msg-goal-config",
    )

    response = await GatewayRunner._handle_goal_command(runner, event)

    try:
        assert "⊙ Goal set (7-turn budget): ship the benchmark" in response
        state = goals.GoalManager("sid-gateway-goal-config").state
        assert state is not None
        assert state.max_turns == 7
    finally:
        for db in goals._DB_CACHE.values():
            db.close()
        goals._DB_CACHE.clear()
        runner._shutdown_executor()
