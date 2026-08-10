# Claude Pro bridge for Hermes Desktop

## Objective

Let a Hermes Desktop user run direct-chat requests through the official Claude Code CLI using an existing Claude Pro or Max subscription. Hermes must not read, copy, persist, refresh, or impersonate Claude credentials.

## Supported flow

1. The user selects **Claude Pro / Max (via Claude Code)** in Providers.
2. Hermes opens its visible terminal and runs `claude auth login`.
3. Claude Code owns the browser sign-in and its credential store.
4. Hermes verifies the account only by running `claude auth status` and accepting `authMethod=claude.ai` with `apiProvider=firstParty`.
5. Hermes starts `claude -p` for chat turns and translates Claude's documented stream-JSON output into the existing chat stream.

## Security and billing boundaries

- Hermes never reads Claude Code credential files, OS keychain entries, or OAuth tokens.
- The Claude child process receives no Anthropic API-key or alternate-cloud environment variables. This prevents an accidental pay-as-you-go or Bedrock/Vertex route.
- Hermes never alters Claude Code headers, client identity, or OAuth behavior.
- Hermes never silently falls back to the Anthropic API provider.
- The bridge requires Claude's rate-limit event to report Extra Usage as rejected/disabled. If Extra Usage is enabled, active, or unverifiable, the bridge stops and asks the user to disable it.
- Sign-out is delegated to the official `claude auth logout` command in the visible terminal.

## Runtime behavior

- Models exposed by this provider are the stable Claude Code aliases `sonnet`, `opus`, and `haiku`.
- A bridge instance owns one Claude session. Its first turn starts a session; later turns resume that session.
- On a restored Hermes conversation, the first Claude turn receives the Hermes transcript so context can be rehydrated without storing a second credential or token mapping.
- Stop/cancel terminates only the active Claude child process.
- Claude Code uses its own official tools and permission system. Hermes tools are not forwarded through this provider in the first release.

## User-visible failures

- Claude CLI missing: show installation guidance.
- Signed out or wrong auth provider: ask the user to run `claude auth login`.
- Rate or plan limit: show Claude's limit message and do not change provider.
- Extra Usage detected: stop and explain that the $20-only safety gate blocked metered usage.
- CLI crash or invalid stream: show a redacted diagnostic without credentials or raw environment values.

## Initial scope

Included:

- Hermes Desktop on Windows.
- Direct chat, streaming text, session resume, and cancellation.
- Vietnamese and English provider setup UI.
- Unit, integration, and one live smoke test with a Claude subscription account.

Deferred:

- Gateway and multi-channel sessions.
- Hermes-native tool-call translation from Claude Code.
- Background agents and scheduled jobs through Claude Code.
- macOS/Linux installers beyond code paths that are naturally portable.

## Acceptance criteria

- A clean Windows install can connect by signing in through the official Claude Code browser flow.
- Provider status is derived from `claude auth status`; no Claude credential file is opened.
- A two-turn conversation preserves context and streams text into the Desktop UI.
- Stopping a response terminates the child process.
- API-key and alternate-cloud variables are absent from the child environment.
- The provider refuses a non-first-party login and refuses Extra Usage.
- Existing OpenAI, Anthropic API, and Copilot ACP providers still pass their regression tests.

## Rollback

The previous public package remains available as tag `vi-v0.20.0-1`. If any acceptance gate fails, do not publish the new tag; users stay on that release.
