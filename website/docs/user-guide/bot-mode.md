---
title: "Agents"
description: "Create and manage named Hermes Agents, invite several collaborators into a session or project, run routines, and coordinate group chats."
---

# Agents

Hermes Vietnamese turns [profiles](./profiles.md) into named **Agents**. Each Agent can have its own role, model, memory, skills, tools, MCP servers, appearance, sessions, and routines.

Agents are a required desktop feature. Their internal profile IDs, storage, sessions, routines, and command-line behavior stay compatible with earlier releases.

:::tip An Agent is a profile
An Agent uses the existing Hermes profile primitive under `~/.hermes/profiles/<name>/`. The desktop adds a roster and collaboration workflow over that data. `hermes -p <agent> chat`, `hermes profile list`, and `hermes cron list` continue to use the same profiles and jobs.
:::

## The fixed Agents control

Every chat has an **Agents** control in the session header, next to context usage, estimated cost, and Advisor.

Open it to:

- see the **lead Agent** for the conversation;
- see every collaborating Agent and whether it belongs to this session, this project, or both;
- search by name, role, model, description, or available capability metadata;
- invite more than one Agent to the current session or project;
- remove an Agent from one scope without deleting its profile;
- open **Manage Agents**.

Inviting an Agent is additive. It does not switch the active gateway, replace the lead Agent, change the model, or make a model call. Use the Agent's `@handle` in the composer when you are ready to assign work. Any future lead-change action is separate and explicitly labelled.

The old left-side profile pane is retired. Closing a layout pane can no longer remove the only path back to Agent management.

## Manage Agents

**Manage Agents** opens a stable full-page workspace. It includes Agent profiles, groups, sessions, capabilities, and routines.

From an Agent's menu you can:

- open its persistent chat or recent sessions;
- edit its title, description, model, SOUL.md, skills, tools, and MCP servers;
- change its generated, uploaded, geometric, or pet appearance;
- copy the profile;
- hide or reveal it in management views;
- add it to groups;
- delete a non-default profile after confirmation.

Hidden Agents remain callable by `@mention`, keep their group memberships, and continue running routines.

## Creating an Agent

Choose **New Agent** from the management page or command palette. The quick setup asks for **Name**, **Title**, and **Description**. **Advanced** exposes:

- **Clone from profile**, or a fresh profile with bundled skills;
- model and provider selection;
- SOUL.md instructions;
- skills, tools, toolsets, and MCP servers;
- **Create empty** for a minimal profile;
- provider-account and API-key sharing.

### Provider accounts, API keys, permissions, and cost

Credential sharing keeps its existing default for upgrade compatibility.

When sharing is enabled, the new Agent can use the main profile's OAuth sessions, subscriptions, and API keys. Its requests use those accounts' permissions and count toward the corresponding quotas or charges. Shared refresh tokens continue to refresh from the same pool.

When sharing is disabled, Hermes creates a separate credential snapshot. That copy may need sign-in again and can drift from the main profile. Turning sharing off does not guarantee that every credential is absent; review the target profile before giving it sensitive work.

### Create on another machine

With several entries in [Settings → Connections](./multi-connection-desktop.md), **Create on** selects the backend that owns the new profile. The window does not silently switch gateways. Remote Agents keep source-qualified identities and may use handles such as `@research-mac-mini` when the same profile name exists on several machines.

## Persistent chats and sessions

Each Agent retains its existing canonical conversation. Earlier versions persisted the internal title `Bot Chat`; Hermes Vietnamese keeps that value for compatibility while presenting Agent terminology in the interface.

Typing `/new` or `/reset` inside that canonical conversation compacts the working context instead of breaking the relationship into a replacement chat. Ordinary sessions on the same profile keep their regular `/new` behavior.

Agent-owned canonical chats and group-member plumbing sessions remain hidden from the global Sessions list when the backend supports hidden sessions. Use the Agent's management view to browse its recent conversations.

## Routines

The **Routines** tab attaches recurring work to the Agent that performs it. The schedule editor supports one-time, interval, daily, weekday, weekly, monthly, and advanced Hermes schedules.

Routines remain ordinary Hermes cron jobs with compatible markers such as `[bot:<name>]`. They are visible through `hermes cron list` and the core Cron page. Existing jobs are not renamed or migrated.

## Groups and group chats

Agents can belong to several groups. Create a room with two to six local or connected Agents, then open its standalone group row.

- A message can trigger up to three serial rounds.
- `@mentions` select specific members; without mentions, members decide whether they have something useful to add.
- Agents may pass instead of replying.
- `@user` marks a decision that needs you.
- Hard message and round caps prevent runaway rooms.
- Every member retains its existing persistent `Group: <name>` session.
- Cross-machine members work on their own backends and remain source-qualified.

Group membership, logs, watermarks, session references, and legacy single-group metadata remain backward compatible.

## Agent-to-Agent messaging

Type `@researcher review this plan` in a chat to hand work to another Agent. Unknown handles and email addresses pass through untouched.

Local delivery continues to use the compatible canonical chat protocol. Cross-machine delivery uses the Connections registry without foregrounding the remote gateway. Replies return with the sender's attribution.

The stored protocol still recognizes legacy values including `Bot Chat`, `Message from 🤖`, and `agent.bot_mode_protocol`. Those are wire and data contracts, not current interface labels.

### Headless cross-machine messages

Register another gateway as a peer to send directly without a desktop window:

```bash
hermes peer add spark --url http://spark.lan:8377 --key <API_SERVER_KEY>
hermes peer list
hermes peer dm spark "Message from 🤖 dixie (@dixie): disk status?"
hermes peer dm spark/researcher "..."
```

The peer key is a credential. Store it securely and restrict network access to trusted LAN, VPN, or Tailscale paths.

## CLI parity

| In the Agents interface | From a shell |
| --- | --- |
| Chat with an Agent | `hermes -p <agent> chat` |
| Agent files, skills, and memory | `~/.hermes/profiles/<agent>/` |
| Routines | `hermes cron list` |
| Create or inspect profiles | `hermes profile create`, `hermes profile list` |

See [Profiles](./profiles.md), [Profile Commands](../reference/profile-commands.md), and [Connecting Desktop to Many Hermes Instances](./multi-connection-desktop.md).
