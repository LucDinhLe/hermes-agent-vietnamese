/**
 * Hermes Bot Mode — a "one chat per agent" roster for the Hermes desktop.
 *
 * Left pane "Bots": one row per Hermes profile (a bot = an agent profile) with
 * a customizable avatar (shape + color + eyes, image, or pet). Click opens that
 * bot's chat; right-click → Edit Profile (avatar, title, description).
 * "New Agent" creates a profile — Name / Title / Description with an
 * "Advanced" disclosure for full profile config.
 *
 * Right tile "Routines": scheduled tasks (Hermes cron jobs) scoped to the
 * bot you're currently chatting with — follows the live gateway profile.
 *
 * Bots message each other straight into each bot's ONE canonical "Bot
 * Chat" — @-mentions deliver over gateway RPCs (no CLI relay), and
 * bot-initiated sends use `hermes -p <bot> chat --in ~ -c "Bot Chat"`.
 */

import * as sdk from '@hermes/plugin-sdk'
import {
  atom,
  Button,
  Checkbox,
  cn,
  Codicon,
  COMPOSER_AREAS,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  GlyphSpinner,
  haptic,
  host,
  Input,
  PALETTE_AREA,
  profileColor,
  queryClient,
  relativeTime,
  ScrollArea,
  SearchField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  Tip,
  useQuery,
  useValue
} from '@hermes/plugin-sdk'
import { useEffect, useRef, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const { McpTab, ToolsetConfigPanel } = sdk
// Keep optional exports feature-detected; test harnesses may strip the SDK namespace.
const SkillsView = typeof sdk === 'undefined' ? undefined : sdk.SkillsView
const Streamdown = typeof sdk === 'undefined' ? undefined : sdk.Streamdown
const DropdownMenuCheckboxItem = typeof sdk === 'undefined' ? undefined : sdk.DropdownMenuCheckboxItem
const DropdownMenuSearch = typeof sdk === 'undefined' ? undefined : sdk.DropdownMenuSearch
const usePluginTranslate =
  typeof sdk === 'undefined' || typeof sdk.usePluginI18n !== 'function' ? () => agentText : sdk.usePluginI18n
// Budgeted render loop (fps cap + observability pause + dormancy + teardown).
// Feature-detected: older desktops fall back to the hand-rolled clock below.
const createBudgetedLoop = typeof sdk === 'undefined' ? undefined : sdk.createBudgetedLoop

const ID = 'hermes-bots'
const ROSTER_KEY = [ID, 'roster']
const ROUTINES_KEY = [ID, 'routines']
const AGENT_MANAGEMENT_PATH = '/agent-profiles'
const COLLABORATION_KEY = 'collaboration-memberships-v1'
const COLLABORATION_PROJECT_BINDINGS_KEY = 'collaboration-project-bindings-v1'
const COLLABORATION_SESSION_BINDINGS_KEY = 'collaboration-session-bindings-v1'
const COLLABORATION_SCHEMA = 1
const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/

const AGENT_LOCALES = {
  en: {
    common: {
      back: 'Back',
      cancel: 'Cancel',
      save: 'Save',
      saving: 'Saving…',
      retry: 'Retry',
      retryNow: 'Retry now',
      delete: 'Delete',
      deleting: 'Deleting…',
      deleted: 'Deleted',
      working: 'Working…',
      search: 'Search',
      searching: 'Searching…',
      sessions: 'Sessions',
      editProfile: 'Edit Agent profile',
      duplicate: 'Duplicate',
      newAgent: 'New Agent',
      newGroupChat: 'New Group Chat'
    },
    session: {
      title: 'Agents',
      trigger: count => (count ? `Agents · ${count} collaborating` : 'Invite collaborating Agents'),
      lead: 'Lead Agent',
      leadHelp: 'Inviting a collaborator does not change the lead Agent.',
      collaborators: 'Collaborating Agents',
      invited: 'Invited',
      waiting: 'waiting for a task',
      active: 'active',
      ready: 'ready',
      scope: 'Add to',
      scopeSession: 'This session',
      scopeProject: 'This project',
      sessionUnavailable: 'Send the first message before inviting an Agent to this session.',
      projectUnavailable: 'Choose a project folder before inviting an Agent to this project.',
      search: 'Search by Agent, role, model, or capability…',
      noMatch: 'No Agents match this search.',
      noCandidates: 'No other Agents are available.',
      invite: name => `Invite ${name}`,
      joined: 'Participating',
      remove: name => `Remove ${name}`,
      removed: name => `${name} left this scope`,
      added: name => `${name} was invited as a collaborator`,
      workHint: handle => `Use @${handle} in the composer to give this Agent work. Inviting alone makes no model call.`,
      manage: 'Manage Agents',
      unavailable: 'Unavailable on this connection',
      capabilities: 'Capabilities not described yet',
      skills: count => `${count} skills`
    },
    activity: {
      newMessage: label => `🤖 New message for ${label}`,
      newActivity: label => `${label} has new activity`,
      openChat: 'Open the chat to see it.'
    },
    profile: {
      copySuffix: '(copy)',
      noDuplicateName: 'No free name for the duplicate.',
      duplicateStarted: name => `Duplicating ${name}…`,
      duplicateCreated: (name, source) => `Created ${name} — full copy of ${source}`,
      duplicateFailed: 'Duplicate failed',
      deleteFailed: name => `Could not delete profile ${name}`,
      deleted: name => `Deleted profile ${name}`,
      draftDiscarded: name => `Draft Agent "${name}" discarded`,
      draftCleanupFailed: name => `Could not clean up draft profile "${name}"`,
      sourceChanged: 'The active Agent source changed. Reopen this action from the intended source.',
      openChatFailed: name => `Could not open ${name}'s chat — try again`,
      sessionOpenFailed: 'Could not open session',
      unsupportedSessionOpen: 'This Hermes Vietnamese version cannot open stored sessions',
      conversation: 'Conversation',
      intro: 'Hey, tell me about yourself!',
      continuousTitle: 'This Agent chat never resets',
      continuousMessage:
        'Agent chats are one continuous conversation, so Hermes will compact it instead. For a temporary session with this Agent, open a separate session.'
    },
    remote: {
      stayHere: handle => `Stay in this chat and @${handle} to message this Agent. The gateway stays on this device.`,
      couldNotReach: label => `Could not reach ${label}`,
      sourceFallback: 'the remote source',
      livesOn: label => `Lives on ${label}`,
      messaged: handle => `Messaged @${handle}. This Agent will relay the reply when it arrives.`,
      noReply: (handle, label) => `No reply from @${handle} yet — check its Agent chat on ${label}.`,
      deliveryFailed: handle => `Could not reach @${handle}.`,
      updateRequired: 'Update Hermes Vietnamese to chat with Agents on other connections.',
      stillOn: (current, target) => `Still on ${current}, not ${target}`,
      sourceUnavailable: (profile, source) => `Agent ${profile} is unavailable on ${source}.`,
      noSession: 'No remote Agent session is available'
    },
    mcp: {
      addFailed: 'Could not add server',
      noTarget: 'No target profile',
      setFailed: key => `Failed to set ${key}`,
      configured: name => `${name} configured`,
      testFailed: 'Server test failed after setup',
      oauthStartFailed: 'Could not start OAuth',
      completeSignIn: 'Complete sign-in in your browser…',
      authenticated: name => `${name} authenticated`,
      oauthFailed: 'OAuth failed',
      needsSetup: keys => `needs setup (${keys}) — restart the gateway to enable in-app setup`,
      setUpDone: 'set up ✓',
      saveAndTest: 'Save & test',
      authorizing: 'Authorizing…',
      setupFailed: 'Setup failed',
      signIn: 'Sign in…',
      setUp: 'Set up…',
      none: 'No MCP servers configured or in the catalog.',
      catalog: 'catalog',
      catalogInstalled: 'catalog · installed',
      createHelp:
        'Configured servers copy from the main profile; catalog entries are the bundled MCP menu. Entries needing API keys go through setup first, and credentials follow the account-sharing choice.'
    },
    avatar: {
      shapeTab: 'Agent',
      generateTab: 'Generate',
      uploadTab: 'Upload',
      petTab: 'Pet',
      removeImage: 'Remove image — use a shape',
      describe: 'Describe your avatar…',
      generating: 'Generating…',
      generate: 'Generate',
      blankHint: 'Leave blank to generate from the Agent name and description.',
      noModel:
        'No image model is available. If you just enabled one or updated Hermes, restart the gateway from the menu.',
      checking: 'Checking the image backend…',
      chooseImage: 'Choose an image…',
      tooLarge: 'Image too large (max 15 MB).',
      generationFailed: 'Avatar generation failed',
      backendFailed: 'generation failed'
    },
    pet: {
      none: 'No pets in the petdex gallery. Run `hermes pets` to explore.',
      pick: 'Pick a pet as this Agent’s profile picture.',
      search: count => `Search ${count} pets…`,
      remove: 'Remove — return to a shape avatar',
      noMatch: 'No pets match.',
      loadFailed: 'Could not load that pet — try another.',
      more: (shown, total) => `Scroll for more (${shown} of ${total})`
    },
    roster: {
      noConversations: 'No conversations yet — say hi',
      pinned: 'Pinned',
      hidden: 'Hidden from the Agent list',
      unread: 'unread',
      activeRecently: 'Active in the last 90 seconds',
      lastFrom: handle => `Last message came from @${handle} (Agent to Agent)`,
      unpinned: name => `${name} unpinned`,
      pinnedTop: name => `${name} pinned to the top`,
      unpin: 'Unpin',
      pinTop: 'Pin to top',
      visibleAgain: name => `${name} is back in the Agent list`,
      hiddenNotice: name => `${name} hidden — use the eye button in the Agents header to show hidden Agents`,
      unhide: 'Unhide Agent',
      hide: 'Hide Agent',
      groups: names => `Groups: ${names}…`,
      manageGroups: 'Manage groups…',
      newChat: 'New chat with this Agent',
      title: 'Agents',
      toastsOn: 'Activity notifications on — select to silence',
      toastsOff: 'Activity notifications off — select to enable',
      hideHiddenAgain: 'Hide hidden Agents again',
      showHidden: count => `Show ${count} hidden Agent${count === 1 ? '' : 's'}`,
      hideHidden: 'Hide hidden Agents',
      showHiddenAria: 'Show hidden Agents',
      hiddenUnread: 'a hidden Agent has unread activity',
      newMenu: 'New…',
      newAria: 'New Agent or group chat',
      searchAria: 'Search Agents',
      searchPlaceholder: 'Search Agents…',
      stale: 'Agent list refresh failed — showing the last good list.',
      waitingReconnect: ' Waiting for the gateway to reconnect…',
      unavailable: error => `Agent list unavailable: ${error}. If your gateway predates profiles.list, update Hermes and restart the gateway.`,
      gatewayError: 'gateway error',
      waitingGateway: 'Waiting for the gateway connection… Remote gateways can take a few seconds; retries are automatic.',
      none: 'No Agents yet',
      noneHelp: 'Create your first teammate.',
      noMatch: query => `No Agents match “${query}”`,
      allHidden: 'All Agents are hidden — use the eye button above to show them.',
      deleteTitle: 'Delete Agent and profile?',
      deleteDescriptionStart: 'This will permanently delete the Agent ',
      deleteDescriptionMiddle: ' and its associated Hermes profile at ',
      deleteDescriptionEnd: '. This cannot be undone.'
    },
    model: {
      gatewayDefault: 'gateway default',
      provider: 'Provider',
      model: 'Model',
      providerCustom: 'Provider (Custom)',
      modelCustom: 'Model (Custom)',
      backToDropdowns: '← Back to dropdowns',
      inherit: 'Inherit (launch profile)',
      manual: '✏️ Enter manually…',
      providerPlaceholder: 'omnirouter / 9router / nous …',
      modelPlaceholder: 'antigravity/gemini-3.6-flash-high',
      providerExample: 'e.g. omnirouter, inferx, 9router',
      modelExample: 'e.g. antigravity/gemini-3.6-flash-high',
      exampleName: 'e.g. model name',
      inherited: 'inherited from launch profile'
    },
    advanced: {
      newerGateway: 'Full configuration needs a newer gateway. Restart it after updating Hermes.',
      capabilitiesNow: 'Capabilities (applies immediately — skills, tools, MCP)',
      soulProtocol: 'SOUL.md (persona + Agent-messaging protocol)',
      skillsEnabled: (enabled, total) => `Skills (${enabled}/${total} enabled)`,
      filterSkills: 'Filter skills…',
      toolsetsEnabled: (enabled, total) => `Toolsets (${enabled}/${total} enabled — clearing all restores the default)`,
      mcpServers: 'MCP servers',
      catalogSource: source => `Catalog from ${source} — unchecked skills are disabled after creation.`,
      defaultTools: 'Leaving all or none checked keeps the default toolset behavior.',
      catalogNeedsGateway: 'The capability catalog needs a newer gateway. Restart it after updating Hermes.',
      emptySkills: '“Create empty” is selected — no bundled skills will be installed.'
    },
    hub: {
      installed: label => `Skill "${label}" installed`,
      installFailed: label => `Installing "${label}" failed`,
      title: 'Skills Hub',
      hide: 'hide the hub browser',
      browse: 'browse the full hub ▾',
      frameTitle: 'Hermes Skills Hub',
      installing: label => `Installing "${label}"…`,
      addHint: 'Select “+ Add to this Agent” on any skill. It installs and appears above; drag the corner to resize.',
      searchPlaceholder: 'Search the hub (community + well-known sources)…',
      searchingHint: 'Searching community and well-known sources — this can take about 10 seconds…',
      noMatch: 'No Hub skills matched.',
      added: '✓ added',
      installTitle: name => `Install "${name}" and add it to the list above`
    },
    edit: {
      title: 'Edit Agent profile',
      description: (name, profile) => `Appearance and role for ${name} (${profile}).`,
      nameTitle: 'Title',
      descriptionLabel: 'Description',
      descriptionPlaceholder: 'What should this Agent help with?',
      advanced: 'Advanced — model, skills, toolsets, SOUL.md',
      localLookFailed: 'Saved the appearance locally; remote persistence failed',
      descriptionFailed: 'Saved the appearance locally; description update failed',
      sectionsFailed: names => `Some sections failed: ${names}`,
      advancedFailed: 'Advanced configuration failed',
      updated: name => `${name} updated`
    },
    create: {
      title: 'New Agent',
      description: 'A named teammate with its own memory, skills, and chat. It can message your other Agents.',
      name: 'Name',
      namePlaceholder: 'inbox-triage',
      duplicateLocal: name => `An Agent named "${name}" already exists.`,
      duplicateRemote: (name, target) => `An Agent named "${name}" already exists on ${target}.`,
      createOn: 'Create on',
      current: label => `${label} (current)`,
      remoteHelp: target => `The Agent is created on ${target} and appears in the list as a Connections Agent. Chat routes to that machine.`,
      titleLabel: 'Title',
      titlePlaceholder: 'Inbox Triage',
      descriptionLabel: 'Description',
      descriptionPlaceholder: 'What should this Agent help with?',
      advanced: 'Advanced',
      general: 'General',
      capabilities: 'Capabilities',
      skills: 'Skills',
      tools: 'Tools',
      mcp: 'MCP',
      profileNotReady: 'Could not create the profile yet',
      clone: 'Clone from profile',
      cloneOn: target => `Clone from profile (on ${target})`,
      fresh: 'Fresh profile (bundled skills)',
      soul: 'SOUL.md (optional — replaces the generated persona)',
      soulHint: 'Leave blank to generate it from the name, title, description, and Agent-messaging roster.',
      shareAuth: 'Share provider accounts; copy API keys from the main profile',
      shareAuthHelp:
        'When enabled, OAuth and account tokens use one shared store, while static .env API keys are copied into this Agent at creation. Requests use the same provider permissions and count toward the same subscriptions, quotas, and charges. Turning this off copies an isolated OAuth snapshot instead; API keys are still copied. The snapshot may require a separate sign-in, and later token refreshes can diverge or invalidate the other copy.',
      empty: 'Create empty (skip bundled skills)',
      nameTakenCaps: 'That name is taken — choose another before configuring capabilities.',
      nameFirstCaps: 'Name the Agent first. Opening this tab creates a draft profile, which is discarded if you cancel.',
      createFailed: 'Could not create the Agent.',
      sharedAuthUnavailable:
        'These provider accounts cannot safely use one shared refresh-token pool. Turn account sharing off to create an isolated snapshot, or sign in and create this Agent from the main Hermes profile without a private credential pool.',
      sharedAuthUnsupported:
        'This Agent source cannot confirm safe account sharing yet. Update Hermes on that source, or turn account sharing off to create an isolated snapshot.',
      created: name => `Agent "${name}" created`,
      createdOn: (name, target) => `Agent "${name}" created on ${target}`,
      creating: 'Creating…',
      action: 'Create Agent'
    },
    routines: {
      tab: 'Routines',
      untitled: 'Untitled routine',
      filterHint: 'Routines exist in this profile, but none belong to this Agent. Create a routine here or review all scheduled tasks in Cron.',
      nameNul: 'Routine name cannot contain NUL (U+0000).',
      instructionNul: 'Routine instruction cannot contain NUL (U+0000).',
      once: value => `Once (${value})`,
      daily: 'Daily',
      hourly: 'Hourly',
      everyDays: days => `Every ${days} days`,
      everyHours: hours => `Every ${hours}h`,
      everyMinutes: minutes => `Every ${minutes}m`,
      updateFailed: 'Routine update failed',
      delete: 'Delete routine',
      next: value => `next ${value}`,
      paused: 'paused',
      legacyPaused: 'Paused for security. Delete and recreate this legacy routine before running it again.',
      frequencyOnce: 'Once, in…',
      frequencyHourly: 'Every hour',
      frequencyDaily: 'Every day',
      frequencyWeekdays: 'Weekdays',
      frequencyWeekly: 'Every week',
      frequencyMonthly: 'Every month',
      frequencyInterval: 'Interval',
      frequencyAdvanced: 'Advanced…',
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday',
      am: 'AM',
      pm: 'PM',
      minuteUnit: 'minute(s)',
      hourUnit: 'hour(s)',
      dayUnit: 'day(s)',
      totalRuns: count => `, ${count} time(s) total`,
      summaryOnce: (count, unit) => `Runs once, ${count} ${unit} from now`,
      summaryHourly: 'Runs at the top of every hour',
      summaryDaily: time => `Runs every day at ${time}`,
      summaryWeekdays: time => `Runs Monday–Friday at ${time}`,
      summaryWeekly: (day, time) => `Runs every ${day} at ${time}`,
      summaryMonthly: (day, time) => `Runs on day ${day} of each month at ${time}`,
      summaryInterval: (count, unit) => `Runs every ${count} ${unit}`,
      summaryRaw: 'Raw schedule — every Nm/Nh/Nd or 5-field cron',
      rawPlaceholder: 'every 1d · every 2h · 0 9 * * * (cron)',
      minutesFromNow: 'minutes from now',
      hoursFromNow: 'hours from now',
      daysFromNow: 'days from now',
      minutes: 'minutes',
      hours: 'hours',
      days: 'days',
      dayOfMonth: 'Day of month',
      stopAfter: 'Stop after',
      runsForever: 'runs (blank = forever)',
      scheduled: title => `Routine "${title}" scheduled`,
      newTitle: 'New Routine',
      newDescription: name => `A recurring task ${name} runs on a schedule. Results stay in this Agent’s chat history.`,
      name: 'Name',
      namePlaceholder: 'Name this routine',
      instruction: 'Instruction',
      instructionPlaceholder: 'What should this routine do each time it runs?',
      when: 'When to run',
      continuity: 'Continuity: each run sees the previous run’s output so it can deduplicate or continue where it stopped',
      scheduling: 'Scheduling…',
      create: 'Create Routine',
      stale: 'Could not refresh routines. Showing the last list we had.',
      loadFailed: 'Could not load routines. The list may still be there.',
      createForAgent: 'Create a routine for this Agent'
    },
    sessions: {
      untitled: 'Untitled session',
      noMessages: 'No messages yet',
      heading: name => `${name} sessions`,
      filterAria: 'Filter sessions',
      filterPlaceholder: 'Filter sessions…',
      recent: count => `Showing the ${count} most recent sessions.`,
      loadFailed: 'Could not load sessions for this profile.',
      noRecentMatch: count => `No matching sessions in the ${count} most recent.`,
      noMatch: 'No sessions match that filter.',
      none: 'No stored sessions yet.',
      activeNow: 'Active now',
      openChat: name => `Open ${name}'s chat`
    },
    groups: {
      manage: 'Manage groups',
      manageDescription: 'An Agent can join multiple group chats. Memberships sync to every machine.',
      added: (name, group) => `${name} added to “${group}”`,
      removed: (name, group) => `${name} removed from “${group}”`,
      newPlaceholder: 'New group…',
      namePlaceholder: 'Group name (for example, Research)',
      createJoin: 'Create & join',
      removeAll: 'Remove from all groups',
      created: (name, count) => `“${name}” created with ${count} Agents`,
      newChat: 'New Group Chat',
      pickDescription: count => `Pick 2–${count} Agents. Local memberships sync through each Agent profile; cross-machine members remain scoped to this room.`,
      searchAria: 'Search Agents to add',
      searchPlaceholder: 'Search Agents to add…',
      removeSelection: 'Remove from selection',
      inGroups: names => `in ${names}`,
      noMatch: query => `No Agents match “${query}”`,
      noAgents: 'No Agents yet — create an Agent first.',
      nameAria: 'Group name',
      pickMinimum: 'Pick at least 2 Agents',
      createAction: count => `Create Group${count ? ` (${count})` : ''}`,
      chatHeading: group => `${group} — group chat`,
      memberCount: count => `${count} Agents`,
      disbandTitle: group => `Disband the ${group} group chat`,
      you: 'You',
      hideHandle: 'Hide full handle',
      showHandle: 'Show full handle',
      empty: 'Say something — every Agent in this group hears the room.',
      thinking: name => `${name} is thinking…`,
      working: 'The room is working…',
      messageAria: group => `Message ${group}`,
      messagePlaceholder: group => `Message ${group}… (@name to direct, @everyone for all)`,
      send: 'Send',
      disbandConfirm: 'Disband group chat?',
      disbandDescription: (group, count) => `This removes the ${group} grouping from its ${count} Agents and clears the shared room log. The Agents and their existing group sessions are kept.`,
      disband: 'Disband',
      disbanding: 'Disbanding…',
      disbanded: 'Disbanded',
      disbandedToast: group => `Disbanded “${group}”`,
      noMessages: 'No messages yet — say hi to the room',
      needsInputTitle: 'An Agent in this room needs your input',
      needsYou: 'needs you'
    },
    palette: {
      manage: 'Agents: Manage',
      newAgent: 'Agents: New Agent…'
    },
    manifest: {
      description: 'Create and manage Agent profiles, capabilities, groups, and routines.'
    },
    management: {
      title: 'Manage Agents',
      description: 'Create, edit, copy, delete, group, and configure Agent capabilities and routines.',
      agents: 'Agents',
      routines: 'Routines'
    }
  },
  vi: {
    common: {
      back: 'Quay lại',
      cancel: 'Hủy',
      save: 'Lưu',
      saving: 'Đang lưu…',
      retry: 'Thử lại',
      retryNow: 'Thử lại ngay',
      delete: 'Xóa',
      deleting: 'Đang xóa…',
      deleted: 'Đã xóa',
      working: 'Đang xử lý…',
      search: 'Tìm kiếm',
      searching: 'Đang tìm…',
      sessions: 'Các phiên',
      editProfile: 'Sửa hồ sơ Agent',
      duplicate: 'Sao chép',
      newAgent: 'Agent mới',
      newGroupChat: 'Nhóm trò chuyện mới'
    },
    session: {
      title: 'Agents',
      trigger: count => (count ? `Agents · ${count} cộng tác` : 'Mời Agent cộng tác'),
      lead: 'Agent chủ trì',
      leadHelp: 'Mời Agent cộng tác không thay đổi Agent chủ trì.',
      collaborators: 'Agents đang tham gia',
      invited: 'Đã mời',
      waiting: 'chờ giao việc',
      active: 'đang hoạt động',
      ready: 'sẵn sàng',
      scope: 'Thêm vào',
      scopeSession: 'Phiên này',
      scopeProject: 'Dự án này',
      sessionUnavailable: 'Hãy gửi tin nhắn đầu tiên trước khi mời Agent vào phiên này.',
      projectUnavailable: 'Hãy chọn thư mục dự án trước khi mời Agent vào dự án.',
      search: 'Tìm theo Agent, vai trò, model hoặc năng lực…',
      noMatch: 'Không có Agent phù hợp với tìm kiếm.',
      noCandidates: 'Chưa có Agent khác để mời.',
      invite: name => `Mời ${name}`,
      joined: 'Đang tham gia',
      remove: name => `Xóa ${name} khỏi phạm vi này`,
      removed: name => `${name} đã rời phạm vi này`,
      added: name => `Đã mời ${name} làm Agent cộng tác`,
      workHint: handle => `Dùng @${handle} trong ô soạn thảo để giao việc. Việc mời không tự gọi model.`,
      manage: 'Quản lý Agents',
      unavailable: 'Không kết nối được từ nguồn này',
      capabilities: 'Chưa có mô tả năng lực',
      skills: count => `${count} kỹ năng`
    },
    activity: {
      newMessage: label => `🤖 Tin nhắn mới cho ${label}`,
      newActivity: label => `${label} có hoạt động mới`,
      openChat: 'Mở cuộc trò chuyện để xem.'
    },
    profile: {
      copySuffix: '(bản sao)',
      noDuplicateName: 'Không còn tên trống cho bản sao.',
      duplicateStarted: name => `Đang sao chép ${name}…`,
      duplicateCreated: (name, source) => `Đã tạo ${name} — bản sao đầy đủ của ${source}`,
      duplicateFailed: 'Sao chép thất bại',
      deleteFailed: name => `Không thể xóa hồ sơ ${name}`,
      deleted: name => `Đã xóa hồ sơ ${name}`,
      draftDiscarded: name => `Đã hủy Agent nháp "${name}"`,
      draftCleanupFailed: name => `Không thể dọn hồ sơ nháp "${name}"`,
      sourceChanged: 'Nguồn Agent đang hoạt động đã thay đổi. Hãy mở lại thao tác từ đúng nguồn.',
      openChatFailed: name => `Không thể mở cuộc trò chuyện của ${name} — hãy thử lại`,
      sessionOpenFailed: 'Không thể mở phiên',
      unsupportedSessionOpen: 'Phiên bản Hermes Vietnamese này chưa thể mở phiên đã lưu',
      conversation: 'Cuộc trò chuyện',
      intro: 'Hãy giới thiệu về bạn nhé!',
      continuousTitle: 'Cuộc trò chuyện Agent này không đặt lại',
      continuousMessage:
        'Cuộc trò chuyện Agent là một mạch liên tục, nên Hermes sẽ thu gọn ngữ cảnh thay vì đặt lại. Muốn trao đổi tạm thời với Agent này, hãy mở một phiên riêng.'
    },
    remote: {
      stayHere: handle => `Hãy ở lại cuộc trò chuyện này và dùng @${handle} để nhắn cho Agent. Gateway vẫn ở thiết bị hiện tại.`,
      couldNotReach: label => `Không thể kết nối tới ${label}`,
      sourceFallback: 'nguồn từ xa',
      livesOn: label => `Hoạt động trên ${label}`,
      messaged: handle => `Đã nhắn @${handle}. Agent này sẽ chuyển tiếp câu trả lời khi nhận được.`,
      noReply: (handle, label) => `@${handle} chưa trả lời — hãy kiểm tra cuộc trò chuyện Agent trên ${label}.`,
      deliveryFailed: handle => `Không thể kết nối tới @${handle}.`,
      updateRequired: 'Hãy cập nhật Hermes Vietnamese để trò chuyện với Agents trên kết nối khác.',
      stillOn: (current, target) => `Vẫn đang ở ${current}, chưa chuyển tới ${target}`,
      sourceUnavailable: (profile, source) => `Agent ${profile} hiện không khả dụng trên ${source}.`,
      noSession: 'Chưa có phiên Agent từ xa'
    },
    mcp: {
      addFailed: 'Không thể thêm máy chủ',
      noTarget: 'Chưa có hồ sơ đích',
      setFailed: key => `Không thể đặt ${key}`,
      configured: name => `Đã cấu hình ${name}`,
      testFailed: 'Kiểm tra máy chủ thất bại sau khi thiết lập',
      oauthStartFailed: 'Không thể bắt đầu OAuth',
      completeSignIn: 'Hoàn tất đăng nhập trong trình duyệt…',
      authenticated: name => `Đã xác thực ${name}`,
      oauthFailed: 'OAuth thất bại',
      needsSetup: keys => `cần thiết lập (${keys}) — khởi động lại gateway để bật thiết lập trong ứng dụng`,
      setUpDone: 'đã thiết lập ✓',
      saveAndTest: 'Lưu và kiểm tra',
      authorizing: 'Đang xác thực…',
      setupFailed: 'Thiết lập thất bại',
      signIn: 'Đăng nhập…',
      setUp: 'Thiết lập…',
      none: 'Chưa có máy chủ MCP nào được cấu hình hoặc có trong danh mục.',
      catalog: 'danh mục',
      catalogInstalled: 'danh mục · đã cài',
      createHelp:
        'Máy chủ đã cấu hình được sao chép từ hồ sơ chính; các mục trong danh mục là menu MCP đi kèm. Mục cần API key sẽ qua bước thiết lập trước, và thông tin xác thực tuân theo lựa chọn chia sẻ tài khoản.'
    },
    avatar: {
      shapeTab: 'Agent',
      generateTab: 'Tạo ảnh',
      uploadTab: 'Tải lên',
      petTab: 'Thú cưng',
      removeImage: 'Bỏ ảnh — dùng hình dạng',
      describe: 'Mô tả ảnh đại diện…',
      generating: 'Đang tạo…',
      generate: 'Tạo ảnh',
      blankHint: 'Để trống để tạo từ tên và mô tả của Agent.',
      noModel: 'Chưa có model tạo ảnh. Nếu vừa bật model hoặc cập nhật Hermes, hãy khởi động lại gateway từ menu.',
      checking: 'Đang kiểm tra dịch vụ tạo ảnh…',
      chooseImage: 'Chọn ảnh…',
      tooLarge: 'Ảnh quá lớn (tối đa 15 MB).',
      generationFailed: 'Tạo ảnh đại diện thất bại',
      backendFailed: 'tạo ảnh thất bại'
    },
    pet: {
      none: 'Chưa có thú cưng trong bộ sưu tập petdex. Chạy `hermes pets` để khám phá.',
      pick: 'Chọn một thú cưng làm ảnh hồ sơ của Agent.',
      search: count => `Tìm trong ${count} thú cưng…`,
      remove: 'Bỏ — quay lại ảnh theo hình dạng',
      noMatch: 'Không có thú cưng phù hợp.',
      loadFailed: 'Không thể tải thú cưng này — hãy thử con khác.',
      more: (shown, total) => `Cuộn để xem thêm (${shown}/${total})`
    },
    roster: {
      noConversations: 'Chưa có cuộc trò chuyện — hãy chào Agent',
      pinned: 'Đã ghim',
      hidden: 'Đã ẩn khỏi danh sách Agents',
      unread: 'chưa đọc',
      activeRecently: 'Hoạt động trong 90 giây vừa qua',
      lastFrom: handle => `Tin nhắn gần nhất từ @${handle} (Agent với Agent)`,
      unpinned: name => `Đã bỏ ghim ${name}`,
      pinnedTop: name => `Đã ghim ${name} lên đầu`,
      unpin: 'Bỏ ghim',
      pinTop: 'Ghim lên đầu',
      visibleAgain: name => `${name} đã trở lại danh sách Agents`,
      hiddenNotice: name => `Đã ẩn ${name} — dùng nút hình mắt trong tiêu đề Agents để hiện các Agent đang ẩn`,
      unhide: 'Bỏ ẩn Agent',
      hide: 'Ẩn Agent',
      groups: names => `Nhóm: ${names}…`,
      manageGroups: 'Quản lý nhóm…',
      newChat: 'Cuộc trò chuyện mới với Agent này',
      title: 'Agents',
      toastsOn: 'Đang bật thông báo hoạt động — chọn để tắt',
      toastsOff: 'Đang tắt thông báo hoạt động — chọn để bật',
      hideHiddenAgain: 'Ẩn lại các Agent đang ẩn',
      showHidden: count => `Hiện ${count} Agent đang ẩn`,
      hideHidden: 'Ẩn các Agent đang ẩn',
      showHiddenAria: 'Hiện các Agent đang ẩn',
      hiddenUnread: 'một Agent đang ẩn có hoạt động chưa đọc',
      newMenu: 'Mới…',
      newAria: 'Tạo Agent hoặc nhóm trò chuyện',
      searchAria: 'Tìm Agents',
      searchPlaceholder: 'Tìm Agents…',
      stale: 'Làm mới danh sách Agents thất bại — đang hiện dữ liệu tốt gần nhất.',
      waitingReconnect: ' Đang chờ gateway kết nối lại…',
      unavailable: error => `Không có danh sách Agents: ${error}. Nếu gateway chưa hỗ trợ profiles.list, hãy cập nhật Hermes và khởi động lại gateway.`,
      gatewayError: 'lỗi gateway',
      waitingGateway: 'Đang chờ kết nối gateway… Gateway từ xa có thể mất vài giây; ứng dụng sẽ tự thử lại.',
      none: 'Chưa có Agent',
      noneHelp: 'Hãy tạo Agent cộng tác đầu tiên.',
      noMatch: query => `Không có Agent khớp “${query}”`,
      allHidden: 'Tất cả Agent đang bị ẩn — dùng nút hình mắt phía trên để hiện lại.',
      deleteTitle: 'Xóa Agent và hồ sơ?',
      deleteDescriptionStart: 'Thao tác này sẽ xóa vĩnh viễn Agent ',
      deleteDescriptionMiddle: ' cùng hồ sơ Hermes tại ',
      deleteDescriptionEnd: '. Không thể hoàn tác.'
    },
    model: {
      gatewayDefault: 'mặc định của gateway',
      provider: 'Nhà cung cấp',
      model: 'Model',
      providerCustom: 'Nhà cung cấp (tùy chỉnh)',
      modelCustom: 'Model (tùy chỉnh)',
      backToDropdowns: '← Quay lại danh sách chọn',
      inherit: 'Kế thừa (hồ sơ khởi chạy)',
      manual: '✏️ Nhập thủ công…',
      providerPlaceholder: 'omnirouter / 9router / nous …',
      modelPlaceholder: 'antigravity/gemini-3.6-flash-high',
      providerExample: 'ví dụ: omnirouter, inferx, 9router',
      modelExample: 'ví dụ: antigravity/gemini-3.6-flash-high',
      exampleName: 'ví dụ: tên model',
      inherited: 'kế thừa từ hồ sơ khởi chạy'
    },
    advanced: {
      newerGateway: 'Cấu hình đầy đủ cần gateway mới hơn. Hãy khởi động lại gateway sau khi cập nhật Hermes.',
      capabilitiesNow: 'Năng lực (áp dụng ngay — kỹ năng, công cụ, MCP)',
      soulProtocol: 'SOUL.md (tính cách + giao thức nhắn tin giữa Agents)',
      skillsEnabled: (enabled, total) => `Kỹ năng (${enabled}/${total} đang bật)`,
      filterSkills: 'Lọc kỹ năng…',
      toolsetsEnabled: (enabled, total) => `Bộ công cụ (${enabled}/${total} đang bật — bỏ chọn tất cả để về mặc định)`,
      mcpServers: 'Máy chủ MCP',
      catalogSource: source => `Danh mục từ ${source} — kỹ năng bỏ chọn sẽ bị tắt sau khi tạo.`,
      defaultTools: 'Chọn tất cả hoặc không chọn mục nào sẽ giữ hành vi bộ công cụ mặc định.',
      catalogNeedsGateway: 'Danh mục năng lực cần gateway mới hơn. Hãy khởi động lại gateway sau khi cập nhật Hermes.',
      emptySkills: 'Đã chọn “Tạo trống” — kỹ năng đi kèm sẽ không được cài.'
    },
    hub: {
      installed: label => `Đã cài kỹ năng "${label}"`,
      installFailed: label => `Cài "${label}" thất bại`,
      title: 'Kho kỹ năng',
      hide: 'ẩn trình duyệt kho',
      browse: 'duyệt toàn bộ kho ▾',
      frameTitle: 'Kho kỹ năng Hermes',
      installing: label => `Đang cài "${label}"…`,
      addHint: 'Chọn “+ Thêm vào Agent này” trên một kỹ năng. Kỹ năng sẽ được cài và xuất hiện phía trên; kéo góc để đổi kích thước.',
      searchPlaceholder: 'Tìm trong kho (cộng đồng + nguồn phổ biến)…',
      searchingHint: 'Đang tìm trong cộng đồng và các nguồn phổ biến — có thể mất khoảng 10 giây…',
      noMatch: 'Không có kỹ năng phù hợp trong kho.',
      added: '✓ đã thêm',
      installTitle: name => `Cài "${name}" và thêm vào danh sách phía trên`
    },
    edit: {
      title: 'Sửa hồ sơ Agent',
      description: (name, profile) => `Diện mạo và vai trò của ${name} (${profile}).`,
      nameTitle: 'Chức danh',
      descriptionLabel: 'Mô tả',
      descriptionPlaceholder: 'Agent này nên hỗ trợ việc gì?',
      advanced: 'Nâng cao — model, kỹ năng, bộ công cụ, SOUL.md',
      localLookFailed: 'Đã lưu diện mạo trên máy; đồng bộ từ xa thất bại',
      descriptionFailed: 'Đã lưu diện mạo trên máy; cập nhật mô tả thất bại',
      sectionsFailed: names => `Một số phần thất bại: ${names}`,
      advancedFailed: 'Cấu hình nâng cao thất bại',
      updated: name => `Đã cập nhật ${name}`
    },
    create: {
      title: 'Agent mới',
      description: 'Một cộng sự có tên riêng, bộ nhớ, kỹ năng và cuộc trò chuyện riêng. Agent này có thể nhắn cho các Agent khác.',
      name: 'Tên',
      namePlaceholder: 'inbox-triage',
      duplicateLocal: name => `Đã có Agent tên "${name}".`,
      duplicateRemote: (name, target) => `Đã có Agent tên "${name}" trên ${target}.`,
      createOn: 'Tạo trên',
      current: label => `${label} (hiện tại)`,
      remoteHelp: target => `Agent được tạo trên ${target} và xuất hiện trong danh sách như một Agent qua Kết nối. Cuộc trò chuyện được chuyển tới máy đó.`,
      titleLabel: 'Chức danh',
      titlePlaceholder: 'Sàng lọc hộp thư',
      descriptionLabel: 'Mô tả',
      descriptionPlaceholder: 'Agent này nên hỗ trợ việc gì?',
      advanced: 'Nâng cao',
      general: 'Chung',
      capabilities: 'Năng lực',
      skills: 'Kỹ năng',
      tools: 'Công cụ',
      mcp: 'MCP',
      profileNotReady: 'Chưa thể tạo hồ sơ',
      clone: 'Sao chép từ hồ sơ',
      cloneOn: target => `Sao chép từ hồ sơ (trên ${target})`,
      fresh: 'Hồ sơ mới (có kỹ năng đi kèm)',
      soul: 'SOUL.md (không bắt buộc — thay thế tính cách được tạo tự động)',
      soulHint: 'Để trống để tạo từ tên, chức danh, mô tả và danh sách nhắn tin giữa Agents.',
      shareAuth: 'Dùng chung tài khoản nhà cung cấp; sao chép khóa API từ hồ sơ chính',
      shareAuthHelp:
        'Khi bật, token OAuth và tài khoản dùng một kho chung; khóa API tĩnh trong .env được sao chép vào Agent lúc tạo. Yêu cầu dùng cùng quyền nhà cung cấp và được tính vào cùng gói đăng ký, hạn mức, chi phí. Khi tắt, phần OAuth được sao chép thành bản tách biệt; khóa API vẫn được sao chép. Bản tách biệt có thể cần đăng nhập riêng, và lần làm mới token sau đó có thể làm hai bản lệch nhau hoặc vô hiệu hóa bản còn lại.',
      empty: 'Tạo trống (bỏ qua kỹ năng đi kèm)',
      nameTakenCaps: 'Tên này đã được dùng — hãy chọn tên khác trước khi cấu hình năng lực.',
      nameFirstCaps: 'Hãy đặt tên Agent trước. Khi mở thẻ này, một hồ sơ nháp sẽ được tạo và bị hủy nếu bạn bấm Hủy.',
      createFailed: 'Không thể tạo Agent.',
      sharedAuthUnavailable:
        'Các tài khoản nhà cung cấp này chưa thể dùng chung an toàn một kho token làm mới. Hãy tắt chia sẻ tài khoản để tạo bản tách biệt, hoặc đăng nhập và tạo Agent này từ hồ sơ Hermes chính không có kho thông tin xác thực riêng.',
      sharedAuthUnsupported:
        'Nguồn Agent này chưa thể xác nhận việc chia sẻ tài khoản an toàn. Hãy cập nhật Hermes trên nguồn đó, hoặc tắt chia sẻ tài khoản để tạo bản tách biệt.',
      created: name => `Đã tạo Agent "${name}"`,
      createdOn: (name, target) => `Đã tạo Agent "${name}" trên ${target}`,
      creating: 'Đang tạo…',
      action: 'Tạo Agent'
    },
    routines: {
      tab: 'Tác vụ định kỳ',
      untitled: 'Tác vụ chưa đặt tên',
      filterHint: 'Hồ sơ này có tác vụ định kỳ nhưng chưa có tác vụ nào thuộc Agent hiện tại. Hãy tạo tác vụ tại đây hoặc xem toàn bộ lịch trong Cron.',
      nameNul: 'Tên tác vụ không được chứa NUL (U+0000).',
      instructionNul: 'Chỉ dẫn tác vụ không được chứa NUL (U+0000).',
      once: value => `Một lần (${value})`,
      daily: 'Hằng ngày',
      hourly: 'Hằng giờ',
      everyDays: days => `Mỗi ${days} ngày`,
      everyHours: hours => `Mỗi ${hours} giờ`,
      everyMinutes: minutes => `Mỗi ${minutes} phút`,
      updateFailed: 'Cập nhật tác vụ thất bại',
      delete: 'Xóa tác vụ',
      next: value => `lần tới ${value}`,
      paused: 'đã tạm dừng',
      legacyPaused: 'Đã tạm dừng để bảo đảm an toàn. Hãy xóa và tạo lại tác vụ cũ này trước khi chạy lại.',
      frequencyOnce: 'Một lần, sau…',
      frequencyHourly: 'Mỗi giờ',
      frequencyDaily: 'Mỗi ngày',
      frequencyWeekdays: 'Ngày làm việc',
      frequencyWeekly: 'Mỗi tuần',
      frequencyMonthly: 'Mỗi tháng',
      frequencyInterval: 'Khoảng lặp',
      frequencyAdvanced: 'Nâng cao…',
      monday: 'Thứ Hai',
      tuesday: 'Thứ Ba',
      wednesday: 'Thứ Tư',
      thursday: 'Thứ Năm',
      friday: 'Thứ Sáu',
      saturday: 'Thứ Bảy',
      sunday: 'Chủ Nhật',
      am: 'SA',
      pm: 'CH',
      minuteUnit: 'phút',
      hourUnit: 'giờ',
      dayUnit: 'ngày',
      totalRuns: count => `, tổng cộng ${count} lần`,
      summaryOnce: (count, unit) => `Chạy một lần sau ${count} ${unit}`,
      summaryHourly: 'Chạy vào đầu mỗi giờ',
      summaryDaily: time => `Chạy mỗi ngày lúc ${time}`,
      summaryWeekdays: time => `Chạy từ Thứ Hai đến Thứ Sáu lúc ${time}`,
      summaryWeekly: (day, time) => `Chạy vào ${day} hằng tuần lúc ${time}`,
      summaryMonthly: (day, time) => `Chạy vào ngày ${day} hằng tháng lúc ${time}`,
      summaryInterval: (count, unit) => `Chạy mỗi ${count} ${unit}`,
      summaryRaw: 'Lịch thô — every Nm/Nh/Nd hoặc cron 5 trường',
      rawPlaceholder: 'every 1d · every 2h · 0 9 * * * (cron)',
      minutesFromNow: 'phút kể từ bây giờ',
      hoursFromNow: 'giờ kể từ bây giờ',
      daysFromNow: 'ngày kể từ bây giờ',
      minutes: 'phút',
      hours: 'giờ',
      days: 'ngày',
      dayOfMonth: 'Ngày trong tháng',
      stopAfter: 'Dừng sau',
      runsForever: 'lần chạy (để trống = không giới hạn)',
      scheduled: title => `Đã lên lịch tác vụ "${title}"`,
      newTitle: 'Tác vụ định kỳ mới',
      newDescription: name => `Một tác vụ lặp lại do ${name} thực hiện theo lịch. Kết quả nằm trong lịch sử trò chuyện của Agent này.`,
      name: 'Tên',
      namePlaceholder: 'Đặt tên tác vụ',
      instruction: 'Chỉ dẫn',
      instructionPlaceholder: 'Tác vụ này nên làm gì trong mỗi lần chạy?',
      when: 'Thời điểm chạy',
      continuity: 'Liên tục: mỗi lần chạy thấy kết quả lần trước để tránh lặp hoặc tiếp tục phần còn dở',
      scheduling: 'Đang lên lịch…',
      create: 'Tạo tác vụ',
      stale: 'Không thể làm mới tác vụ. Đang hiện danh sách gần nhất.',
      loadFailed: 'Không thể tải tác vụ. Danh sách có thể vẫn còn.',
      createForAgent: 'Tạo tác vụ cho Agent này'
    },
    sessions: {
      untitled: 'Phiên chưa đặt tên',
      noMessages: 'Chưa có tin nhắn',
      heading: name => `Các phiên của ${name}`,
      filterAria: 'Lọc phiên',
      filterPlaceholder: 'Lọc phiên…',
      recent: count => `Đang hiện ${count} phiên gần nhất.`,
      loadFailed: 'Không thể tải các phiên của hồ sơ này.',
      noRecentMatch: count => `Không có phiên phù hợp trong ${count} phiên gần nhất.`,
      noMatch: 'Không có phiên phù hợp với bộ lọc.',
      none: 'Chưa có phiên nào được lưu.',
      activeNow: 'Đang hoạt động',
      openChat: name => `Mở cuộc trò chuyện của ${name}`
    },
    groups: {
      manage: 'Quản lý nhóm',
      manageDescription: 'Một Agent có thể tham gia nhiều nhóm trò chuyện. Thành viên được đồng bộ giữa các máy.',
      added: (name, group) => `Đã thêm ${name} vào “${group}”`,
      removed: (name, group) => `Đã xóa ${name} khỏi “${group}”`,
      newPlaceholder: 'Nhóm mới…',
      namePlaceholder: 'Tên nhóm (ví dụ: Nghiên cứu)',
      createJoin: 'Tạo và tham gia',
      removeAll: 'Rời khỏi mọi nhóm',
      created: (name, count) => `Đã tạo “${name}” với ${count} Agent`,
      newChat: 'Nhóm trò chuyện mới',
      pickDescription: count => `Chọn 2–${count} Agent. Thành viên cục bộ đồng bộ qua từng hồ sơ Agent; thành viên ở máy khác chỉ thuộc phòng này.`,
      searchAria: 'Tìm Agent để thêm',
      searchPlaceholder: 'Tìm Agent để thêm…',
      removeSelection: 'Bỏ khỏi lựa chọn',
      inGroups: names => `trong ${names}`,
      noMatch: query => `Không có Agent khớp “${query}”`,
      noAgents: 'Chưa có Agent — hãy tạo Agent trước.',
      nameAria: 'Tên nhóm',
      pickMinimum: 'Chọn ít nhất 2 Agent',
      createAction: count => `Tạo nhóm${count ? ` (${count})` : ''}`,
      chatHeading: group => `${group} — nhóm trò chuyện`,
      memberCount: count => `${count} Agent`,
      disbandTitle: group => `Giải tán nhóm trò chuyện ${group}`,
      you: 'Bạn',
      hideHandle: 'Ẩn định danh đầy đủ',
      showHandle: 'Hiện định danh đầy đủ',
      empty: 'Hãy nhắn gì đó — mọi Agent trong nhóm đều nghe được.',
      thinking: name => `${name} đang suy nghĩ…`,
      working: 'Nhóm đang làm việc…',
      messageAria: group => `Nhắn cho ${group}`,
      messagePlaceholder: group => `Nhắn cho ${group}… (@tên để chỉ định, @everyone cho tất cả)`,
      send: 'Gửi',
      disbandConfirm: 'Giải tán nhóm trò chuyện?',
      disbandDescription: (group, count) => `Thao tác này xóa nhóm ${group} khỏi ${count} Agent và xóa nhật ký phòng chung. Các Agent và phiên nhóm hiện có vẫn được giữ.`,
      disband: 'Giải tán',
      disbanding: 'Đang giải tán…',
      disbanded: 'Đã giải tán',
      disbandedToast: group => `Đã giải tán “${group}”`,
      noMessages: 'Chưa có tin nhắn — hãy chào cả nhóm',
      needsInputTitle: 'Một Agent trong phòng cần bạn hỗ trợ',
      needsYou: 'cần bạn'
    },
    palette: {
      manage: 'Agents: Quản lý',
      newAgent: 'Agents: Agent mới…'
    },
    manifest: {
      description: 'Tạo và quản lý hồ sơ Agent, năng lực, nhóm và tác vụ định kỳ.'
    },
    management: {
      title: 'Quản lý Agents',
      description: 'Xem, tạo, sửa, sao chép, xóa, lập nhóm và cấu hình năng lực cùng tác vụ định kỳ.',
      agents: 'Agents',
      routines: 'Tác vụ định kỳ'
    }
  }
}

function englishAgentText(key, args) {
  let value = AGENT_LOCALES.en

  for (const part of key.split('.')) {
    value = value?.[part]
  }

  return typeof value === 'function' ? value(...args) : typeof value === 'string' ? value : key
}

function agentText(key, ...args) {
  try {
    const value = pluginCtx?.i18n?.t?.(key, ...args)

    return value && value !== key ? value : englishAgentText(key, args)
  } catch {
    return englishAgentText(key, args)
  }
}

function useAgentText() {
  const translate = usePluginTranslate(ID)

  return (key, ...args) => {
    try {
      const value = translate(key, ...args)

      return value && value !== key ? value : englishAgentText(key, args)
    } catch {
      return englishAgentText(key, args)
    }
  }
}

function registerAgentLocales(ctx) {
  if (typeof ctx?.i18n?.register !== 'function') {
    return false
  }

  ctx.i18n.register(AGENT_LOCALES)

  return true
}

function agentManifestDescription(text = agentText) {
  return text('manifest.description')
}

/** Captured in register() so components can reach plugin storage. */
let pluginCtx = null

/** Live roster snapshot for imperative handlers (context menus). */
const $lastRoster = atom([])
const $lastRosterOwner = atom(null)

/** Bots with chat activity the user hasn't seen yet (name -> true).
 *  Fed by the roster poll's activity watermark, so it catches EVERY
 *  delivery path: RPC, CLI (bot-to-bot), cron runs, other machines. */
const $botUnread = atom({})

// last_active watermark per bot, seeded on first poll so a fresh mount
// doesn't mark ancient history unread.
const rosterWatermarks = new Map()
let watermarksSeeded = false

/** User pref: toast on every new bot activity. Default OFF — a busy roster
 *  (cron runs, bot-to-bot chatter) turns the toasts into a firehose, and the
 *  unread badge already carries the signal. Persisted via ctx.storage. */
const $activityToasts = atom(false)

/** Additive v31 participation metadata. Legacy profiles/sessions/groups and
 *  Bot Mode storage remain untouched; malformed or absent data normalizes to
 *  an empty collaborator set. */
const $collaborationMemberships = atom({ schemaVersion: COLLABORATION_SCHEMA, projects: {}, sessions: {} })
const $collaborationProjectBindings = atom({})
const $collaborationSessionBindings = atom({})

/** Palette requests survive route navigation and open the creation dialog
 *  once the stable management page mounts. */
const $newAgentRequest = atom(0)
const DEFAULT_SHARE_AUTH = true

function agentCreateAuthPayload(shareAuth = DEFAULT_SHARE_AUTH) {
  return { share_auth: Boolean(shareAuth) }
}

function agentSharedAuthCreateResultAccepted(result, shareAuth) {
  if (!shareAuth) {
    return true
  }

  const payload = result?.result && typeof result.result === 'object' ? result.result : result

  return payload?.mirrored?.auth === 'shared'
}

function normalizeAgentConnections(value) {
  if (Array.isArray(value)) {
    return value
  }

  return Array.isArray(value?.connections) ? value.connections : []
}

function agentSourceUnavailableMessage(text, profile, source) {
  return text(
    'remote.sourceUnavailable',
    String(profile || 'default').trim() || 'default',
    String(source || text('remote.sourceFallback')).trim() || text('remote.sourceFallback')
  )
}

/** Immutable identity of the backend on which a lazily materialized create
 * draft lives. Form state is allowed to repaint after an RPC starts; cleanup
 * must never re-read that mutable state and accidentally delete a same-named
 * real profile on another source. */
function createAgentDraftProvenance({
  slug,
  remoteTarget = false,
  targetConnectionId = '',
  activeConnectionId = '',
  activeProfile = 'default',
  targetMode = null
}) {
  const profile = remoteTarget ? 'default' : String(activeProfile || 'default').trim() || 'default'
  const connectionId = String(remoteTarget ? targetConnectionId : activeConnectionId || 'local').trim() || 'local'
  const mode = targetMode === 'local' || targetMode === 'remote' ? targetMode : connectionId === 'local' ? 'local' : 'remote'
  const route = Object.freeze({ connectionId, mode, profile, targetProfile: profile })

  return Object.freeze({
    slug: String(slug || '').trim(),
    connectionId,
    remoteTarget: Boolean(remoteTarget),
    route
  })
}

/** Route one create-draft operation through its captured owner. The active
 * request door is a legacy-only fallback for single-source SDKs; modern
 * multi-source drafts always carry a descriptor. */
function requestAgentDraft(runtime, draft, method, params = {}) {
  if (draft?.route && typeof runtime?.requestProfile === 'function') {
    return runtime.requestProfile(draft.route, method, params)
  }

  const owner = normalizeRosterOwner(draft?.connectionId, draft?.route?.profile)

  if (
    !draft?.remoteTarget &&
    owner &&
    rosterOwnerStillActive(owner, runtime) &&
    typeof runtime?.request === 'function'
  ) {
    return runtime.request(method, params)
  }

  return Promise.reject(
    new Error(
      agentSourceUnavailableMessage(
        agentText,
        draft?.slug || draft?.route?.profile,
        draft?.route?.connectionId
      )
    )
  )
}

/** Read the capability from the exact backend captured by a create draft.
 *  Failure is conservative: appending the legacy section is harmless, while
 *  consulting another active source would couple two same-named profiles. */
async function agentDraftProtocolInjected(runtime, draft) {
  try {
    const result = await requestAgentDraft(runtime, draft, 'profiles.list', {})
    return Boolean(result?.bot_mode_protocol)
  } catch {
    return false
  }
}

async function applyAgentDraftAppearance(runtime, draft, appearance) {
  const { image, ...look } = appearance || {}
  const writes = [
    requestAgentDraft(runtime, draft, 'profiles.configure', {
      name: draft?.slug,
      ui_meta: { 'hermes-bots': look }
    })
  ]

  if (image) {
    writes.push(
      requestAgentDraft(runtime, draft, 'profiles.set_asset', {
        name: draft?.slug,
        asset: 'avatar',
        data: image
      })
    )
  }

  return Promise.allSettled(writes)
}

function agentDraftFinalizePlan(draft, currentOwner) {
  const origin = normalizeRosterOwner(draft?.connectionId, draft?.route?.profile)
  const current = normalizeRosterOwner(currentOwner?.connectionId, currentOwner?.profile)
  const ownerStillActive = sameRosterOwner(origin, current)

  return {
    connectionId: String(draft?.connectionId || '').trim(),
    openCanonical: Boolean(draft?.slug && !draft?.remoteTarget && ownerStillActive),
    remotePresentation: Boolean(draft?.remoteTarget || !ownerStillActive),
    slug: String(draft?.slug || '').trim()
  }
}

/** Small lifecycle used by CreateAgentDialog and behavior tests. It locks the
 * materialization inputs as soon as creation starts, shares one in-flight
 * create, and turns Cancel into a generation edge. If create resolves after
 * that edge, cleanup runs against the original immutable route exactly once. */
function createAgentDraftLifecycle({ cleanup, onChange } = {}) {
  let generation = 0
  let created = null
  let pending = null
  let flight = null

  const emit = value => {
    if (typeof onChange === 'function') {
      onChange(value)
    }
  }
  const clean = async draft => {
    if (draft && typeof cleanup === 'function') {
      await cleanup(draft)
    }
  }

  return {
    current: () => created || pending,
    created: () => created,
    ensure(draft, create, afterCreate, validateCreate) {
      if (created) {
        return Promise.resolve(created.slug)
      }
      if (flight) {
        return flight
      }

      const epoch = generation
      pending = draft
      emit(draft)

      const task = (async () => {
        let materialized = false

        try {
          const createResult = await Promise.resolve().then(() => create(draft))
          materialized = true

          if (typeof validateCreate === 'function') {
            await validateCreate(createResult, draft)
          }

          if (epoch !== generation) {
            await clean(draft)
            return null
          }

          pending = null
          created = draft
          emit(draft)

          if (typeof afterCreate === 'function') {
            await afterCreate(draft, () => epoch === generation)
          }

          if (epoch !== generation) {
            await clean(draft)
            return null
          }

          return draft.slug
        } catch (error) {
          if (materialized) {
            await clean(draft)
          }

          if (epoch !== generation) {
            return null
          }

          pending = null
          created = null
          emit(null)
          throw error
        } finally {
          if (flight === task) {
            flight = null
          }
        }
      })()

      flight = task
      return task
    },
    cancel() {
      generation += 1
      const settled = flight ? null : created
      pending = null
      created = null
      flight = null
      emit(null)

      return settled ? clean(settled) : Promise.resolve()
    },
    finalize() {
      generation += 1
      pending = null
      created = null
      flight = null
      emit(null)
    }
  }
}

function agentCreationFieldsLocked(draft) {
  return Boolean(draft?.slug)
}

function agentMcpSetupAvailable(remoteTarget) {
  return !Boolean(remoteTarget)
}

function sessionAgentStatusPresentation(kind, surface, text = agentText) {
  if (kind === 'lead') {
    const active = Boolean(surface?.runtimeSessionId && surface?.busy)
    const status = text(active ? 'session.active' : 'session.ready')

    return { active, aria: status, text: status }
  }

  const invited = text('session.invited')
  const waiting = text('session.waiting')
  const status = `${invited} · ${waiting}`

  return { active: false, aria: status, text: status }
}

function queueNewAgentRequest(request = $newAgentRequest) {
  const next = Math.max(0, Number(request.get()) || 0) + 1
  request.set(next)

  return next
}

function consumeNewAgentRequest(request = $newAgentRequest) {
  if (!(Number(request.get()) > 0)) {
    return false
  }

  request.set(0)

  return true
}

/** Flip the activity-toast pref and persist it. */
function setActivityToasts(enabled) {
  $activityToasts.set(enabled)

  try {
    Promise.resolve(pluginCtx?.storage?.set?.('activity-toasts', enabled)).catch(() => undefined)
  } catch {
    /* storage unavailable — pref holds for this window only */
  }
}

/** Detect new inbound activity from a fresh roster: last_active moved past
 *  the watermark for a bot whose chat isn't on screen -> unread + toast. */
function trackInboundActivity(roster) {
  const seeding = !watermarksSeeded
  watermarksSeeded = true

  for (const bot of roster) {
    const ts = bot.last_session?.last_active || 0
    const prev = rosterWatermarks.get(bot.name) || 0
    rosterWatermarks.set(bot.name, Math.max(prev, ts))

    if (seeding || ts <= prev) {
      continue
    }

    // Activity in the bot the user is currently looking at is already
    // visible — never badge the open chat.
    if ($selectedBot.get() === bot.name) {
      continue
    }

    $botUnread.set({ ...$botUnread.get(), [bot.name]: true })

    // Roster-hidden bots stay quiet: the unread flag above accumulates
    // silently (unhiding reveals the badge) but a hidden bot never toasts.
    if ($botMeta.get()[bot.name]?.hidden) {
      continue
    }

    // Toasts are opt-in: the unread badge is always set above, but the
    // per-message notification fires only when the user enabled it.
    if ($activityToasts.get()) {
      const meta = $botMeta.get()[bot.name]
      const label = displayName(bot, meta)
      const preview = (bot.last_session?.preview || '').trim()
      const inbound = /^Message from/i.test(preview)

      host.notify({
        kind: 'info',
        title: inbound ? agentText('activity.newMessage', label) : agentText('activity.newActivity', label),
        message: preview.slice(0, 140) || agentText('activity.openChat')
      })
    }
  }
}

/** Last good cron lists keyed by exact source/profile owner. */
const $lastJobs = atom({})

// Bot Mode sessions are ALWAYS hidden from the global Sessions sidebar:
// canonical Bot Chats are plugin-owned forever-chats and group-chat member
// sessions are room plumbing — neither is a scratch conversation, and a
// 6-member room would otherwise dump six identical "Group: ..." rows into
// recents. Backed by the core generic `hidden` session flag (session.create
// hidden:true / session.set_hidden); the Bots pane browses them via
// session.list include_hidden. Older gateways ignore the flag and the
// sessions simply stay visible there.

/** Bot the Routines tile is scoped to. Follows the live gateway profile
 *  (the bot you're actually chatting with) and roster clicks. */
const $selectedBot = atom('default')

/** Optional secondary navigation inside the Bots pane. Primary row clicks still
 * open the bot's canonical chat; this state opens its stored-session browser. */
const $botSessionsWorkspace = atom(null)
const $botSelectedSessions = atom({})
const $sessionsGatewayGeneration = atom(0)

/** Group-chat rooms: { [group]: { log: [{from:{kind,name},text,at}], watermarks:{[member]:idx}, epoch, running } }.
 *  Log + watermarks persist via plugin storage; epoch/running are runtime-only. */
const $groupChats = atom({})
/** Group whose room view is open in the Bots pane (secondary navigation,
 *  same pattern as $botSessionsWorkspace). */
const $groupChatWorkspace = atom(null)
/** Groups whose latest room activity mentions @user — the needs-you badge. */
const $groupNeedsYou = atom({})

function handleSessionsGatewayTransition() {
  $sessionsGatewayGeneration.set($sessionsGatewayGeneration.get() + 1)
  $botSelectedSessions.set({})
  // A gateway swap invalidates any in-flight room drive: bump every room's
  // epoch so running loops bail at their next member boundary.
  const rooms = { ...$groupChats.get() }

  for (const name of Object.keys(rooms)) {
    rooms[name] = { ...rooms[name], epoch: (rooms[name].epoch || 0) + 1, running: false }
  }

  $groupChats.set(rooms)
}

/** Per-bot appearance + display meta, persisted via ctx.storage:
 *  { [botName]: { shape, color, title } } */
const $botMeta = atom({})
/** Exact active roster owner for the legacy name-keyed metadata above.
 *  The map predates Connections and therefore has no source in its keys.
 *  It may only be used while this owner is the explicit local source. */
const $botMetaOwner = atom(null)

async function saveBotMeta(name, patch, sourceMeta = null, expectedOwner = null) {
  const writeOwner = expectedOwner ? currentBotMetaOwner() : null

  if (!expectedOwner || !sameRosterOwner(writeOwner, expectedOwner)) {
    return { serverPersisted: false, serverOutcome: 'failed' }
  }

  const localFallback = isExactLocalRosterOwner(writeOwner)
  const cacheOwner = $botMetaOwner.get()
  let prevMeta =
    sourceMeta && typeof sourceMeta === 'object' && !Array.isArray(sourceMeta)
      ? sourceMeta
      : localFallback && sameRosterOwner(cacheOwner, writeOwner)
        ? $botMeta.get()[name] || {}
        : null

  // A non-local active source must never use the legacy bare-name cache as
  // its merge base. Fetch that source's own namespace when the caller did
  // not already capture it from the rich roster row. If provenance is
  // unknown/offline, fail closed instead of overwriting a same-named Agent
  // with another source's title/pin/groups.
  if (!prevMeta && writeOwner && !localFallback) {
    try {
      const listed = await host.request('profiles.list', {})
      const profile = listed?.profiles?.find(value => value?.name === name)
      const serverMeta = profile?.ui_meta?.['hermes-bots']
      prevMeta = serverMeta && typeof serverMeta === 'object' ? serverMeta : {}

      if (!rosterOwnerStillActive(writeOwner)) {
        return { serverPersisted: false, serverOutcome: 'failed' }
      }
    } catch {
      return { serverPersisted: false, serverOutcome: 'failed' }
    }
  }

  if (!writeOwner) {
    return { serverPersisted: false, serverOutcome: 'failed' }
  }

  prevMeta ||= {}
  const entry = { ...prevMeta, ...patch }

  // Only the explicit local source may update the legacy name-keyed cache.
  // Remote sources render directly from their row-level server ui_meta.
  if (localFallback) {
    const current = sameRosterOwner(cacheOwner, writeOwner) || isExactLocalRosterOwner(cacheOwner)
      ? $botMeta.get()
      : {}
    const next = { ...current, [name]: entry }
    $botMetaOwner.set(writeOwner)
    $botMeta.set(next)

    // Local plugin storage: instant, and the fallback for older gateways.
    try {
      Promise.resolve(pluginCtx?.storage?.set?.('bot-meta', next)).catch(() => undefined)
    } catch {
      /* storage unavailable — look persists for this window only */
    }
  }

  // Server-side (source of truth when supported): profile.yaml ui_meta,
  // namespaced under this plugin's id — every client machine sees the same
  // roster. Return the outcome so user-initiated saves can distinguish a
  // cross-machine save from a local-only fallback instead of reporting a
  // false success. Data-URL fields are stripped from ui_meta (64KB cap,
  // rides every profiles.list); the avatar IMAGE goes to the profile asset
  // store instead (profiles.set_asset), which is server-side and uncapped by
  // the list call — so pfps follow the profile across machines too.
  let serverRequest = null
  try {
    const { image, pet, ...rest } = entry
    serverRequest = Promise.resolve(host.request('profiles.configure', { name, ui_meta: { 'hermes-bots': rest } }))
  } catch {
    /* older/unavailable gateway — the local fallback remains saved */
  }

  // Avatar image → profile asset store (feature-detected; local storage
  // remains the fallback rendering source on older gateways) — but only when
  // the image actually CHANGED. Every Edit Profile save sends the image key
  // (changed or not); a no-op `clear` from one machine can race another
  // machine's just-pushed avatar and wipe it server-side, and a no-op
  // `data` push re-uploads the full data URL for nothing.
  if ('image' in patch && patch.image !== (prevMeta.image ?? null)) {
    try {
      const req = patch.image
        ? host.request('profiles.set_asset', { name, asset: 'avatar', data: patch.image })
        : host.request('profiles.set_asset', { name, asset: 'avatar', clear: true })
      req.catch(() => undefined)
    } catch {
      /* older gateway */
    }
  }

  // Three-way outcome so callers can tell a REAL remote failure from the
  // documented legacy fallback ("older gateways reject the param shape;
  // that's fine, local wins"):
  //   'persisted'   — gateway confirmed applied.ui_meta === true
  //   'unsupported' — older gateway: request rejected, or response carries
  //                   no `applied` contract at all. Silent local fallback;
  //                   an error toast here would fire on EVERY save forever.
  //   'failed'      — gateway speaks the contract and explicitly reported
  //                   the ui_meta write did NOT apply.
  let serverOutcome = 'unsupported'
  if (serverRequest) {
    try {
      const result = await serverRequest
      if (result?.applied?.ui_meta === true) {
        serverOutcome = 'persisted'
      } else if (result && typeof result === 'object' && result.applied && typeof result.applied === 'object') {
        serverOutcome = 'failed'
      }
    } catch {
      // Only local has a durable fallback. A remote write that could not be
      // confirmed must surface as failed instead of pretending its look was
      // saved in another source's cache.
      serverOutcome = localFallback ? 'unsupported' : 'failed'
    }
  } else if (!localFallback) {
    serverOutcome = 'failed'
  }

  return { serverPersisted: serverOutcome === 'persisted', serverOutcome }
}

// ── hidden bots (right-click → Hide Bot) ────────────────────────────────────
// Hiding is a ROSTER-DISPLAY concern only: a hidden bot keeps working —
// @mentions still resolve, group-chat membership is untouched, its name
// still counts as taken, and an open chat stays open. The flag lives in bot
// meta (`hidden: true`), so it rides the same local-storage + server
// ui_meta pipeline as pins/titles and follows the profile across machines.
// Unhide writes `hidden: false` (never null): a null key survives the local
// `{ ...prev, ...patch }` merge while the server DELETES None keys, and
// that asymmetry lets mergeServerMeta resurrect a stale truthy copy. A
// literal false round-trips identically through both stores.

/** Session-only view toggle: reveal hidden bots (dimmed) in the roster. */
const $showHiddenBots = atom(false)

/** Hidden flag for a roster row. Thin remote-source rows never read local
 *  meta (botRosterMeta returns null for them), so hide is by NAME on the
 *  active source; remote rows of the same name stay visible. */
function isBotHidden(bot, metaByName, rosterOwner = null) {
  return Boolean(botRosterMeta(bot, metaByName, rosterOwner)?.hidden)
}

/** Hiding the selected bot re-homes the selection (the Routines pane
 *  follows it): first visible bot wins, then 'default' — unless default is
 *  itself hidden with nothing else visible, in which case the selection
 *  stays put rather than pointing somewhere even less real. */
function fallbackSelectionAfterHide(name) {
  if ($selectedBot.get() !== name) {
    return
  }

  const meta = $botMeta.get()
  const visible = $lastRoster
    .get()
    .filter(bot => !bot.remoteSource && bot.name !== name && !meta[bot.name]?.hidden)

  if (visible.length) {
    $selectedBot.set(visible[0].name)
    return
  }

  if (name !== 'default' && !meta.default?.hidden) {
    $selectedBot.set('default')
  }
}

/** One-time reconciliation: Bot Mode sessions are always hidden, but rooms
 *  and Bot Chats created before this policy (or while the old pref was off)
 *  left visible rows behind. On every plugin load, sweep every session id we
 *  own — canonical chats from bot meta plus each group room's member
 *  sessions — through the core session.set_hidden RPC, then run the
 *  ownership-based sweep for the rows we DON'T know by id. Idempotent (the DB
 *  setter is a no-op on already-hidden rows) and feature-detected: older
 *  gateways lack session.set_hidden and simply keep the rows visible. */
function hideOwnedBotSessions() {
  const canonical = Object.values($botMeta.get())
    .map(m => m && m.chat)
    .filter(Boolean)
  const rooms = Object.values($groupChats.get())
    .flatMap(room => Object.values(room?.sessions || {}))
    .filter(sid => Boolean(sid) && sid !== true)
  const ids = [...new Set([...canonical, ...rooms])]

  const known = Promise.all(
    ids.map(sid =>
      Promise.resolve(host.request('session.set_hidden', { session_id: sid, hidden: true })).catch(() => undefined)
    )
  )

  return Promise.all([known, sweepBotProfileSessions().catch(() => undefined)])
}

// Titles Bot Mode itself mints for its plumbing sessions. Bot-to-bot CLI
// handoffs (`hermes -p <bot> chat --in ~ -c "Bot Chat" --create-if-missing`)
// and mention handoffs create sessions with EXACTLY these titles; the
// "Group: " prefix is the member-session title ensureGroupChatSession has
// used since group chats shipped. Exact/prefix matching is deliberate — a
// user's real conversation inside a bot profile keeps whatever title the
// user gave it and is never touched.
const BOT_MODE_SWEEP_TITLES = new Set(['Bot Chat', 'Agent Inbox'])

function isBotModeSweepTitle(title) {
  const t = String(title || '').trim()
  return BOT_MODE_SWEEP_TITLES.has(t) || t.startsWith('Group: ')
}

/** Ownership-based sweep: the id-based sweep above only covers sessions the
 *  plugin recorded ($botMeta canonical chats, $groupChats member sids), but
 *  Bot Mode sessions are ALSO minted outside the plugin — bot-to-bot CLI
 *  handoffs ("Agent Inbox" / extra "Bot Chat" rows born visible in a bot's
 *  profile) — and those ids the plugin never learns. So: enumerate each
 *  roster bot's OWN profile sessions (only bot profiles — a non-bot profile
 *  is never listed, so its sessions are never touched) and hide any VISIBLE
 *  row whose title is Bot Mode plumbing. session.list without include_hidden
 *  returns only visible rows, which keeps the sweep naturally idempotent.
 *  Remote-source bots route to their own connection via requestForBot.
 *  Feature-detected + fire-and-forget: older gateways without per-profile
 *  session.list / session.set_hidden simply reject and the sweep no-ops. */
async function sweepBotProfileSessions() {
  const cached = $lastRoster.get()
  let roster = Array.isArray(cached) && cached.length ? cached : null

  if (!roster) {
    // Plugin load can run before the Bots pane hydrates $lastRoster — fall
    // back to the active gateway's own profile list (local bots; remote
    // sources get covered by the next sweep once the roster cache exists).
    try {
      const res = await host.request('profiles.list', {})
      roster = Array.isArray(res?.profiles) ? res.profiles : []
    } catch {
      return
    }
  }

  await Promise.all(
    roster.map(async bot => {
      const name = String(bot?.name || '').trim()

      if (!name) {
        return
      }

      try {
        const res = await requestForBot(bot, 'session.list', { profile: name, limit: PROFILE_SESSION_LIST_LIMIT })
        const rows = Array.isArray(res?.sessions) ? res.sessions : []

        await Promise.all(
          rows
            .filter(row => row && row.id && isBotModeSweepTitle(row.title))
            .map(row =>
              Promise.resolve(
                requestForBot(bot, 'session.set_hidden', { session_id: row.id, hidden: true, profile: name })
              ).catch(() => undefined)
            )
        )
      } catch {
        /* older gateway / unreachable source — leave this profile alone */
      }
    })
  )
}

/** Fetch server-side avatars for roster rows flagged has_avatar when the
 *  local cache doesn't already have an image for them. Fire-and-forget. */
const avatarFetchInflight = new Set()

const avatarPushInflight = new Set()

function avatarInflightKey(owner, name) {
  const normalized = normalizeRosterOwner(owner?.connectionId, owner?.profile)
  const profile = String(name || '').trim()

  return normalized && profile ? `${normalized.connectionId}::${profile}` : ''
}

/** Persist a rendered avatar only while the source that produced it is still
 *  the active exact owner. Rasterization is asynchronous; without this final
 *  guard an A image can be uploaded to B's same-named profile after a switch. */
async function persistAvatarForOwner(name, data, owner, runtime = host) {
  const normalized = normalizeRosterOwner(owner?.connectionId, owner?.profile)
  const profile = String(name || '').trim()

  if (!normalized || !profile || !data || !rosterOwnerStillActive(normalized, runtime)) {
    return false
  }

  await runtime.request('profiles.set_asset', { name: profile, asset: 'avatar', data })
  return true
}

/** Backfill: local meta has art the server lacks -> profiles.set_asset.
 *  Server-side avatars power the inter-agent notice pfp (core #85855) and
 *  cross-machine roster art, so local-only images are a bug, not a state. */
function pushLocalAvatars(roster, rosterOwner, runtime = host, render = rasterizeSvgToPng) {
  const owner = normalizeRosterOwner(rosterOwner?.connectionId, rosterOwner?.profile)

  if (
    !isExactLocalRosterOwner(owner) ||
    !sameRosterOwner(owner, $botMetaOwner.get()) ||
    !rosterOwnerStillActive(owner, runtime)
  ) {
    return
  }

  for (const bot of roster) {
    const key = avatarInflightKey(owner, bot.name)

    if (!key || bot.has_avatar || avatarPushInflight.has(key)) {
      continue
    }

    const image = $botMeta.get()[bot.name]?.image

    if (image && typeof image === 'string' && image.startsWith('data:')) {
      avatarPushInflight.add(key)
      persistAvatarForOwner(bot.name, image, owner, runtime)
        .then(saved => {
          if (!saved) throw new Error('source changed')
          return queryClient.invalidateQueries({ queryKey: ROSTER_KEY })
        })
        .catch(() => avatarPushInflight.delete(key))
      continue
    }

    // Vector shape/color face: no image exists anywhere — rasterize the
    // live SVG (tagged data-bot-face) to a PNG and push that, so the
    // inter-agent notices (core #85855/#85888) can show the real pfp.
    const svg = document.querySelector('svg[data-bot-face=' + JSON.stringify(bot.name) + ']')

    if (!svg) {
      continue
    }

    avatarPushInflight.add(key)
    render(svg, 160)
      .then(png => persistAvatarForOwner(bot.name, png, owner, runtime))
      .then(saved => {
        if (!saved) throw new Error('source changed')
        return queryClient.invalidateQueries({ queryKey: ROSTER_KEY })
      })
      .catch(() => avatarPushInflight.delete(key))
  }
}

/** Serialize an inline SVG and draw it to a canvas -> PNG data URL. */
function rasterizeSvgToPng(svgEl, size) {
  return new Promise(resolve => {
    try {
      const clone = svgEl.cloneNode(true)
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      clone.setAttribute('width', String(size))
      clone.setAttribute('height', String(size))
      const markup = new XMLSerializer().serializeToString(clone)
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup)
      const img = new Image()

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = size
          canvas.height = size
          canvas.getContext('2d').drawImage(img, 0, 0, size, size)
          resolve(canvas.toDataURL('image/png'))
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = url
    } catch {
      resolve(null)
    }
  })
}

/** The roster backfill draws the live SVG at 160x160. Pets are 96x104
 *  and uploads are 256. Use that to tell a still face-copy from a real picture. */
function isBackfilledFacePng(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
    return false
  }

  try {
    const bin = atob(dataUrl.slice('data:image/png;base64,'.length).slice(0, 48))
    if (bin.length < 24) {
      return false
    }
    const w = (bin.charCodeAt(16) << 24) | (bin.charCodeAt(17) << 16) | (bin.charCodeAt(18) << 8) | bin.charCodeAt(19)
    const h = (bin.charCodeAt(20) << 24) | (bin.charCodeAt(21) << 16) | (bin.charCodeAt(22) << 8) | bin.charCodeAt(23)
    return w === 160 && h === 160
  } catch {
    return false
  }
}

function pullServerAvatars(roster, rosterOwner, runtime = host) {
  const owner = normalizeRosterOwner(rosterOwner?.connectionId, rosterOwner?.profile)

  if (!isExactLocalRosterOwner(owner) || !rosterOwnerStillActive(owner, runtime)) {
    return
  }

  pushLocalAvatars(roster, owner, runtime)

  for (const bot of roster) {
    const key = avatarInflightKey(owner, bot.name)

    if (!key || !bot.has_avatar || avatarFetchInflight.has(key)) {
      continue
    }

    if ($botMeta.get()[bot.name]?.image) {
      continue
    }

    avatarFetchInflight.add(key)
    runtime
      .request('profiles.get_asset', { name: bot.name, asset: 'avatar' })
      .then(res => {
        if (
          res?.found &&
          res.data &&
          rosterOwnerStillActive(owner, runtime) &&
          sameRosterOwner(owner, $botMetaOwner.get())
        ) {
          const current = $botMeta.get()
          const mine = current[bot.name] || {}
          // A 160px raster of the vector face is only for inter-agent
          // notices. Do not park it on the roster or the live face dies.
          if (isBackfilledFacePng(res.data) && mine.imageKind !== 'photo' && !mine.pet) {
            return
          }
          $botMeta.set({ ...current, [bot.name]: { ...mine, image: res.data } })

          try {
            Promise.resolve(pluginCtx?.storage?.set?.('bot-meta', $botMeta.get())).catch(() => undefined)
          } catch {
            /* no storage */
          }
        }
      })
      .catch(() => undefined)
      .finally(() => avatarFetchInflight.delete(key))
  }
}

/** Server ui_meta (per roster row) beats local storage for the compact
 *  fields it carries; local-only fields (avatar image data URL, extracted
 *  pet icon) are PRESERVED — the server copy never includes them, so a
 *  naive replace would wipe a just-saved image avatar on the next roster
 *  paint. When server bot metadata exists, an omitted chat is authoritative
 *  deletion; local still fills all gaps for older gateways with no metadata. */
function mergeServerMeta(roster, rosterOwner = null) {
  const owner = normalizeRosterOwner(rosterOwner?.connectionId, rosterOwner?.profile)

  // Remote active sources render their source-qualified row ui_meta and must
  // never be folded into the legacy bare-name local cache.
  if (!isExactLocalRosterOwner(owner)) {
    return
  }

  const local = isExactLocalRosterOwner($botMetaOwner.get()) ? $botMeta.get() : {}
  let changed = false
  const next = { ...local }

  for (const bot of roster) {
    const server = bot.ui_meta?.['hermes-bots']
    if (server && typeof server === 'object') {
      const mine = next[bot.name] || {}
      const merged = { ...mine, ...server }

      // Local-only fields survive the server overlay.
      if (mine.image) {
        merged.image = mine.image
      }

      // Server metadata is authoritative for the canonical chat pointer.
      // Without this deletion sync, ctx.storage resurrects stale sessions
      // after the server pin is cleared and even after a full app restart.
      if (
        Object.prototype.hasOwnProperty.call(mine, 'chat') &&
        !Object.prototype.hasOwnProperty.call(server, 'chat')
      ) {
        delete merged.chat
      }

      // Canonical multi-group metadata is authoritative for the compatibility
      // scalar too. A server-side `group: null` is represented by omission,
      // so retaining the local scalar would resurrect a membership that another
      // desktop just removed.
      if (
        Array.isArray(server.groups) &&
        Object.prototype.hasOwnProperty.call(mine, 'group') &&
        !Object.prototype.hasOwnProperty.call(server, 'group')
      ) {
        delete merged.group
      }

      if (JSON.stringify(next[bot.name] || null) !== JSON.stringify(merged)) {
        next[bot.name] = merged
        changed = true
      }
    }
  }

  if (!sameRosterOwner($botMetaOwner.get(), owner)) {
    $botMetaOwner.set(owner)
  }

  if (changed) {
    $botMeta.set(next)

    // Persist server reconciliation so a relaunch cannot rehydrate stale
    // local fields that the server intentionally removed.
    try {
      Promise.resolve(pluginCtx?.storage?.set?.('bot-meta', next)).catch(() => undefined)
    } catch {
      /* storage unavailable — reconciliation lasts for this window only */
    }
  }
}

/** Clone a bot: profile (config/skills/SOUL/memory via clone_from) + look.
 *  Name is "<base>-2", "-3", … — first free slot against the live roster. */
async function duplicateBot(bot, roster, sourceMeta = null) {
  const expectedOwner = normalizeRosterOwner(bot?.actionOwner?.connectionId, bot?.actionOwner?.profile)

  if (!expectedOwner || !rosterOwnerStillActive(expectedOwner)) {
    throw new Error(agentText('profile.sourceChanged'))
  }

  const base = bot.name
  let name = null
  for (let n = 2; n < 100; n++) {
    // Truncate the BASE, never the suffix — slicing the joined string chops
    // the "-2" off a max-length name and the candidate collides with the
    // base forever (#19).
    const suffix = `-${n}`
    const candidate = base.slice(0, 64 - suffix.length) + suffix
    if (!roster.some(b => b.name === candidate)) {
      name = candidate
      break
    }
  }

  if (!name) {
    throw new Error(agentText('profile.noDuplicateName'))
  }

  await host.request('profiles.create', {
    name,
    clone_from: base,
    description: bot.description || ''
  })

  if (!rosterOwnerStillActive(expectedOwner)) {
    // The duplicate already exists on the captured origin, but no later
    // name-only write may cross into a newly active same-name source.
    throw new Error(agentText('profile.sourceChanged'))
  }

  // Same look: avatar shape/color/image and a "(copy)" title so the two
  // are tellable apart in the roster until the user renames. Do not copy
  // chat or created. Those belong to the original bot.
  const meta = sourceMeta || botRosterMeta(bot, $botMeta.get(), expectedOwner)
  if (meta) {
    const { chat, created, ...look } = meta
    await saveBotMeta(
      name,
      {
        ...look,
        title: meta.title ? `${meta.title} ${agentText('profile.copySuffix')}` : ''
      },
      null,
      expectedOwner
    )
  }

  return name
}

/** Permanently delete a bot's Hermes profile, then remove plugin-local state
 * that would otherwise leave stale appearance/unread data behind.
 *
 * Prefer the SDK's `host.deleteProfile` when this Desktop build ships it: it
 * routes through the Electron-intercepted REST delete, which tears down the
 * bot's pool backend FIRST and routes the next request away from it. The
 * older `cli.exec` path bypasses that interception, so a backend that the
 * roster's hover pre-warm just woke (right-click hovers the row!) holds the
 * profile dir open — the CLI's rmtree races the live backend and the
 * renderer's socket reconnect respawns it mid-delete, resurrecting the
 * directory (hermes-agent#52279). That is the "can't delete a bot" error. */
async function deleteBot(bot) {
  const expectedOwner = normalizeRosterOwner(bot?.actionOwner?.connectionId, bot?.actionOwner?.profile)

  if (!expectedOwner || !rosterOwnerStillActive(expectedOwner)) {
    throw new Error(agentText('profile.sourceChanged'))
  }

  if (typeof host.deleteProfile === 'function') {
    const deleteRoute = agentProfileDeleteRoute(expectedOwner, host)

    if (!deleteRoute) {
      throw new Error(agentText('remote.sourceUnavailable', bot.name, expectedOwner.connectionId))
    }

    await host.deleteProfile(bot.name, deleteRoute.connectionId)
  } else {
    if (expectedOwner.connectionId !== 'local') {
      throw new Error(agentText('remote.sourceUnavailable', bot.name, expectedOwner.connectionId))
    }

    // Older desktop without the SDK verb — best effort via the CLI.
    const result = await host.request('cli.exec', {
      argv: ['profile', 'delete', bot.name, '--yes']
    })

    if (result?.blocked || result?.code !== 0) {
      throw new Error(result?.hint || result?.output || agentText('profile.deleteFailed', bot.name))
    }
  }

  if (!rosterOwnerStillActive(expectedOwner)) {
    throw new Error(agentText('profile.sourceChanged'))
  }

  if (agentDeleteClearsLegacyMeta(expectedOwner, $botMetaOwner.get())) {
    const meta = { ...$botMeta.get() }
    delete meta[bot.name]
    $botMeta.set(meta)

    try {
      await Promise.resolve(pluginCtx?.storage?.set?.('bot-meta', meta))
    } catch {
      /* profile is deleted; stale local appearance is harmless if storage fails */
    }
  }

  const unread = { ...$botUnread.get() }
  delete unread[bot.name]
  $botUnread.set(unread)
  rosterWatermarks.delete(bot.name)
  avatarFetchInflight.delete(avatarInflightKey(expectedOwner, bot.name))
  avatarPushInflight.delete(avatarInflightKey(expectedOwner, bot.name))

  if ($selectedBot.get() === bot.name) {
    $selectedBot.set('default')
  }

  queryClient.invalidateQueries({ queryKey: ROSTER_KEY })

  if (host.state.profile.get?.() === bot.name && typeof host.newChat === 'function') {
    host.newChat('default')
  }
}

// ── avatars (shape + color + eyes) ──────────────────────────────────────────

// The original flat shapes. Sigils ('sigil-N') and platonic
// solids remain render-only so any bot that picked one during the experiments
// keeps its look.
// Radix ScrollArea's viewport wraps children in a display:table div that
// sizes to content — unbounded width means `truncate` below it never fires
// and previews run through the panel edge. Scope-limited corrective.
//
// A second Radix quirk bites in the dialogs: the viewport is height:100%,
// which computes to auto when the root only has max-height (no definite
// height anywhere up the chain) — the viewport grows to full content height,
// the root's overflow:hidden clips it, and NOTHING scrolls (#88). Capping
// the viewport itself (inheriting the root's max-height) makes it the real
// scroll container; lists shorter than the cap still shrink to fit.
if (typeof document !== 'undefined' && !document.getElementById('hermes-bots-roster-css')) {
  const style = document.createElement('style')
  style.id = 'hermes-bots-roster-css'
  style.textContent =
    '.hermes-bots-roster [data-radix-scroll-area-viewport] > div {' +
    ' display: block !important; width: 100%; min-width: 0; }' +
    '.hermes-scroll-cap > [data-radix-scroll-area-viewport] { max-height: inherit; }' +
    '@keyframes hermes-bots-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }' +
    '.hermes-bots-pulse { animation: hermes-bots-pulse 1.2s ease-in-out infinite; }'
  document.head.appendChild(style)
}

const AVATAR_SHAPES = ['circle', 'squircle', 'pill', 'triangle', 'hexagon', 'cloud', 'drop']
const AVATAR_PICKER_SHAPES = ['circle', 'blob', 'squircle', 'pill', 'triangle', 'hexagon', 'cloud', 'drop']

/** xorshift PRNG seeded from a string — stable across sessions/platforms. */
function sigilRng(text) {
  let h = 2166136261
  for (const ch of text) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  let state = h >>> 0 || 88675123
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 4294967296
  }
}

/**
 * Angular hermetic sigil: strokes on the left half of a 5-column grid,
 * mirrored right, plus a chance of a diamond ring. Returns SVG path strings.
 */
function sigilGeometry(name, seed) {
  const rng = sigilRng(`${name}::${seed}`)
  const gx = i => 6 + i * 7 // 5 cols: 6..34
  const gy = j => 8 + j * 6 // 5 rows: 8..32
  const strokes = []
  const segments = 4 + Math.floor(rng() * 3)

  for (let k = 0; k < segments; k++) {
    const x1 = Math.floor(rng() * 3) // left half incl. center
    const y1 = Math.floor(rng() * 5)
    const x2 = Math.min(2, Math.max(0, x1 + (rng() > 0.5 ? 1 : -1)))
    const y2 = Math.min(4, Math.max(0, y1 + Math.floor(rng() * 3) - 1))

    strokes.push(`M${gx(x1)} ${gy(y1)} L${gx(x2)} ${gy(y2)}`)
    // mirror (col i → col 4-i)
    strokes.push(`M${gx(4 - x1)} ${gy(y1)} L${gx(4 - x2)} ${gy(y2)}`)

    // occasional cross-tie through the axis for connectedness
    if (rng() > 0.6) {
      strokes.push(`M${gx(x2)} ${gy(y2)} L${gx(4 - x2)} ${gy(y2)}`)
    }
  }

  // spine down the axis grounds every variant
  strokes.push(`M20 ${gy(0)} L20 ${gy(4)}`)

  const ring = rng() > 0.45 ? 'M20 4 L36 20 L20 36 L4 20 Z' : null
  return { strokes: strokes.join(' '), ring }
}

const AVATAR_COLORS = [
  '#f5f5f4', // white
  '#8d6748', // brown
  '#ef4444', // red
  '#f97316', // orange
  '#14b8a6', // teal
  '#38bdf8', // cyan
  '#3b40c8', // royal blue
  '#8b5cf6', // violet
  '#ec4899', // magenta
  '#9ca3af' // silver
]

/** Perceptual luminance — eyes/pupils flip light on dark bodies (ink, oxblood). */
function isDarkColor(hex) {
  try {
    const n = parseInt(hex.slice(1), 16)
    const r = (n >> 16) & 255
    const g = (n >> 8) & 255
    const b = n & 255
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110
  } catch {
    return false
  }
}

function defaultShapeFor(name) {
  let hash = 0
  for (const ch of name) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  }
  return AVATAR_SHAPES[hash % AVATAR_SHAPES.length]
}

/** The colored body of the avatar (no eyes). Platonic solids are a filled
 *  silhouette + translucent internal edge lines (the projected wireframe);
 *  legacy flat shapes keep their old geometry so stored picks still render. */
function shapeNode(shape, color, botName = 'agent') {
  if (shape.startsWith('sigil-')) {
    const seed = Number(shape.slice(6)) || 0
    const { strokes, ring } = sigilGeometry(botName, seed)
    const sw = { fill: 'none', stroke: color, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }
    return jsxs('g', {
      children: [
        ring ? jsx('path', { d: ring, fill: 'none', stroke: color, strokeWidth: 1.2, opacity: 0.5 }) : null,
        jsx('path', { d: strokes, ...sw })
      ]
    })
  }

  const stroke = { fill: color, stroke: color, strokeWidth: 7, strokeLinejoin: 'round' }
  const edge = { fill: 'none', stroke: 'rgba(0,0,0,0.4)', strokeWidth: 1.4, strokeLinejoin: 'round', strokeLinecap: 'round' }
  const face = { fill: color, stroke: 'rgba(0,0,0,0.4)', strokeWidth: 1.4, strokeLinejoin: 'round' }

  switch (shape) {
    // ── platonic solids ──
    case 'tetrahedron':
      return jsxs('g', {
        children: [
          jsx('path', { d: 'M20 5 L36 33 L4 33 Z', ...face }),
          jsx('path', { d: 'M20 5 L20 25 M4 33 L20 25 M36 33 L20 25', ...edge })
        ]
      })
    case 'cube':
      return jsxs('g', {
        children: [
          jsx('path', { d: 'M20 4 L33 11 L33 29 L20 36 L7 29 L7 11 Z', ...face }),
          jsx('path', { d: 'M7 11 L20 18 L33 11 M20 18 L20 36', ...edge })
        ]
      })
    case 'octahedron':
      return jsxs('g', {
        children: [
          jsx('path', { d: 'M20 3 L36 20 L20 37 L4 20 Z', ...face }),
          jsx('path', { d: 'M4 20 L36 20 M20 3 L20 37', ...edge })
        ]
      })
    case 'dodecahedron':
      return jsxs('g', {
        children: [
          jsx('path', {
            d: 'M20 3 L30 6.2 L36.2 14.7 L36.2 25.3 L30 33.8 L20 37 L10 33.8 L3.8 25.3 L3.8 14.7 L10 6.2 Z',
            ...face
          }),
          jsx('path', {
            d:
              'M20 12 L27.6 17.5 L24.7 26.5 L15.3 26.5 L12.4 17.5 Z ' +
              'M20 12 L20 3 M27.6 17.5 L36.2 14.7 M24.7 26.5 L30 33.8 M15.3 26.5 L10 33.8 M12.4 17.5 L3.8 14.7',
            ...edge
          })
        ]
      })
    case 'icosahedron':
      return jsxs('g', {
        children: [
          jsx('path', { d: 'M20 3 L34.7 11.5 L34.7 28.5 L20 37 L5.3 28.5 L5.3 11.5 Z', ...face }),
          jsx('path', {
            d:
              'M20 11 L27.8 24.5 L12.2 24.5 Z ' +
              'M20 11 L20 3 M20 11 L34.7 11.5 M20 11 L5.3 11.5 ' +
              'M27.8 24.5 L34.7 11.5 M27.8 24.5 L34.7 28.5 M27.8 24.5 L20 37 ' +
              'M12.2 24.5 L5.3 11.5 M12.2 24.5 L5.3 28.5 M12.2 24.5 L20 37',
            ...edge
          })
        ]
      })

    // ── legacy flat shapes (stored picks from earlier versions) ──
    case 'squircle':
      return jsx('rect', { x: 3, y: 3, width: 34, height: 34, rx: 11, fill: color })
    case 'pill':
      return jsx('rect', { x: 2, y: 7, width: 36, height: 26, rx: 13, fill: color })
    case 'triangle':
      return jsx('path', { d: 'M20 5.5 L36 33.5 L4 33.5 Z', ...stroke })
    case 'hexagon':
      return jsx('path', { d: 'M20 3.5 L34.5 11.75 L34.5 28.25 L20 36.5 L5.5 28.25 L5.5 11.75 Z', ...stroke })
    case 'cloud':
      return jsx('path', {
        d: 'M11 32 a7.5 7.5 0 0 1 -1 -14.9 A9.5 9.5 0 0 1 29 12.5 A7 7 0 0 1 30 32 Z',
        fill: color
      })
    case 'drop':
      return jsx('path', { d: 'M20 3 C20 3 6 20 6 27 a14 13.5 0 0 0 28 0 C34 20 20 3 20 3 Z', fill: color })
    default:
      return jsx('circle', { cx: 20, cy: 20, r: 17.5, fill: color })
  }
}

const EYE_Y = {
  // solids: eyes sit on the upper face region, clear of the busiest edges
  tetrahedron: 26,
  cube: 22.5,
  octahedron: 14.5,
  dodecahedron: 20,
  icosahedron: 17.5,
  // legacy
  circle: 17,
  squircle: 17,
  pill: 20,
  triangle: 25,
  hexagon: 17,
  cloud: 22,
  drop: 24
}

// Solids draw eyes slightly tighter so they read as ON a face.
const EYE_X = {
  tetrahedron: [16.5, 23.5],
  cube: [15, 25],
  octahedron: [16, 24],
  dodecahedron: [16.5, 23.5],
  icosahedron: [16.5, 23.5]
}

function cubicAt(p0, p1, p2, p3, t) {
  const u = 1 - t
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
  ]
}

/** Same outline as the old GitHub drop path, so it stays a fat water drop. */
function sampleDropRing(steps) {
  const pts = []
  const n = Math.max(8, Math.floor(steps / 3))

  for (let i = 0; i < n; i++) {
    pts.push(cubicAt([20, 3], [20, 3], [6, 20], [6, 27], i / n))
  }

  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI
    pts.push([20 - 14 * Math.cos(t), 27 + 13.5 * Math.sin(t)])
  }

  for (let i = 1; i <= n; i++) {
    pts.push(cubicAt([34, 27], [34, 20], [20, 3], [20, 3], i / n))
  }

  return pts
}

function svgArc(x1, y1, rx, ry, fa, fs, x2, y2) {
  const dx = (x1 - x2) / 2
  const dy = (y1 - y2) / 2
  let rx2 = rx * rx
  let ry2 = ry * ry
  const lam = (dx * dx) / rx2 + (dy * dy) / ry2
  if (lam > 1) {
    const s = Math.sqrt(lam)
    rx *= s
    ry *= s
    rx2 = rx * rx
    ry2 = ry * ry
  }
  const num = rx2 * ry2 - rx2 * dy * dy - ry2 * dx * dx
  const den = rx2 * dy * dy + ry2 * dx * dx
  let sq = Math.sqrt(Math.max(0, num / den))
  if (fa === fs) {
    sq = -sq
  }
  const cx = sq * (rx * dy / ry) + (x1 + x2) / 2
  const cy = sq * (-ry * dx / rx) + (y1 + y2) / 2
  const ang = (ux, uy, vx, vy) => {
    const n = Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1
    let a = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / n)))
    if (ux * vy - uy * vx < 0) {
      a = -a
    }
    return a
  }
  const theta1 = ang(1, 0, (x1 - cx) / rx, (y1 - cy) / ry)
  let dtheta = ang((x1 - cx) / rx, (y1 - cy) / ry, (x2 - cx) / rx, (y2 - cy) / ry)
  if (!fs && dtheta > 0) {
    dtheta -= Math.PI * 2
  }
  if (fs && dtheta < 0) {
    dtheta += Math.PI * 2
  }
  return { cx, cy, rx, ry, theta1, dtheta }
}

function sampleArc(arc, n) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const th = arc.theta1 + arc.dtheta * (i / n)
    pts.push([arc.cx + arc.rx * Math.cos(th), arc.cy + arc.ry * Math.sin(th)])
  }
  return pts
}

/** Same outline as the old GitHub cloud path: three puffs and a flat floor. */
function sampleCloudRing(steps) {
  const a1 = svgArc(11, 32, 7.5, 7.5, 0, 1, 10, 17.1)
  const a2 = svgArc(10, 17.1, 9.5, 9.5, 0, 1, 29, 12.5)
  const a3 = svgArc(29, 12.5, 7, 7, 0, 1, 30, 32)
  const len1 = Math.abs(a1.dtheta) * a1.rx
  const len2 = Math.abs(a2.dtheta) * a2.rx
  const len3 = Math.abs(a3.dtheta) * a3.rx
  const len4 = 19
  const total = len1 + len2 + len3 + len4
  const n = Math.max(64, steps)
  const n1 = Math.max(8, Math.round(n * len1 / total))
  const n2 = Math.max(10, Math.round(n * len2 / total))
  const n3 = Math.max(10, Math.round(n * len3 / total))
  const n4 = Math.max(4, n - n1 - n2 - n3)
  const pts = []
  pts.push(...sampleArc(a1, n1))
  pts.push(...sampleArc(a2, n2))
  pts.push(...sampleArc(a3, n3))
  for (let i = 0; i < n4; i++) {
    pts.push([30 + (11 - 30) * (i / n4), 32])
  }
  return pts
}

/** Outline of a face in a 40x40 box. Same family as Grok Bot
 *  (blob / squircle / pebble / \u2026) but sampled from formulas, not
 *  a dumped point cloud. */
function sampleFaceRing(shape, steps = 52) {
  const kind = (shape || '').startsWith('sigil-') ? 'circle' : shape

  if (kind === 'drop' || kind === 'teardrop') {
    return sampleDropRing(steps)
  }
  if (kind === 'cloud') {
    return sampleCloudRing(steps)
  }
  const pts = []

  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2 - Math.PI / 2
    const c = Math.cos(a)
    const s = Math.sin(a)
    let rx = 16
    let ry = 16
    if (kind === 'circle') {
      rx = ry = 16.2
    } else if (kind === 'blob') {
      rx = ry = 16 + 1.7 * Math.sin(3 * a) + 0.7 * Math.cos(5 * a)
    } else if (kind === 'squircle') {
      const p = 5
      const d = Math.pow(Math.abs(c) ** p + Math.abs(s) ** p, 1 / p) || 1
      rx = ry = 16.2 / d
    } else if (kind === 'pill') {
      const d = Math.pow(Math.abs(c) ** 8 + Math.abs(s / 0.72) ** 8, 1 / 8) || 1
      rx = ry = 16 / d
    } else if (kind === 'triangle' || kind === 'tetrahedron' || kind === 'wedge') {
      const u = (a + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)
      const sector = (u / (Math.PI * 2 / 3)) % 1
      rx = ry = 13.5 / Math.max(0.42, Math.cos((sector - 0.5) * 1.9))
    } else if (kind === 'hexagon' || kind === 'hex' || kind === 'icosahedron' || kind === 'dodecahedron') {
      const seg = Math.PI / 3
      const hex = Math.cos(seg / 2) / Math.cos(a - seg * Math.round(a / seg))
      rx = ry = 16.2 * hex
    } else if (kind === 'cube' || kind === 'octahedron') {
      const p = 3.1
      const d = Math.pow(Math.abs(c) ** p + Math.abs(s) ** p, 1 / p) || 1
      rx = ry = 16 / d
    } else if (kind === 'pebble') {
      rx = 16.4 * (1.04 - 0.14 * Math.cos(2 * a))
      ry = 15.2 * (1.06 + 0.08 * Math.sin(2 * a))
    } else {
      rx = ry = 16.2
    }

    pts.push([20 + rx * c, 20 + ry * s])
  }

  return pts
}

function projectFacePoint(x, y, turn, tilt, roll) {
  const dx = x - 20
  const dy = y - 20
  const r = (roll * Math.PI) / 180
  const xr = dx * Math.cos(r) - dy * Math.sin(r)
  const yr = dx * Math.sin(r) + dy * Math.cos(r)
  const sx = 0.74 + 0.26 * Math.abs(Math.cos((turn * Math.PI) / 180))
  const sy = 0.8 + 0.2 * Math.abs(Math.cos((tilt * Math.PI) / 180))
  return [20 + xr * sx, 20 + yr * sy]
}

function ringToPath(pts) {
  if (!pts.length) {
    return ''
  }

  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`

  for (let i = 1; i < pts.length; i++) {
    d += `L${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)}`
  }

  return d + 'Z'
}

/** Grok-style pose. thinking/working lean and sway. idle is a small sine. */
function facePose(mood, t) {
  if (mood === 'work') {
    return {
      turn: -11 + Math.sin(t * 0.48) * 8,
      tilt: Math.sin(t * 0.42) * 8 + Math.sin(t * 1.1) * 1.6,
      roll: Math.sin(t * 0.75) * 4.2,
      gazeX: Math.sin(t * 0.55) * 3.6,
      gazeY: -1.6 + Math.sin(t * 0.38) * 2,
      blink: t % 1.45 > 1.26,
      d0: 0.2 + 0.8 * Math.max(0, Math.sin(t * 2.6)),
      d1: 0.2 + 0.8 * Math.max(0, Math.sin(t * 2.6 - 0.7)),
      d2: 0.2 + 0.8 * Math.max(0, Math.sin(t * 2.6 - 1.4))
    }
  }

  return {
    turn: Math.sin(t * 0.5) * 1.5,
    tilt: Math.sin(t * 0.27),
    roll: Math.sin(t * 0.85) * 1.2,
    gazeX: 0,
    gazeY: 0,
    blink: t % 3.2 > 3.02,
    d0: 0,
    d1: 0,
    d2: 0
  }
}

function paintMathFace(svg, t) {
  const mood = svg.getAttribute('data-hb-mood') || 'idle'
  const shape = svg.getAttribute('data-hb-shape') || 'circle'
  const pose = facePose(mood, t)
  const body = svg.querySelector('[data-hb-body]')
  const open = svg.querySelector('[data-hb-open]')
  const shut = svg.querySelector('[data-hb-shut]')
  const el = svg.querySelector('[data-hb-el]')
  const er = svg.querySelector('[data-hb-er]')
  const dots = svg.querySelectorAll('[data-hb-dot]')

  if (body) {
    if (shape === 'cloud') {
      body.setAttribute('d', 'M11 32 a7.5 7.5 0 0 1 -1 -14.9 A9.5 9.5 0 0 1 29 12.5 A7 7 0 0 1 30 32 Z')
    } else {
      const ring = sampleFaceRing(shape).map(([x, y]) => projectFacePoint(x, y, pose.turn, pose.tilt, pose.roll))
      body.setAttribute('d', ringToPath(ring))
    }
  }

  const eyeY = (shape === 'cloud' ? 22 : 17.2) + pose.gazeY
  const eyeL = 15.4 + pose.gazeX
  const eyeR = 24.6 + pose.gazeX

  if (el) {
    el.setAttribute('cx', eyeL)
    el.setAttribute('cy', eyeY)
  }

  if (er) {
    er.setAttribute('cx', eyeR)
    er.setAttribute('cy', eyeY)
  }

  // Catchlights ride the pupils (upper-left offset) — without this they
  // stay at the circle-face position and drift outside e.g. the cloud's
  // lower-set eyes.
  const hl = svg.querySelector('[data-hb-hl-l]')
  const hr = svg.querySelector('[data-hb-hl-r]')

  if (hl) {
    hl.setAttribute('cx', eyeL - 0.6)
    hl.setAttribute('cy', eyeY - 0.7)
  }

  if (hr) {
    hr.setAttribute('cx', eyeR - 0.6)
    hr.setAttribute('cy', eyeY - 0.7)
  }

  if (open) {
    open.setAttribute('opacity', pose.blink ? '0' : '1')
  }

  if (shut) {
    shut.setAttribute('d', `M${eyeL - 2.6} ${eyeY} L${eyeL + 2.6} ${eyeY} M${eyeR - 2.6} ${eyeY} L${eyeR + 2.6} ${eyeY}`)
    shut.setAttribute('opacity', pose.blink ? '1' : '0')
  }

  dots.forEach((dot, i) => {
    const o = i === 0 ? pose.d0 : i === 1 ? pose.d1 : pose.d2
    dot.setAttribute('opacity', String(o))
  })

  svg.style.transform = `rotate(${pose.tilt}deg)`
  svg.style.transformOrigin = '50% 70%'
}

function walkMathFaces(root, acc) {
  if (!root || !root.querySelectorAll) {
    return acc
  }

  root.querySelectorAll('svg[data-hb-math]').forEach(node => acc.push(node))
  root.querySelectorAll('*').forEach(el => {
    if (el.shadowRoot) {
      walkMathFaces(el.shadowRoot, acc)
    }
  })
  return acc
}

function startFaceClock() {
  if (typeof window === 'undefined') {
    return
  }

  if (window.__hbFaceClock) {
    // Already initialized (possibly parked) — make sure it's awake. BotFace
    // renders route here, so a face mounting is what wakes a dormant clock.
    window.__hbFaceClock.wake()

    return
  }

  const t0 = performance.now()
  // A large roster can mount hundreds of faces. Observe the cached nodes so
  // off-screen cards do not consume a full animation frame by themselves.
  let faces = []
  let lastScan = -Infinity
  const visibleFaces = new Set()
  const observedFaces = new Set()
  const observer =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(entries => {
          let becameVisible = false

          for (const entry of entries) {
            if (entry.isIntersecting) {
              visibleFaces.add(entry.target)
              becameVisible = true
            } else {
              visibleFaces.delete(entry.target)
            }
          }

          // A parked clock (no visible faces) resumes when one scrolls in.
          if (becameVisible) {
            window.__hbFaceClock?.wake()
          }
        })
      : null

  const scanFaces = () => {
    faces = walkMathFaces(document, [])

    if (!observer) {
      return
    }

    const currentFaces = new Set(faces)

    for (const svg of observedFaces) {
      if (!currentFaces.has(svg)) {
        observer.unobserve(svg)
        observedFaces.delete(svg)
        visibleFaces.delete(svg)
      }
    }

    for (const svg of faces) {
      if (!observedFaces.has(svg)) {
        observedFaces.add(svg)
        observer.observe(svg)
      }
    }
  }

  // Shared painting body for both scheduling paths: 1Hz document rescans,
  // paint only visible faces (all cached faces when IO is unavailable).
  const paint = now => {
    if (now - lastScan > 1000) {
      scanFaces()
      lastScan = now
    }
    const t = (now - t0) / 1000
    const facesToPaint = observer ? visibleFaces : faces

    for (const svg of facesToPaint) {
      if (svg.isConnected) {
        paintMathFace(svg, t)
      }
    }
  }

  // Nothing worth animating: no faces mounted (BotFace wakes us on the next
  // mount) or none visible (the observer wakes us when one scrolls in).
  const idle = () => faces.length === 0 || (observer && visibleFaces.size === 0)

  const teardownCaches = () => {
    if (observer) {
      observer.disconnect()
    }

    visibleFaces.clear()
    observedFaces.clear()
    faces = []
    delete window.__hbFaceClock
  }

  // Newer desktops: the SDK's budgeted loop owns scheduling (15fps budget,
  // hidden/minimized/unfocused pause, dormancy, teardown). typeof-guarded so
  // older shells and the vm test harness use the hand-rolled path below.
  if (typeof createBudgetedLoop === 'function' && createBudgetedLoop) {
    const loop = createBudgetedLoop(paint, { fps: 15, idleWhen: idle })

    window.__hbFaceClock = {
      stop: () => {
        loop.dispose()
        teardownCaches()
      },
      wake: () => {
        // Faces may have mounted/unmounted while parked — rescan on wake.
        lastScan = -Infinity
        loop.wake()
      }
    }

    return
  }

  // Fallback scheduling for desktops whose SDK predates createBudgetedLoop.
  let lastPaint = -Infinity
  let rafId = 0
  let dormant = false
  let stopped = false

  const tick = now => {
    if (stopped) {
      return
    }

    rafId = 0
    // 15fps is smooth at avatar scale and bounds SVG/DOM churn. The clock
    // still uses rAF so Chromium can pause it when the window is occluded.
    if (!document.hidden && now - lastPaint >= 1000 / 15) {
      paint(now)
      lastPaint = now
    }

    // Park instead of burning frames + 1Hz whole-document shadow walks.
    if (idle()) {
      dormant = true

      return
    }

    rafId = window.requestAnimationFrame(tick)
  }

  const wake = () => {
    if (stopped || !dormant) {
      return
    }

    dormant = false
    // Faces may have mounted/unmounted while parked — rescan on first tick.
    lastScan = -Infinity
    rafId = window.requestAnimationFrame(tick)
  }

  const stop = () => {
    stopped = true

    if (rafId) {
      window.cancelAnimationFrame(rafId)
      rafId = 0
    }

    teardownCaches()
  }

  window.__hbFaceClock = { stop, wake }
  rafId = window.requestAnimationFrame(tick)
}

/** Tear the face clock down (plugin disable/reload) — cancels the animation
 *  frame, disconnects the visibility observer, and drops all cached nodes. */
function stopFaceClock() {
  if (typeof window !== 'undefined' && window.__hbFaceClock) {
    window.__hbFaceClock.stop()
  }
}

/**
 * Live math face. Photos still use <img>. Shape avatars stay SVG so
 * the clock can move them (a baked PNG cannot).
 */
function BotFace({ shape, color, image, size = 36, name = 'agent', mood = 'idle' }) {
  startFaceClock()

  if (image) {
    return jsx('img', {
      src: image,
      alt: '',
      'aria-hidden': true,
      style: { width: size, height: size, borderRadius: '22%', objectFit: 'cover', display: 'block' }
    })
  }

  // Sigils are line art (no filled body) — the math clock rebuilds filled
  // outlines, which would turn a stored sigil pick into a blank circle.
  // Keep the legacy static render for them so old picks still draw.
  if (shape.startsWith('sigil-')) {
    const eyes = jsxs('g', {
      children: [
        jsx('circle', { cx: 16, cy: 14, r: 2.4, fill: color }),
        jsx('circle', { cx: 24, cy: 14, r: 2.4, fill: color })
      ]
    })
    return jsxs('svg', {
      'data-bot-face': name,
      viewBox: '0 0 40 40',
      width: size,
      height: size,
      'aria-hidden': true,
      children: [shapeNode(shape, color, name), eyes]
    })
  }

  const working = mood === 'work'
  const eyeFill = isDarkColor(color) ? 'rgba(232,220,195,0.95)' : 'rgba(0,0,0,0.85)'
  // Catchlight contrast follows the pupil, not the body: dark pupils get the
  // white sparkle, light (cream) pupils on dark bodies get a dark one — a
  // white dot on a cream pupil is invisible, which read as "no eye dots" on
  // maroon/ink/oxblood avatars.
  const hlFill = isDarkColor(color) ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)'
  const ring = sampleFaceRing(shape)
  const rest = facePose(working ? 'work' : 'idle', 0)
  // Shape-aware initial eye line — the cloud body sits lower, so its eyes
  // (and their catchlights) start at the cloud position instead of jumping
  // there on the first clock paint.
  const eyeY0 = shape === 'cloud' ? 22 : 17.2

  return jsxs('svg', {
    'data-bot-face': name,
    'data-hb-math': '1',
    'data-hb-mood': working ? 'work' : 'idle',
    'data-hb-shape': shape || 'circle',
    viewBox: '0 0 40 44',
    width: size,
    height: size,
    'aria-hidden': true,
    style: { overflow: 'visible', display: 'block' },
    children: [
      jsx('path', {
        'data-hb-body': '1',
        d: shape === 'cloud'
          ? 'M11 32 a7.5 7.5 0 0 1 -1 -14.9 A9.5 9.5 0 0 1 29 12.5 A7 7 0 0 1 30 32 Z'
          : ringToPath(ring),
        fill: color
      }),
      jsxs('g', {
        'data-hb-open': '1',
        children: [
          jsx('ellipse', { 'data-hb-el': '1', cx: 15.4, cy: eyeY0, rx: 2.2, ry: working ? 2.6 : 2.3, fill: eyeFill }),
          jsx('ellipse', { 'data-hb-er': '1', cx: 24.6, cy: eyeY0, rx: 2.2, ry: working ? 2.6 : 2.3, fill: eyeFill }),
          jsx('circle', { 'data-hb-hl-l': '1', cx: 14.8, cy: eyeY0 - 0.7, r: 0.65, fill: hlFill }),
          jsx('circle', { 'data-hb-hl-r': '1', cx: 24, cy: eyeY0 - 0.7, r: 0.65, fill: hlFill })
        ]
      }),
      jsx('path', {
        'data-hb-shut': '1',
        d: `M12.8 ${eyeY0} L18 ${eyeY0} M22 ${eyeY0} L27.2 ${eyeY0}`,
        stroke: eyeFill,
        strokeWidth: 2,
        strokeLinecap: 'round',
        fill: 'none',
        opacity: 0
      }),
      working
        ? jsxs('g', {
            children: [
              jsx('circle', { 'data-hb-dot': '1', cx: 16.4, cy: 41.2, r: 1.15, fill: color, opacity: rest.d0 }),
              jsx('circle', { 'data-hb-dot': '1', cx: 20, cy: 41.2, r: 1.15, fill: color, opacity: rest.d1 }),
              jsx('circle', { 'data-hb-dot': '1', cx: 23.6, cy: 41.2, r: 1.15, fill: color, opacity: rest.d2 })
            ]
          })
        : null
    ]
  })
}

// -- inline MCP setup (per-profile), driven by the mcp.servers.* gateway RPCs --
// Feature-detected: if the gateway predates those RPCs the setup button hides
// and the row falls back to the "run hermes mcp / Settings" hint. profile is
// the target bot's profile name (its config is what we write).

async function mcpRpc(method, params, { runtime = host, owner = null, route = null } = {}) {
  // Returns { ok, result } or { ok:false, unsupported:true } when the gateway
  // doesn't know the method (older backend) vs a real error.
  try {
    const normalized = normalizeRosterOwner(owner?.connectionId, owner?.profile)
    let res

    if (route && typeof runtime?.requestProfile === 'function') {
      res = await runtime.requestProfile(route, method, params)
    } else {
      if (!normalized || !rosterOwnerStillActive(normalized, runtime)) {
        return {
          ok: false,
          sourceChanged: true,
          error: agentSourceUnavailableMessage(agentText, params?.profile, normalized?.connectionId)
        }
      }
      res = await runtime.request(method, params)
    }

    return { ok: true, result: res }
  } catch (err) {
    const msg = String((err && err.message) || err || '')
    if (/unknown method/i.test(msg)) {
      return { ok: false, unsupported: true }
    }
    return { ok: false, error: msg }
  }
}

function createMcpRequester(runtime = host, owner = currentBotMetaOwner(runtime)) {
  const normalized = normalizeRosterOwner(owner?.connectionId, owner?.profile)
  const route =
    normalized && typeof runtime?.requestProfile === 'function'
      ? Object.freeze({
          connectionId: normalized.connectionId,
          mode: normalized.connectionId === 'local' ? 'local' : 'remote',
          profile: normalized.profile,
          targetProfile: normalized.profile
        })
      : null

  return (method, params = {}) => mcpRpc(method, params, { runtime, owner: normalized, route })
}

// Probe lifecycle RPCs once per exact source/profile owner. A global boolean
// lets an old A gateway hide setup on a capable B gateway (and vice versa).
const mcpRpcSupport = new Map()
async function mcpSetupSupported(request, owner) {
  const normalized = normalizeRosterOwner(owner?.connectionId, owner?.profile)
  const key = normalized ? `${normalized.connectionId}::${normalized.profile}` : ''

  if (!key || typeof request !== 'function') {
    return false
  }

  if (mcpRpcSupport.has(key)) {
    return Promise.resolve(mcpRpcSupport.get(key))
  }

  const pending = Promise.resolve(request('mcp.servers.list', {})).then(r => !(r.ok === false && r.unsupported))
  mcpRpcSupport.set(key, pending)
  const supported = await pending
  mcpRpcSupport.set(key, supported)

  return supported
}

function McpSetupButton({ profile, entry, onDone, ensureProfile }) {
  const copy = useAgentText()
  // entry: { name, requires:[env keys], auth?, fromCatalog, installed }
  // profile may be null at first (New Agent: the profile isn't created yet).
  // ensureProfile() lazily creates it on the first setup action and returns the
  // slug, so OAuth / API-key setup works DURING creation, not only in Edit.
  const [phase, setPhase] = useState('idle') // idle | keys | oauth | busy | done | error
  const [supported, setSupported] = useState(null)
  const [keyValues, setKeyValues] = useState({})
  const [message, setMessage] = useState('')
  const pollRef = useRef(null)
  const profileRef = useRef(profile || null)
  const ownerRef = useRef(currentBotMetaOwner())
  const requesterRef = useRef(null)

  if (!requesterRef.current) {
    requesterRef.current = createMcpRequester(host, ownerRef.current)
  }

  const rpc = requesterRef.current

  useEffect(() => {
    if (profile) {
      profileRef.current = profile
    }
  }, [profile])

  // Resolve the target profile, creating it on demand for the New Agent flow.
  const resolveProfile = async () => {
    if (profileRef.current) {
      return profileRef.current
    }
    if (ensureProfile) {
      const created = await ensureProfile()
      if (created) {
        profileRef.current = created
      }
      return created
    }
    return null
  }

  useEffect(() => {
    let alive = true
    mcpSetupSupported(rpc, ownerRef.current).then(ok => {
      if (alive) setSupported(ok)
    })
    return () => {
      alive = false
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [])

  const isOAuth = (entry.auth || '').toLowerCase() === 'oauth'
  const requires = entry.requires || []

  const beginKeys = async () => {
    // Ensure the server exists in the target profile first (add from catalog).
    setPhase('busy')
    setMessage('')
    const profile = await resolveProfile()
    if (!profile) {
      setPhase('idle')
      return
    }
    if (entry.fromCatalog && !entry.installed) {
      const add = await rpc('mcp.servers.add', { profile, name: entry.name, preset: entry.name })
      if (!add.ok) {
        setPhase('error')
        setMessage(add.error || copy('mcp.addFailed'))
        return
      }
    }
    setPhase(isOAuth ? 'oauth' : 'keys')
  }

  const submitKeys = async () => {
    setPhase('busy')
    const profile = profileRef.current
    if (!profile) {
      setPhase('error')
      setMessage(copy('mcp.noTarget'))
      return
    }
    for (const k of requires) {
      const val = (keyValues[k] || '').trim()
      if (!val) {
        continue
      }
      const r = await rpc('mcp.servers.set_api_key', { profile, name: entry.name, env_var: k, value: val })
      if (!r.ok) {
        setPhase('error')
        setMessage(r.error || copy('mcp.setFailed', k))
        return
      }
    }
    // Verify via test.
    const t = await rpc('mcp.servers.test', { profile, name: entry.name })
    if (t.ok && t.result && (t.result.ok || (t.result.result && t.result.result.ok))) {
      setPhase('done')
      host.notify({ kind: 'success', message: copy('mcp.configured', entry.name) })
      onDone && onDone()
    } else {
      setPhase('error')
      setMessage((t.result && (t.result.error || (t.result.result && t.result.result.error))) || copy('mcp.testFailed'))
    }
  }

  const beginOAuth = async () => {
    // A second click (retry, impatient double-click) must not orphan the
    // previous poll interval — an overwritten pollRef leaks a 2s poller that
    // runs until unmount and can flip phase from a stale OAuth session.
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setPhase('busy')
    setMessage('')
    const profile = await resolveProfile()
    if (!profile) {
      setPhase('idle')
      return
    }
    if (entry.fromCatalog && !entry.installed) {
      const add = await rpc('mcp.servers.add', { profile, name: entry.name, preset: entry.name })
      if (!add.ok) {
        setPhase('error')
        setMessage(add.error || copy('mcp.addFailed'))
        return
      }
    }
    const start = await rpc('mcp.servers.oauth.start', { profile, name: entry.name })
    const payload = start.result && (start.result.result || start.result)
    const authUrl = payload && (payload.auth_url || payload.verification_url)
    const sessionId = payload && payload.session_id
    if (!start.ok || !authUrl || !sessionId) {
      setPhase('error')
      setMessage((start.error) || copy('mcp.oauthStartFailed'))
      return
    }
    // Open the auth URL in the native browser, same as provider OAuth.
    try {
      if (host.openExternal) {
        host.openExternal(authUrl)
      } else if (typeof window !== 'undefined' && window.hermesDesktop && window.hermesDesktop.openExternal) {
        window.hermesDesktop.openExternal(authUrl)
      } else {
        window.open(authUrl, '_blank')
      }
    } catch {
      /* fall through to poll; user can open the URL from the toast */
    }
    setPhase('oauth')
    setMessage(copy('mcp.completeSignIn'))
    pollRef.current = setInterval(async () => {
      const poll = await rpc('mcp.servers.oauth.poll', { profile, name: entry.name, session_id: sessionId })
      const pd = poll.result && (poll.result.result || poll.result)
      const status = pd && pd.status
      if (poll.sourceChanged) {
        clearInterval(pollRef.current)
        pollRef.current = null
        setPhase('error')
        setMessage(poll.error || copy('mcp.oauthFailed'))
      } else if (status === 'approved') {
        clearInterval(pollRef.current)
        pollRef.current = null
        setPhase('done')
        host.notify({ kind: 'success', message: copy('mcp.authenticated', entry.name) })
        onDone && onDone()
      } else if (status === 'error') {
        clearInterval(pollRef.current)
        pollRef.current = null
        setPhase('error')
        setMessage((pd && pd.error_message) || copy('mcp.oauthFailed'))
      }
    }, 2000)
  }

  if (supported === false) {
    return jsx('span', {
      className: 'ml-1.5 text-[0.65rem] text-(--ui-text-quaternary)',
      children: copy('mcp.needsSetup', requires.join(', '))
    })
  }
  if (phase === 'done') {
    return jsx('span', { className: 'ml-1.5 text-[0.65rem] text-(--ui-success,#22c55e)', children: copy('mcp.setUpDone') })
  }
  if (phase === 'keys') {
    return jsxs('div', {
      className: 'mt-1 grid gap-1',
      children: [
        ...requires.map(k =>
          jsx(Input, {
            key: k,
            type: 'password',
            className: 'h-6 text-[0.7rem]',
            placeholder: k,
            value: keyValues[k] || '',
            onChange: e => setKeyValues(prev => ({ ...prev, [k]: e.target.value }))
          }, k)
        ),
        jsxs('div', {
          className: 'flex gap-1',
          children: [
            jsx(Button, { size: 'xs', variant: 'secondary', onClick: () => void submitKeys(), children: copy('mcp.saveAndTest') }),
            jsx(Button, { size: 'xs', variant: 'ghost', onClick: () => setPhase('idle'), children: copy('common.cancel') })
          ]
        })
      ]
    })
  }
  if (phase === 'oauth') {
    return jsx('span', { className: 'ml-1.5 text-[0.65rem] text-(--ui-text-quaternary)', children: message || copy('mcp.authorizing') })
  }
  if (phase === 'busy') {
    return jsx('span', { className: 'ml-1.5 text-[0.65rem] text-(--ui-text-quaternary)', children: copy('common.working') })
  }
  if (phase === 'error') {
    return jsxs('span', {
      className: 'ml-1.5 text-[0.65rem] text-(--ui-danger,#ef4444)',
      children: [(message || copy('mcp.setupFailed')) + ' ', jsx('button', { className: 'underline', onClick: () => setPhase('idle'), children: copy('common.retry') })]
    })
  }
  // idle
  return jsx('button', {
    className: 'ml-1.5 text-[0.65rem] text-(--ui-accent,#4f9cf9) underline',
    onClick: () => void (isOAuth ? beginOAuth() : beginKeys()),
    children: isOAuth ? copy('mcp.signIn') : copy('mcp.setUp')
  })
}

function botAppearance(name, meta) {
  // The primary profile is literally named "default"; the SDK's profileColor
  // can hand it a near-black that renders as an ugly black square, and any
  // auto-seeded color in local bot-meta would otherwise stick. Give the
  // primary a nice fixed generic look (a friendly violet squircle). A user's
  // EXPLICIT customization still wins: an uploaded/generated/pet image, or a
  // shape/color they set via the editor (tracked by meta.custom === true).
  const isPrimary = (name || '').trim().toLowerCase() === 'default'
  const userCustomized = Boolean(meta?.custom)
  if (isPrimary && !userCustomized) {
    return { shape: 'squircle', color: '#8b5cf6', image: meta?.image || null }
  }
  return {
    shape: meta?.shape || defaultShapeFor(name),
    color: meta?.color || profileColor(name),
    image: meta?.image || null
  }
}

// ── image avatars: upload from device + generate via image.generate ─────────

/** Downscale to a small square so plugin storage stays light. */
function normalizeAvatarImage(dataUrl, edge = 256) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = edge
        canvas.height = edge
        const ctx2d = canvas.getContext('2d')
        const side = Math.min(img.width, img.height)
        ctx2d.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, edge, edge)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

function pickImageFromDevice() {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,image/webp,image/gif'
    input.onchange = () => {
      const file = input.files?.[0]

      if (!file) {
        return resolve(null)
      }

      if (file.size > 15_000_000) {
        host.notify({ kind: 'error', message: agentText('avatar.tooLarge') })
        return resolve(null)
      }

      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    }
    input.click()
  })
}

/** Cached probe: does the gateway have an image backend? A `false` answer
 *  is re-checked on every dialog open — the gateway may have been restarted
 *  (picking up image.generate) or a backend enabled since the last probe.
 *  Only `true` is sticky. */
const $imagenAvailable = atom(null)
let imagenProbeInflight = null

function probeImagen() {
  if (imagenProbeInflight) {
    return imagenProbeInflight
  }

  imagenProbeInflight = host
    .request('image.generate', { probe: true })
    .then(res => $imagenAvailable.set(Boolean(res?.available)))
    .catch(() => $imagenAvailable.set(false))
    .finally(() => {
      imagenProbeInflight = null
    })

  return imagenProbeInflight
}

async function generateAvatarImage(bot, title, description) {
  const who = [title || bot, description].filter(Boolean).join(' — ')
  const res = await host.request('image.generate', {
    prompt:
      `Cute minimal robot avatar for an AI agent named "${who}". ` +
      'Friendly simple mascot face, bold flat vector style, solid color background, centered, no text.',
    aspect_ratio: 'square'
  })

  if (!res?.success) {
    throw new Error(res?.error || agentText('avatar.backendFailed'))
  }

  // image_data (data URL) works over local AND remote gateways; the raw
  // backend URL is the fallback when the gateway couldn't inline it.
  return res.image_data || res.image
}

/** Shape grid + color swatches, shared by Edit Profile and New Agent.
 *  Layout uses inline grid styles — arbitrary Tailwind classes like
 *  `grid-cols-7` are NOT in the app's precompiled CSS, which collapsed
 *  this into a single vertical column. */
function AvatarPicker({ shape, color, image, onShape, onColor, onImage, generateSeed }) {
  const copy = useAgentText()
  const pickerName = generateSeed?.name || 'agent'
  const imagen = useValue($imagenAvailable)
  const [tab, setTab] = useState('bot')
  const [describe, setDescribe] = useState('')
  const [genBusy, setGenBusy] = useState(false)

  if (imagen === null) {
    void probeImagen()
  }

  // Re-check a stale "unavailable" whenever the user lands on the Generate
  // tab — the gateway may have restarted with image.generate since.
  const goTab = id => {
    setTab(id)

    if (id === 'generate' && $imagenAvailable.get() === false) {
      $imagenAvailable.set(null)
      void probeImagen()
    }
  }

  const upload = async () => {
    const raw = await pickImageFromDevice()

    if (raw) {
      onImage(await normalizeAvatarImage(raw))
    }
  }

  const generate = async () => {
    if (genBusy) {
      return
    }

    setGenBusy(true)

    try {
      const custom = describe.trim()
      const img = custom
        ? await (async () => {
            const res = await host.request('image.generate', {
              prompt: `${custom}. Avatar for an AI agent: centered, bold flat vector style, solid color background, no text.`,
              aspect_ratio: 'square'
            })

            if (!res?.success) {
              throw new Error(res?.error || agentText('avatar.backendFailed'))
            }

            return res.image_data || res.image
          })()
        : await generateAvatarImage(generateSeed?.name || 'agent', generateSeed?.title, generateSeed?.description)

      if (img) {
        onImage(await normalizeAvatarImage(img))
      }
    } catch (err) {
      host.notifyError(err, agentText('avatar.generationFailed'))
    } finally {
      setGenBusy(false)
    }
  }

  const tabButton = (id, label) =>
    jsx(
      'button',
      {
        type: 'button',
        className: cn(
          'rounded-full px-3 py-1 text-xs font-medium transition-colors',
          tab === id
            ? 'bg-(--chrome-action-hover) text-foreground'
            : 'text-(--ui-text-tertiary) hover:text-(--ui-text-secondary)'
        ),
        onClick: () => goTab(id),
        children: label
      },
      id
    )

  return jsxs('div', {
    className: 'grid justify-items-center gap-3',
    children: [
      // Tab pills: Bot | Generate | Upload | Pet
      jsxs('div', {
        className: 'flex items-center gap-1',
        children: [
          tabButton('bot', copy('avatar.shapeTab')),
          tabButton('generate', copy('avatar.generateTab')),
          tabButton('upload', copy('avatar.uploadTab')),
          tabButton('pet', copy('avatar.petTab'))
        ]
      }),

      image && tab !== 'generate'
        ? jsx(Button, {
            type: 'button',
            variant: 'ghost',
            size: 'sm',
            onClick: () => onImage(null),
            children: copy('avatar.removeImage')
          })
        : null,

      tab === 'bot'
        ? jsxs('div', {
            className: 'grid justify-items-center gap-3',
            children: [
              jsx('div', {
                style: {
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: '6px',
                  justifyItems: 'center'
                },
                children: AVATAR_PICKER_SHAPES.map(s =>
                  jsx(
                    'button',
                    {
                      type: 'button',
                      className: cn(
                        'flex items-center justify-center rounded-md transition-colors hover:bg-(--chrome-action-hover)',
                        s === shape && !image && 'ring-1 ring-(--ui-accent)'
                      ),
                      style: { width: 44, height: 44 },
                      onClick: () => {
                        onImage(null)
                        onShape(s)
                      },
                      children: jsx(BotFace, { shape: s, color, size: 32, name: pickerName })
                    },
                    s
                  )
                )
              }),
              jsx('div', {
                style: {
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                  gap: '8px',
                  justifyItems: 'center'
                },
                children: AVATAR_COLORS.map(c =>
                  jsx(
                    'button',
                    {
                      type: 'button',
                      className: cn(
                        'rounded-full transition-transform hover:scale-110',
                        c === color && 'ring-2 ring-(--ui-accent) ring-offset-1 ring-offset-(--ui-bg, transparent)'
                      ),
                      style: { width: 22, height: 22, backgroundColor: c },
                      onClick: () => onColor(c)
                    },
                    c
                  )
                )
              })
            ]
          })
        : null,

      tab === 'generate'
        ? imagen
          ? jsxs('div', {
              className: 'grid w-full gap-2',
              children: [
                jsx(Textarea, {
                  className: 'min-h-16 text-xs',
                  placeholder: copy('avatar.describe'),
                  value: describe,
                  onChange: event => setDescribe(event.target.value)
                }),
                jsxs(Button, {
                  type: 'button',
                  variant: 'secondary',
                  className: 'w-full justify-center',
                  disabled: genBusy,
                  onClick: generate,
                  children: [
                    genBusy
                      ? jsx(GlyphSpinner, { spinner: 'breathe', className: 'mr-1 text-[0.8rem]' })
                      : jsx(Codicon, { name: 'sparkle', className: 'mr-1 text-[0.8rem]' }),
                    genBusy ? copy('avatar.generating') : copy('avatar.generate')
                  ]
                }),
                describe.trim()
                  ? null
                  : jsx('div', {
                      className: 'text-center text-[0.65rem] text-(--ui-text-quaternary)',
                      children: copy('avatar.blankHint')
                    })
              ]
            })
          : jsx('div', {
              className: 'px-2 py-3 text-center text-xs leading-5 text-(--ui-text-tertiary)',
              children:
                imagen === false
                  ? copy('avatar.noModel')
                  : copy('avatar.checking')
            })
        : null,

      tab === 'upload'
        ? jsxs(Button, {
            type: 'button',
            variant: 'secondary',
            className: 'w-full justify-center',
            onClick: upload,
            children: [jsx(Codicon, { name: 'device-camera', className: 'mr-1 text-[0.8rem]' }), copy('avatar.chooseImage')]
          })
        : null,

      tab === 'pet' ? jsx(PetTab, { image, onImage }) : null
    ]
  })
}

// ── pet tab: attach a petdex companion that lives beside the avatar ─────────

// A petdex "spritesheet" is the FULL animation sheet (1536×1872 webp, ~2MB;
// 8×9 grid of 192×208 frames). Using it as an <img> both downloads megabytes
// per tile and shows the whole sheet squashed. Extract frame 0 once per slug
// via canvas, downscale to 96px, and cache the data URL. Concurrency-capped
// so opening the tab doesn't fire dozens of 2MB fetches at once.
const PET_FRAME_W = 192
const PET_FRAME_H = 208
const petFrameCache = new Map()
let petFetchActive = 0
const petFetchQueue = []

function pumpPetQueue() {
  while (petFetchActive < 4 && petFetchQueue.length) {
    const job = petFetchQueue.shift()
    petFetchActive++
    job().finally(() => {
      petFetchActive--
      pumpPetQueue()
    })
  }
}

function petFrameIcon(spriteUrl) {
  if (!spriteUrl) {
    return Promise.resolve(null)
  }

  if (!petFrameCache.has(spriteUrl)) {
    petFrameCache.set(
      spriteUrl,
      new Promise(resolve => {
        petFetchQueue.push(async () => {
          try {
            const resp = await fetch(spriteUrl, { signal: AbortSignal.timeout(15000) })
            const blob = await resp.blob()
            // Crop frame 0 during decode — never materialize the full sheet.
            const bitmap = await createImageBitmap(blob, 0, 0, PET_FRAME_W, PET_FRAME_H)
            const canvas = document.createElement('canvas')
            canvas.width = 96
            canvas.height = 104
            canvas.getContext('2d').drawImage(bitmap, 0, 0, 96, 104)
            bitmap.close()
            resolve(canvas.toDataURL('image/png'))
          } catch {
            petFrameCache.delete(spriteUrl)
            resolve(null)
          }
        })
        pumpPetQueue()
      })
    )
  }

  return petFrameCache.get(spriteUrl)
}

/** One pet tile image: frame 0 only, resolved lazily through the cache. */
function PetThumb({ spriteUrl, size = 40 }) {
  const [icon, setIcon] = useState(null)

  useEffect(() => {
    let alive = true
    petFrameIcon(spriteUrl).then(url => {
      if (alive) {
        setIcon(url)
      }
    })
    return () => {
      alive = false
    }
  }, [spriteUrl])

  if (!icon) {
    return jsx('div', {
      style: { width: size, height: size, borderRadius: 6, background: 'var(--chrome-action-hover, rgba(255,255,255,0.06))' }
    })
  }

  return jsx('img', {
    src: icon,
    alt: '',
    style: { width: size, height: size, objectFit: 'contain', imageRendering: 'pixelated', borderRadius: 6 }
  })
}

function PetTab({ image, onImage }) {
  const copy = useAgentText()
  // Selection is dialog-local: committed by the dialog's Save like any
  // uploaded/generated image (a direct meta write here gets clobbered by
  // Save's own image state).
  const [selectedSlug, setSelectedSlug] = useState(null)
  const { data, isLoading } = useQuery({
    queryKey: [ID, 'pet-gallery'],
    queryFn: () => host.request('pet.gallery', {}),
    staleTime: 300000
  })
  const [query, setQuery] = useState('')
  // Windowed rendering: the gallery is 4500+ pets — mounting an <img> per pet
  // froze the dialog. Render `limit` at a time and grow on scroll-to-bottom.
  const [limit, setLimit] = useState(24)
  const pets = data?.pets ?? []

  if (isLoading) {
    return jsx('div', {
      className: 'flex justify-center py-4',
      children: jsx(GlyphSpinner, { spinner: 'breathe', className: 'text-(--ui-text-tertiary)' })
    })
  }

  if (!pets.length) {
    return jsx('div', {
      className: 'px-2 py-3 text-center text-xs text-(--ui-text-tertiary)',
      children: copy('pet.none')
    })
  }

  const q = query.trim().toLowerCase()
  const filtered = q
    ? pets.filter(pet => (pet.displayName || '').toLowerCase().includes(q) || (pet.slug || '').includes(q))
    : pets
  // Installed and curated pets surface first — they're the likeliest picks.
  const ranked = filtered.slice().sort((a, b) => {
    const rank = pet => (pet.installed ? 0 : pet.curated ? 1 : 2)
    return rank(a) - rank(b)
  })
  const visible = ranked.slice(0, limit)

  const onScroll = event => {
    const el = event.currentTarget

    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120 && limit < ranked.length) {
      setLimit(prev => Math.min(prev + 24, ranked.length))
    }
  }

  return jsxs('div', {
    className: 'grid w-full gap-2',
    children: [
      jsx('div', {
        className: 'text-center text-[0.65rem] text-(--ui-text-quaternary)',
        children: copy('pet.pick')
      }),
      jsx(Input, {
        className: 'h-7 text-xs',
        placeholder: copy('pet.search', pets.length),
        value: query,
        onChange: event => {
          setQuery(event.target.value)
          setLimit(24)
        }
      }),
      image && selectedSlug
        ? jsx(Button, {
            type: 'button',
            variant: 'ghost',
            size: 'sm',
            className: 'justify-center',
            onClick: () => {
              setSelectedSlug(null)
              onImage(null)
            },
            children: copy('pet.remove')
          })
        : null,
      filtered.length === 0
        ? jsx('div', {
            className: 'py-3 text-center text-xs text-(--ui-text-quaternary)',
            children: copy('pet.noMatch')
          })
        : jsxs('div', {
            onScroll,
            style: { maxHeight: 220, overflowY: 'auto' },
            children: [
              jsx('div', {
                style: {
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '6px'
                },
                children: visible.map(pet =>
                  jsxs(
                    'button',
                    {
                      type: 'button',
                      className: cn(
                        'grid justify-items-center gap-1 rounded-md p-1.5 transition-colors hover:bg-(--chrome-action-hover)',
                        selectedSlug === pet.slug && 'ring-1 ring-(--ui-accent)'
                      ),
                      onClick: () => {
                        // The pet IS the profile picture: extract frame 0
                        // and hand it to the dialog as the avatar image.
                        // Persisted when the user hits Save.
                        setSelectedSlug(pet.slug)
                        void petFrameIcon(pet.spritesheetUrl).then(icon => {
                          if (icon) {
                            onImage(icon)
                          } else {
                            setSelectedSlug(null)
                            host.notify({ kind: 'error', message: copy('pet.loadFailed') })
                          }
                        })
                      },
                      children: [
                        jsx(PetThumb, { spriteUrl: pet.spritesheetUrl, size: 40 }),
                        jsx('span', {
                          className: 'w-full truncate text-center text-[0.6rem] text-(--ui-text-tertiary)',
                          children: pet.displayName
                        })
                      ]
                    },
                    pet.slug
                  )
                )
              }),
              limit < ranked.length
                ? jsx('div', {
                    className: 'py-2 text-center text-[0.65rem] text-(--ui-text-quaternary)',
                    children: copy('pet.more', limit, ranked.length)
                  })
                : null
            ]
          })
    ]
  })
}

// ── data ─────────────────────────────────────────────────────────────────────

/** Pins to resolve precisely on the next roster poll: {profile: chatId}.
 *  The backend answers "what about THIS conversation" per entry
 *  (preferred_session), so a row's preview can describe the same session its
 *  click opens (hermes-agent#88200). Unknown params are ignored by older
 *  gateways, which simply omit the field. */
function preferredSessionIds(allMeta) {
  const pins = {}
  for (const [name, meta] of Object.entries(allMeta || {})) {
    if (meta?.chat) {
      pins[name] = meta.chat
    }
  }
  return pins
}

function rosterActivity(bot, metaByName, rosterOwner = null) {
  const created =
    botRosterMeta(bot, metaByName, rosterOwner)?.created || bot?.ui_meta?.['hermes-bots']?.created || 0
  const lastMessage = (bot?.last_session?.last_active || 0) * 1000

  return Math.max(created, lastMessage)
}

function rosterPinned(bot, metaByName, rosterOwner = null) {
  return Boolean(
    botRosterMeta(bot, metaByName, rosterOwner)?.pinned || bot?.ui_meta?.['hermes-bots']?.pinned
  )
}

function sortRosterSnapshot(profiles, metaByName, rosterOwner = null) {
  return profiles.slice().sort((left, right) => {
    const leftPinned = rosterPinned(left, metaByName, rosterOwner) ? 1 : 0
    const rightPinned = rosterPinned(right, metaByName, rosterOwner) ? 1 : 0

    if (leftPinned !== rightPinned) {
      return rightPinned - leftPinned
    }

    return rosterActivity(right, metaByName, rosterOwner) - rosterActivity(left, metaByName, rosterOwner)
  })
}

function normalizeRosterOwner(connectionId, profile) {
  const source = String(connectionId || '').trim()
  const ownerProfile = String(profile || '').trim()

  return source && ownerProfile ? { connectionId: source, profile: ownerProfile } : null
}

function agentCapabilityCatalogScopeKey(rosterOwner, source) {
  const owner = normalizeRosterOwner(rosterOwner?.connectionId, rosterOwner?.profile)
  const catalogSource = String(source || '').trim()

  return owner && catalogSource
    ? `${owner.connectionId}::${owner.profile}::${catalogSource}`
    : ''
}

function agentCapabilityCatalogRequestCurrent(request, current) {
  return Boolean(
    request &&
      current &&
      request.scopeKey &&
      request.scopeKey === current.scopeKey &&
      request.generation === current.generation
  )
}

async function loadAgentCapabilityCatalog(request, token, source, describeName, isCurrent) {
  const [profile, catalog] = await Promise.all([
    request('profiles.describe', { name: describeName }),
    request('mcp.catalog', {}).catch(() => null)
  ])

  if (!isCurrent(token)) {
    return null
  }

  // Full MCP menu = the profile's configured servers + the bundled catalog
  // (installable). Configured entries win on name clash.
  const configured = profile.mcp_servers || []
  const have = new Set(configured.map(server => server.name))
  const installable = ((catalog && catalog.servers) || []).filter(server => !have.has(server.name))

  return {
    scopeKey: token.scopeKey,
    source,
    skills: profile.skills || [],
    toolsets: profile.toolsets || [],
    mcp: [
      ...configured,
      ...installable.map(server => ({
        name: server.name,
        enabled: false,
        fromCatalog: true,
        installed: server.installed,
        auth: server.auth,
        requires: server.requires || [],
        description: server.description || ''
      }))
    ]
  }
}

function sameRosterOwner(left, right) {
  const a = normalizeRosterOwner(left?.connectionId, left?.profile)
  const b = normalizeRosterOwner(right?.connectionId, right?.profile)

  return Boolean(a && b && a.connectionId === b.connectionId && a.profile === b.profile)
}

function isExactLocalRosterOwner(owner) {
  const normalized = normalizeRosterOwner(owner?.connectionId, owner?.profile)

  return Boolean(normalized && normalized.connectionId === 'local')
}

function currentBotMetaOwner(runtime = host) {
  const connectionId = String(
    runtime?.state?.connectionId?.get?.() || runtime?.activeConnectionId?.() || ''
  ).trim()
  const profile = String(runtime?.state?.profile?.get?.() || 'default').trim() || 'default'

  return normalizeRosterOwner(connectionId, profile)
}

function rosterOwnerStillActive(owner, runtime = host) {
  return sameRosterOwner(owner, currentBotMetaOwner(runtime))
}

/** Capture one source/profile request door for a multi-await operation. Modern
 *  SDKs route every call to that descriptor; old SDKs may use the ambient
 *  gateway only while the captured owner remains exact. */
function createRosterOwnerRequester(runtime = host, rosterOwner = currentBotMetaOwner(runtime)) {
  const owner = normalizeRosterOwner(rosterOwner?.connectionId, rosterOwner?.profile)
  const route =
    owner && typeof runtime?.requestProfile === 'function'
      ? Object.freeze({
          connectionId: owner.connectionId,
          mode: owner.connectionId === 'local' ? 'local' : 'remote',
          profile: owner.profile,
          targetProfile: owner.profile
        })
      : null

  return async (method, params = {}) => {
    if (route) {
      return runtime.requestProfile(route, method, params)
    }

    if (!owner || !rosterOwnerStillActive(owner, runtime)) {
      throw new Error(agentSourceUnavailableMessage(agentText, params?.profile || owner?.profile, owner?.connectionId))
    }

    return runtime.request(method, params)
  }
}

function collaborationRosterOwnerForSurface(owner, surface) {
  const source = String(surface?.leadConnectionId || '').trim()
  const profile = String(surface?.leadProfile || '').trim()

  if (!owner || !source || !profile || owner.connectionId !== source || owner.profile !== profile) {
    return null
  }

  return owner
}

function isCollaborationLeadRosterBot(bot, surface, rosterOwner = null) {
  const profile = String(surface?.leadProfile || '').trim()
  const source = String(surface?.leadConnectionId || '').trim()
  const botProfile = String(bot?.name || '').trim()
  const botSource = String(bot?.connectionId || '').trim()

  if (!profile || !source || botProfile !== profile) {
    return false
  }

  if (botSource) {
    return botSource === source
  }

  const owner = normalizeRosterOwner(rosterOwner?.connectionId, rosterOwner?.profile)

  return Boolean(!bot?.remoteSource && owner && owner.connectionId === source && owner.profile === profile)
}

// Every session header can mount an Agents selector, so roster reconciliation
// must not depend on the management route being open. React Query shares the
// same data object across consumers. Keeping the state inside a tiny executable
// coordinator makes the once-per-snapshot contract behavior-testable without
// copying or parsing this single-file plugin.
function createRosterSnapshotCoordinator(effects) {
  let coordinatedRosterData = null
  let coordinatedRosterMeta = null
  let coordinatedRosterSource = ''
  let coordinatedRosterProfile = ''

  return function coordinate(data, sourceId, metaByName, profile = 'default') {
    if (!data || !Array.isArray(data.profiles)) {
      return false
    }

    const source = String(sourceId || '').trim()
    const ownerProfile = String(profile || '').trim()

    if (
      data === coordinatedRosterData &&
      metaByName === coordinatedRosterMeta &&
      source === coordinatedRosterSource &&
      ownerProfile === coordinatedRosterProfile
    ) {
      return false
    }

    coordinatedRosterData = data
    coordinatedRosterMeta = metaByName
    coordinatedRosterSource = source
    coordinatedRosterProfile = ownerProfile

    const owner = normalizeRosterOwner(source, ownerProfile)
    const roster = sortRosterSnapshot(data.profiles, metaByName, owner)
    const activeSourceRoster = roster.filter(bot => !bot.remoteSource)

    effects.setLastRoster(roster, owner)
    effects.mergeMeta(activeSourceRoster, owner)
    effects.pullAvatars(activeSourceRoster, owner)
    effects.trackActivity(activeSourceRoster, owner)
    // This capability belongs to the captured query result. Never let a slow
    // roster response from source A toggle protocol writes for source B.
    effects.backfillProtocol(activeSourceRoster, owner, Boolean(data.bot_mode_protocol))

    return true
  }
}

const coordinateRosterSnapshot = createRosterSnapshotCoordinator({
  setLastRoster: (roster, owner) => {
    $lastRoster.set(roster)
    $lastRosterOwner.set(owner)
  },
  mergeMeta: mergeServerMeta,
  pullAvatars: (roster, owner) => {
    if (isExactLocalRosterOwner(owner)) {
      pullServerAvatars(roster, owner)
    }
  },
  trackActivity: (roster, owner) => {
    if (isExactLocalRosterOwner(owner)) {
      trackInboundActivity(roster)
    }
  },
  backfillProtocol: (roster, owner, protocolInjected) =>
    backfillMessagingProtocol(roster, owner, { protocolInjected })
})

function useRoster() {
  const activeConnectionId = useValue(host.state.connectionId)
  const activeProfile = useValue(host.state.profile)
  const profileKey = String(activeProfile || 'default').trim() || 'default'
  const queryOwner = normalizeRosterOwner(activeConnectionId, profileKey)
  const allMeta = useValue($botMeta)
  const botMetaOwner = useValue($botMetaOwner)

  const result = useQuery({
    queryKey: [...ROSTER_KEY, activeConnectionId, profileKey],
    queryFn: async () => {
      // Rich rows (last_session, ui_meta, has_avatar) come from the ACTIVE
      // gateway's profiles.list — unchanged single-source behavior.
      const pins =
        isExactLocalRosterOwner(queryOwner) && sameRosterOwner(queryOwner, botMetaOwner)
          ? preferredSessionIds($botMeta.get())
          : {}
      const local = await host.request(
        'profiles.list',
        Object.keys(pins).length ? { preferred_session_ids: pins } : {}
      )
      // Multi-source desktops (hermes-agent #86875) also expose the union
      // agent roster across every registered connection. Merge agents from
      // OTHER sources in as additional rows. Feature-detected + best-effort:
      // an older Desktop build (no host.agents) or a roster hiccup leaves
      // the local list exactly as it was.
      if (typeof host.agents === 'function') {
        try {
          const union = await host.agents()
          return {
            ...mergeMultiSourceRoster(local, union, activeConnectionId, $lastRoster.get()),
            rosterOwner: queryOwner
          }
        } catch {
          /* older build or roster failure — single-source list stands */
        }
      }

      return { ...local, rosterOwner: queryOwner }
    },
    refetchInterval: 5000,
    staleTime: 5000,
    // Remote (SSH) gateways connect slowly and drop on sleep/wake; keep
    // retrying instead of latching a terminal error card.
    retry: true,
    retryDelay: attempt => Math.min(15000, 1000 * 2 ** attempt)
  })

  useEffect(() => {
    coordinateRosterSnapshot(
      result.data,
      result.data?.rosterOwner?.connectionId,
      allMeta,
      result.data?.rosterOwner?.profile
    )
  }, [allMeta, botMetaOwner, result.data])

  return { ...result, rosterOwner: result.data?.rosterOwner || null }
}

/** Merge the union agent roster (host.agents) over the active gateway's
 *  profiles.list. Active-source rows — matched by the LIVE connection id,
 *  falling back to the roster's primaryConnectionId, then the legacy
 *  kind==='local' rule on older desktops — are the agents profiles.list
 *  already returned: they only ANNOTATE the rich rows (handle, connection
 *  fields); rich fields stay authoritative and they are NOT duplicated.
 *  Rows from other sources become new roster entries tagged with their
 *  source label so BotRow can badge them and route open/warm through
 *  ensureAgent/warmAgent. Pure — exercised directly by the tests. */
function mergeMultiSourceRoster(local, union, activeConnectionId, previous = []) {
  const localProfiles = Array.isArray(local?.profiles) ? local.profiles : []
  const agents = Array.isArray(union?.agents) ? union.agents : []
  // A live id of null/'' means the window is on the unscoped local backend
  // (legacy hosts reported null for mode:'local'; the SDK now reports
  // 'local'). Do NOT fall back to registry primary when the third argument
  // was passed — primary can still say "spark" after the user clicked a
  // local bot, which skipped every Spark row as "active" and invented a
  // This-device shadow of default.
  const liveProvided = arguments.length >= 3
  const liveId = String(activeConnectionId || '').trim()
  let activeId = liveId || (liveProvided ? '' : String(union?.primaryConnectionId || '').trim())

  // Migrated remote-primary windows can still expose a legacy remote
  // descriptor without connectionId. That produces a null live id even
  // though profiles.list is answering from the registry primary. Infer the
  // primary only when its inventory matches the rich rows and the local
  // inventory does not. A genuinely local window has a matching local row,
  // so it keeps the null-is-local behavior used after clicking This device.
  if (!activeId && liveProvided) {
    const primaryId = String(union?.primaryConnectionId || '').trim()
    const richNames = new Set(localProfiles.map(profile => String(profile?.name || '').trim()).filter(Boolean))
    const localMatches = agents.some(
      agent => agent?.connectionKind === 'local' && richNames.has(String(agent?.profile || '').trim())
    )
    const primaryMatches = agents.some(
      agent => String(agent?.connectionId || '').trim() === primaryId && richNames.has(String(agent?.profile || '').trim())
    )

    if (!localMatches && primaryId && primaryMatches) {
      activeId = primaryId
    }
  }
  const activeByName = new Map()

  // Treat the rich list as one row per active-source profile. Clone every
  // row: some gateway clients reuse response objects, and annotating those in
  // place made each five-second refresh feed the previous union back into the
  // next merge, growing duplicate source rows indefinitely.
  for (const profile of localProfiles) {
    const name = String(profile?.name || '').trim()

    if (!name || profile?.remoteSource) {
      continue
    }

    if (profile?.sourceScoped && activeId && profile.connectionId !== activeId) {
      continue
    }

    if (!activeByName.has(name)) {
      activeByName.set(name, { ...profile, name })
    }
  }

  const profiles = [...activeByName.values()]

  // host.agents is an Electron/main-process capability. Defend the plugin
  // boundary too: older shells or reconnect races can still hand us repeated
  // identities even after the core roster deduplicates them.
  const seenSources = new Set()

  for (const agent of agents) {
    const profile = String(agent?.profile || '').trim()
    const connectionId = String(agent?.connectionId || '').trim()
    const sourceKey = `${connectionId}::${profile || 'default'}`

    if (!profile || seenSources.has(sourceKey)) {
      continue
    }

    seenSources.add(sourceKey)

    // The union enumerates EVERY registered connection, including the active
    // gateway that already answered profiles.list. Without this the active
    // gateway's own agents (connectionKind 'remote' on a remote-primary
    // desktop) would be appended as phantom duplicates — every bot listed
    // twice. Older Electron builds predate the connection ids; fall back to
    // the legacy local-source rule so single-source behavior stays intact.
    const isActiveSource = activeId ? connectionId === activeId : agent.connectionKind === 'local'
    const row = isActiveSource ? activeByName.get(profile) : null

    if (row) {
      // Annotate in place: the @name-device handle only differs from the
      // bare name when the profile exists on several sources.
      row.handle = agent.handle
      row.connectionId = agent.connectionId
      row.connectionKind = agent.connectionKind
      row.connectionLabel = agent.connectionLabel
      row.sourceScoped = true
      continue
    }

    if (isActiveSource) {
      // Union saw an active-source profile profiles.list didn't return (older
      // backend mid-refresh) — skip rather than invent a thin row.
      continue
    }

    profiles.push({
      name: profile,
      handle: agent.handle,
      connectionId,
      connectionKind: agent.connectionKind,
      connectionLabel: agent.connectionLabel,
      remoteSource: true,
      sourceScoped: true
    })
  }

  // SSH sources drop to connect-on-demand the moment their tunnel is not
  // the live gateway. Keep previously painted remote rows so clicking the
  // local agent does not empty Bot Mode.
  if (Array.isArray(previous) && previous.length > 0) {
    const present = new Set(profiles.map(row => `${row.connectionId || ''}::${row.name}`))
    const unionSourceIds = new Set(agents.map(agent => String(agent?.connectionId || '').trim()).filter(Boolean))
    const omitted = new Set(
      (Array.isArray(union?.sources) ? union.sources : [])
        .filter(source => source?.error === 'connect-on-demand' || source?.reachable === false)
        .map(source => String(source.connectionId || '').trim())
        .filter(Boolean)
    )

    const registered = new Set(
      (Array.isArray(union?.sources) ? union.sources : [])
        .map(source => String(source?.connectionId || '').trim())
        .filter(Boolean)
    )

    for (const row of previous) {
      const connectionId = String(row?.connectionId || '').trim()
      const name = String(row?.name || '').trim()
      const key = `${connectionId}::${name || 'default'}`

      if (!row?.remoteSource || !connectionId || !name || present.has(key)) {
        continue
      }

      if (registered.size > 0 && !registered.has(connectionId)) {
        continue
      }

      if (omitted.has(connectionId) || !unionSourceIds.has(connectionId)) {
        profiles.push({ ...row, remoteSource: true, sourceScoped: true })
        present.add(key)
      }
    }
  }

  return { ...local, profiles }
}

/** The @handle users tag a bot with. Multi-source rosters precompute the
 *  handle (bare name, or name-device when the profile exists on several
 *  registered sources) — prefer it when present. The primary profile's
 *  callable alias is 'hermes' — the mention middleware resolves it back to
 *  'default' — so the word 'default' never surfaces in the UI. */
function botHandle(name, bot) {
  if (bot?.handle && bot.handle !== name) {
    return bot.handle
  }

  return (name || '').trim().toLowerCase() === 'default' ? 'hermes' : name
}

function isActiveRosterBot(bot, active) {
  const activeName = String(active?.name || 'default').trim() || 'default'
  const activeId = String(active?.connectionId || '').trim()
  const botId = String(bot?.connectionId || '').trim()
  const botName = String(bot?.name || '').trim() || 'default'

  if (bot?.remoteSource) {
    return Boolean(activeId) && activeId === botId && botName === activeName
  }

  if (activeId && activeId !== 'local' && botId && activeId !== botId) {
    return false
  }

  return botName === activeName
}

/** Resolve @handles in prose against the Bot Mode roster (local + Connections).
 *  Skips the bot already speaking in this chat. Unique bare names match;
 *  duplicate names require the @name-device handle. */
function resolveRosterMentions(text, roster, active = {}) {
  const members = Array.isArray(roster) ? roster : []
  const prose = String(text || '').replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ')
  const byForm = new Map()

  for (const bot of members) {
    if (!bot?.name || isActiveRosterBot(bot, active)) {
      continue
    }

    const handle = String(botHandle(bot.name, bot) || '').toLowerCase()
    const name = String(bot.name || '').toLowerCase()
    const forms = new Set([handle, name])

    if (bot.handle) {
      forms.add(String(bot.handle).toLowerCase())
    }

    for (const form of forms) {
      if (!form) {
        continue
      }

      const existing = byForm.get(form)

      if (existing && existing !== bot) {
        byForm.set(form, null)
        continue
      }

      if (!existing) {
        byForm.set(form, bot)
      }
    }
  }

  const mentioned = []
  const seen = new Set()

  for (const match of prose.matchAll(/(^|\s)@([a-z0-9][a-z0-9_-]*)/gi)) {
    let token = match[2].toLowerCase()

    if (token === 'hermes') {
      token = byForm.has('hermes') ? 'hermes' : token
    }

    const bot = byForm.get(token)

    if (!bot) {
      continue
    }

    const key = botRosterKey(bot)

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    mentioned.push(bot)
  }

  return mentioned
}

function rosterSnapshotMatchesOwner(snapshot, owner) {
  return Boolean(
    snapshot &&
      owner &&
      snapshot.rosterOwner?.connectionId === owner.connectionId &&
      snapshot.rosterOwner?.profile === owner.profile
  )
}

function cachedRosterSnapshot(
  client = queryClient,
  connectionId = host.state.connectionId?.get?.(),
  profile = host.state.profile?.get?.()
) {
  if (!client || typeof client.getQueryData !== 'function') {
    return null
  }

  const owner = normalizeRosterOwner(connectionId, profile)

  if (owner) {
    const exact = client.getQueryData([...ROSTER_KEY, owner.connectionId, owner.profile])

    if (exact) {
      return exact
    }
  }

  const connectionScoped = client.getQueryData([...ROSTER_KEY, connectionId])
  const legacy = client.getQueryData(ROSTER_KEY)

  if (owner) {
    return rosterSnapshotMatchesOwner(connectionScoped, owner)
      ? connectionScoped
      : rosterSnapshotMatchesOwner(legacy, owner)
        ? legacy
        : null
  }

  return connectionScoped ?? legacy ?? null
}

function rosterMentionCompletionsFromCache(
  query,
  client = queryClient,
  connectionId = host.state.connectionId?.get?.(),
  active = {},
  metaByName = $botMeta.get()
) {
  const cached = cachedRosterSnapshot(client, connectionId, active?.name)
  const profiles = Array.isArray(cached?.profiles) ? cached.profiles : []

  if (!profiles.length) {
    return []
  }

  const needle = String(query || '').toLowerCase()
  const items = []

  for (const profile of profiles) {
    if (!profile?.name || isActiveRosterBot(profile, active)) {
      continue
    }

    const handle = botHandle(profile.name, profile)

    if (needle && !handle.toLowerCase().startsWith(needle)) {
      continue
    }

    const display = displayName(profile, botRosterMeta(profile, metaByName, cached?.rosterOwner))
    const source = profile.connectionLabel ? ` · ${profile.connectionLabel}` : ''

    items.push({
      insert: `@${handle}`,
      display: `@${handle}`,
      meta: `Agent · ${display}${source}`
    })
  }

  return items.slice(0, 8)
}

function rosterMentionsFromCache(
  text,
  active,
  client = queryClient,
  connectionId = host.state.connectionId?.get?.()
) {
  const cached = cachedRosterSnapshot(client, connectionId, active?.name)
  const profiles = Array.isArray(cached?.profiles) ? cached.profiles : null

  return profiles ? resolveRosterMentions(text, profiles, active) : null
}

const REMOTE_DM_TIMEOUT_MS = 180000
const REMOTE_DM_POLL_MS = 2000
const remoteCanonicalChats = new Map()

/** The remote bot's canonical Bot Chat: pinned stored-id from its profile's
 *  ui_meta first, then resume-by-title, then create. Mirrors
 *  ensureGroupChatSession so DMs land in the ONE forever-chat instead of
 *  minting a fresh "Bot Chat" per mention. */
function ensureRemoteCanonicalChat(route, profile, runtime = host) {
  const connectionId = String(route?.connectionId || '').trim()
  const targetProfile = String(profile || '').trim() || 'default'
  const key = connectionId ? `${connectionId}::${targetProfile}` : ''

  if (!key || typeof runtime?.requestProfile !== 'function') {
    return Promise.reject(
      new Error(agentSourceUnavailableMessage(agentText, targetProfile, connectionId))
    )
  }

  const inflight = remoteCanonicalChats.get(key)

  if (inflight) {
    return inflight
  }

  const task = (async () => {
    let pinned = null
    let ownerMeta = {}
    let metaAuthoritative = false

    try {
      const listed = await runtime.requestProfile(route, 'profiles.list', {})
      const owner = listed?.profiles?.find(value => value?.name === targetProfile)
      const server = owner?.ui_meta?.['hermes-bots']
      metaAuthoritative = Boolean(owner)
      ownerMeta = server && typeof server === 'object' ? server : {}
      pinned = ownerMeta.chat || null
    } catch {
      /* older remote gateway — title lookup below still works */
    }

    const pin = async stored => {
      if (!stored || stored === pinned || !metaAuthoritative) {
        return
      }

      try {
        await runtime.requestProfile(route, 'profiles.configure', {
          name: targetProfile,
          ui_meta: { 'hermes-bots': { ...ownerMeta, chat: stored } }
        })
        pinned = stored
        ownerMeta = { ...ownerMeta, chat: stored }
      } catch {
        // Older gateways may resume/create sessions but reject ui_meta.
        // Delivery remains available; title resume is the next-call fallback.
      }
    }

    for (const target of [pinned, 'Bot Chat']) {
      if (!target) {
        continue
      }

      try {
        const res = await runtime.requestProfile(route, 'session.resume', {
          session_id: target,
          profile: targetProfile,
          omit_messages: true
        })

        if (res?.session_id) {
          const stored = res.session_key || pinned || null
          await pin(stored)
          return { runtime: res.session_id, stored }
        }
      } catch {
        /* fall through */
      }
    }

    const created = await runtime.requestProfile(route, 'session.create', {
      profile: targetProfile,
      title: 'Bot Chat',
      // Bot Mode sessions are always hidden from the global sidebar.
      hidden: true
    })
    const stored = created?.stored_session_id || null
    await pin(stored)

    return { runtime: created?.session_id || null, stored }
  })().finally(() => remoteCanonicalChats.delete(key))

  remoteCanonicalChats.set(key, task)
  return task
}

/** Bounded reply poll on the recipient's session — same shape as a group
 *  member turn: wait for a NEW assistant message after `before`, or time out. */
async function pollRemoteDmReply(route, profile, sessionRef, before) {
  const deadline = Date.now() + REMOTE_DM_TIMEOUT_MS

  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, REMOTE_DM_POLL_MS))

    let state = null

    try {
      state = await host.requestProfile(route, 'session.resume', { session_id: sessionRef, profile })
    } catch {
      continue
    }

    const messages = Array.isArray(state?.messages) ? state.messages : []
    const done = !state?.inflight && !state?.running

    if (messages.length > before && done) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]

        if (msg?.role === 'assistant') {
          const text = typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content.map(p => (typeof p === 'string' ? p : p?.text || '')).join('')
              : msg?.text || ''

          return String(text).trim() || null
        }
      }

      return null
    }
  }

  return null
}

/** Deliver a user mention to bots on OTHER connections: into each bot's
 *  canonical Bot Chat, with the standard sender-attribution prefix (so the
 *  recipient's messaging protocol recognizes an agent-to-agent message), then
 *  relay the reply back as a notification. Sequential and fire-and-forget
 *  from the composer's perspective. */
async function deliverRemoteRosterMentions(bots, userText, sender) {
  const text = String(userText || '').trim()

  if (!text || typeof host.requestProfile !== 'function') {
    return
  }

  const senderName = String(sender?.name || 'the user').trim()
  const senderHandle = String(sender?.handle || senderName).trim()

  for (const bot of bots) {
    const connectionId = String(bot?.connectionId || '').trim()
    const profile = String(bot?.name || '').trim() || 'default'

    if (!connectionId || connectionId === 'local') {
      continue
    }

    const route = { connectionId, mode: 'remote', profile, targetProfile: profile }
    const label = bot.connectionLabel || connectionId

    try {
      const { runtime, stored } = await ensureRemoteCanonicalChat(route, profile)

      if (!runtime) {
        throw new Error(agentText('remote.noSession'))
      }

      // Baseline before our submit, so the poll can spot the NEW reply.
      let before = 0

      try {
        const pre = await host.requestProfile(route, 'session.resume', { session_id: stored || runtime, profile })
        before = Array.isArray(pre?.messages) ? pre.messages.length : pre?.message_count || 0
      } catch {
        /* lazy session — zero messages */
      }

      // The delivery prefix is the recipient's cue that an agent (not its
      // human) is talking — same contract as the local CLI handoff.
      await host.requestProfile(route, 'prompt.submit', {
        session_id: runtime,
        text: `Message from \u{1F916} ${senderName} (@${senderHandle}): ${text}`
      })
      host.notify?.({
        kind: 'info',
        title: displayName(bot),
        message: agentText('remote.messaged', botHandle(profile, bot))
      })

      const reply = await pollRemoteDmReply(route, profile, stored || runtime, before)

      if (reply) {
        host.notify?.({
          kind: 'info',
          title: `\u{1F916} ${displayName(bot)} (${label})`,
          message: reply.slice(0, 500)
        })
      } else {
        host.notify?.({
          kind: 'info',
          title: displayName(bot),
          message: agentText('remote.noReply', botHandle(profile, bot), label)
        })
      }
    } catch (error) {
      host.notifyError?.(error, agentText('remote.couldNotReach', label))
    }
  }
}

/** Source-qualified identity for a roster row — the React list key AND the
 *  cross-surface roster identity. Names alone are NOT unique in a
 *  multi-source roster (two connections can both expose 'default');
 *  duplicate keys make React reconciliation repeat whole blocks of the list
 *  on every poll repaint (the Aug 2026 dupe-bots smear). */
function botRosterKey(bot) {
  return `${bot?.connectionId || 'legacy'}::${bot?.name || 'default'}`
}

// ── cross-connection routing ─────────────────────────────────────────────────
// A bot from another registered connection (remoteSource rows) is reached
// through host.requestProfile with a route descriptor; local bots keep the
// active-gateway door. Feature-detected: older desktops without
// requestProfile simply have no remote routes (callers fall back / disable).

/** Route descriptor for a bot on another connection, or null for the local /
 *  active source (or when the desktop can't route). */
function botConnectionRoute(bot, runtime = host) {
  const id = String(bot?.connectionId || '').trim()

  if (!bot?.remoteSource || !id || typeof runtime?.requestProfile !== 'function') {
    return null
  }

  const profile = String(bot?.name || '').trim() || 'default'

  return { connectionId: id, mode: id === 'local' ? 'local' : 'remote', profile, targetProfile: profile }
}

/** Gateway RPC on the bot's OWN source: requestProfile for remote rows,
 *  the active gateway for local ones. Never activates/foregrounds. */
async function requestForBot(bot, method, params = {}, runtime = host) {
  const route = botConnectionRoute(bot, runtime)

  if (route) {
    return runtime.requestProfile(route, method, params)
  }

  // A durable remote member without a source id (legacy/corrupt room) is not
  // safe to replay through whichever gateway happens to be active. Fail
  // closed: same-named profiles commonly exist on several sources.
  if (bot?.remoteSource) {
    throw new Error(
      agentSourceUnavailableMessage(agentText, bot?.name, bot?.connectionLabel || bot?.connectionId)
    )
  }

  return runtime.request(method, params)
}

/** Stable per-member identity inside a group room. Local members keep their
 *  bare name (compat with rooms persisted before cross-connection groups);
 *  remote members get the source-qualified key so `dixie` on the Mini and a
 *  local `dixie` never share watermarks or sessions. */
function groupMemberKey(member) {
  return member?.remoteSource ? botRosterKey(member) : member?.name
}

// Row-level server metadata is source-qualified and therefore always safe.
// The legacy local cache is keyed by bare profile name, so it may only fill
// gaps for an explicitly local row while both the roster snapshot and cache
// belong to the exact same local owner. This prevents remote A's `researcher`
// from painting its title/pin/hidden/groups onto local or remote B.
function botRosterMeta(
  bot,
  metaByName,
  rosterOwner = null,
  metaOwner = null
) {
  const server = bot?.ui_meta?.['hermes-bots']
  const serverMeta = server && typeof server === 'object' && !Array.isArray(server) ? server : null

  // An unowned row may only use its own source-qualified server metadata.
  // Bare-name cache fallback requires an explicit local roster owner below.
  if (!rosterOwner) {
    return serverMeta
  }

  const owner = normalizeRosterOwner(rosterOwner?.connectionId, rosterOwner?.profile)
  const resolvedMetaOwner = metaOwner || $botMetaOwner.get()
  const cachedOwner = normalizeRosterOwner(resolvedMetaOwner?.connectionId, resolvedMetaOwner?.profile)
  const botSource = String(bot?.connectionId || '').trim()
  const explicitLocalRow = Boolean(
    !bot?.remoteSource &&
      owner?.connectionId === 'local' &&
      (!botSource || botSource === 'local') &&
      (!bot?.connectionKind || bot.connectionKind === 'local')
  )
  const localMeta =
    explicitLocalRow && sameRosterOwner(owner, cachedOwner) ? metaByName?.[bot?.name] || null : null

  if (serverMeta) {
    return localMeta ? { ...localMeta, ...serverMeta } : serverMeta
  }

  return localMeta
}

function showsHandle(name, meta, bot) {
  const display = displayName({ name }, meta)
  return Boolean(name && display.toLowerCase() !== botHandle(name, bot).toLowerCase())
}

// ── canonical bot chat ───────────────────────────────────────────────────────
// Each bot has ONE forever chat, pinned by stored-session id in bot meta
// (meta.chat — synced server-side via ui_meta, so it follows the profile).
// Opening a bot ALWAYS lands there: never "most recent session", which
// drifts whenever the profile is used from the CLI, Sessions mode, or a
// cronjob. The pin only changes through explicit adoption:
//   - grandfather: first open of a bot that already has history pins its
//     current latest session, so continuity starts from the chat in use
//   - fresh bot: opens a draft; when the first message persists a stored
//     session, we adopt that id (empty sessions are pruned server-side, so
//     pre-creating one at enable time is not possible)
//   - recovery: if the pinned id vanishes from the DB (compaction rewrote
//     the lineage), re-pin the newest session carrying the canonical title.

// In-flight creations are source-qualified: same-named profiles on A and B
// must never share a promise or session id.
const canonicalCreations = new Map()

function canonicalCreationKey(name, owner) {
  const normalized = normalizeRosterOwner(owner?.connectionId, owner?.profile)

  return normalized && name ? `${normalized.connectionId}::${normalized.profile}::${name}` : ''
}

/** Create the bot's ONE forever chat: a real session opened with a kickoff
 *  message (the gateway prunes zero-message sessions, so the chat is born
 *  with the bot introducing itself). Pins the stored id in bot meta and
 *  returns it. */
function createCanonicalChat(name, capturedOwner = null) {
  const owner = capturedOwner
    ? normalizeRosterOwner(capturedOwner?.connectionId, capturedOwner?.profile)
    : null

  if (!owner || !rosterOwnerStillActive(owner)) {
    return Promise.resolve(null)
  }

  const creationKey = canonicalCreationKey(name, owner)
  const inflight = canonicalCreations.get(creationKey)

  if (inflight) {
    return inflight
  }

  const run = (async () => {
    const res = await host.request('session.create', {
      profile: name,
      title: 'Bot Chat',
      // Always born hidden from the global sidebar — Bot Mode sessions are
      // plugin-owned. Core applies this via the generic `hidden` flag
      // (deferred as pending_hidden until the row exists); older gateways
      // ignore the unknown param and it stays visible.
      hidden: true
    })
    const sid = res?.stored_session_id
    const runtime = res?.session_id

    if (owner && !rosterOwnerStillActive(owner)) {
      return null
    }

    if (sid) {
      await saveBotMeta(name, { chat: sid }, null, owner)
    }

    // Mount the session view FIRST, then send the kickoff — submitting into
    // an unmounted session left the intro reply invisible until reopen.
    let opened = false

    if (sid && typeof host.openSession === 'function') {
      try {
        if (owner && !rosterOwnerStillActive(owner)) {
          return null
        }
        await host.openSession(sid, { profile: name })
        opened = true
      } catch {
        // The stored row may not exist until the kickoff persists it. Retry
        // after prompt.submit below instead of leaving the chat off-screen.
      }
    }

    if (runtime) {
      await new Promise(resolve => window.setTimeout(resolve, 400))

      if (owner && !rosterOwnerStillActive(owner)) {
        return null
      }

      try {
        await host.request('prompt.submit', { session_id: runtime, text: agentText('profile.intro') })

        if (owner && !rosterOwnerStillActive(owner)) {
          return null
        }

        if (!opened && sid && typeof host.openSession === 'function') {
          await host.openSession(sid, { profile: name })
        }
      } catch {
        // The chat already exists. Keep the pin so the next click
        // opens it instead of making a second Bot Chat.
      }
    }

    return sid || null
  })().finally(() => canonicalCreations.delete(creationKey))

  canonicalCreations.set(creationKey, run)

  return run
}

/** Open the bot's ONE forever chat and return the opened id (or the pin).
 *
 *  Identity rules (hermes-agent#88200 — the row must open the session its
 *  preview describes):
 *  - grandfather: no pin + existing history adopts the previewed session
 *    (`history`, the roster's last_session for this bot) instead of minting
 *    a new empty chat;
 *  - a live pin is verified through the backend's precise preferred_session
 *    resolver (hidden rows still resolve; compression lineages resolve to
 *    the live tip) — never inferred from a paginated, hidden-excluding
 *    session.list window, which misjudged real hidden pins as gone;
 *  - transient lookup failures keep the pin: try the stored id as-is, and
 *    only a rejected open enters recovery. */
async function openBotCanonicalChat(name, pinned, history, capturedOwner = null) {
  const owner = capturedOwner
    ? normalizeRosterOwner(capturedOwner?.connectionId, capturedOwner?.profile)
    : null

  if (!owner || !rosterOwnerStillActive(owner)) {
    return null
  }

  if (!pinned) {
    // Grandfather: adopt the conversation the row already previews.
    const adoptId = history?.id
    if (adoptId && typeof host.openSession === 'function') {
      try {
        await host.openSession(adoptId, { profile: name })
        if (owner && !rosterOwnerStillActive(owner)) {
          return null
        }
        await saveBotMeta(name, { chat: adoptId }, null, owner)
        return adoptId
      } catch {
        if (owner && !rosterOwnerStillActive(owner)) {
          return null
        }
        // Adoption raced a vanishing session — fall through to creation.
      }
    }
    return createCanonicalChat(name, owner)
  }

  // Precise verification. An older gateway ignores the unknown param and
  // omits the key — that reads as a lookup failure below, NOT as a missing
  // session, so legacy backends keep the try-as-is escape hatch.
  let preferred
  let lookupFailed = false
  try {
    const res = await host.request('profiles.list', {
      include_sessions: true,
      preferred_session_ids: { [name]: pinned }
    })
    const row = (res?.profiles ?? []).find(p => p.name === name)
    preferred = row?.preferred_session
    if (preferred === undefined) {
      lookupFailed = true
    }
  } catch {
    lookupFailed = true
  }

  if (owner && !rosterOwnerStillActive(owner)) {
    return null
  }

  if (lookupFailed) {
    // Transient gateway state (or an older backend): the pin is innocent
    // until proven guilty — try it as-is, and only a rejected open clears.
    try {
      await host.openSession(pinned, { profile: name })
      return !owner || rosterOwnerStillActive(owner) ? pinned : null
    } catch {
      if (owner && !rosterOwnerStillActive(owner)) {
        return null
      }
      await saveBotMeta(name, { chat: null }, null, owner)
      return createCanonicalChat(name, owner)
    }
  }

  if (preferred) {
    try {
      await host.openSession(preferred.resolved_id || preferred.id, { profile: name })
      return !owner || rosterOwnerStillActive(owner) ? pinned : null
    } catch (error) {
      if (owner && !rosterOwnerStillActive(owner)) {
        return null
      }
      // The precise lookup JUST confirmed this session exists, so a failed
      // open is transient (reconnect, backend restart). Clearing the pin or
      // minting a replacement here would fork the bot's forever-chat on
      // every hiccup — report and keep everything as it is.
      host.notifyError?.(error, agentText('profile.openChatFailed', name))
      return pinned
    }
  }

  // Definitively gone (db reset, or the lineage was rewritten past
  // recovery): re-anchor on the previewed session when there is one.
  const recoveryId = history?.id
  if (recoveryId && typeof host.openSession === 'function') {
    try {
      await host.openSession(recoveryId, { profile: name })
      if (owner && !rosterOwnerStillActive(owner)) {
        return null
      }
      await saveBotMeta(name, { chat: recoveryId }, null, owner)
      return recoveryId
    } catch {
      if (owner && !rosterOwnerStillActive(owner)) {
        return null
      }
      // Fall through to a fresh chat.
    }
  }
  await saveBotMeta(name, { chat: null }, null, owner)
  return createCanonicalChat(name, owner)
}

async function prepareBotSource(bot, pinnedChat) {
  if (!bot.sourceScoped) {
    return pinnedChat
  }

  if (typeof host.ensureAgent !== 'function') {
    throw new Error(agentText('remote.updateRequired'))
  }

  try {
    await host.ensureAgent(bot.connectionId, bot.name)
  } catch {
    throw new Error(
      agentSourceUnavailableMessage(agentText, bot.name, bot.connectionLabel || bot.connectionId)
    )
  }

  const liveId = String(typeof host.activeConnectionId === 'function' ? host.activeConnectionId() || '' : '').trim()
  const targetId = String(bot.connectionId || '').trim()

  // Older SDKs could resolve ensureAgent even when the requested registry
  // source never became active. Validate every explicit source, including
  // `local`: otherwise a failed local activation while remote B is active
  // lets the following name-only request mutate B's same-named profile.
  if (targetId && liveId !== targetId) {
    throw new Error(agentText('remote.stillOn', liveId || agentText('remote.sourceFallback'), bot.connectionLabel || targetId))
  }

  if (!bot.remoteSource) {
    return pinnedChat
  }

  // Thin rows deliberately omit metadata from the active source. Once their
  // owner is active, recover that source's canonical-chat pointer so
  // same-named agents never reuse or overwrite each other's pin.
  try {
    const refreshed = await host.request('profiles.list', {})
    const owner = refreshed?.profiles?.find(profile => profile.name === bot.name)

    return owner?.ui_meta?.['hermes-bots']?.chat || null
  } catch {
    // Metadata refresh is best-effort; canonical creation remains the fallback.
    return null
  }
}

function displayName(bot, meta) {
  // Only THIN rows from another source trade the friendly name for their
  // connection label — the active gateway's own default must keep reading
  // "Hermes". Annotated active rows carry sourceScoped too, and keying this
  // off sourceScoped renamed the user's main agent to an IP-derived label
  // (community report, Aug 17 2026).
  if (bot?.remoteSource && (bot.name || '').trim().toLowerCase() === 'default' && bot.connectionLabel) {
    return bot.connectionLabel
  }

  if (meta?.title?.trim()) {
    return meta.title.trim()
  }

  // The primary profile is literally named "default" — as a bot identity
  // that reads like nobody bothered. Present it as Hermes (the agent it is)
  // unless the user gives it a real title.
  if ((bot.name || '').trim().toLowerCase() === 'default' && !bot.title) {
    return 'Hermes'
  }

  const raw = (bot.title || bot.name || '').replace(/[-_]+/g, ' ').trim()
  return raw.replace(/\b\w/g, ch => ch.toUpperCase())
}

/** Filter by the two stable identities rendered in every roster row: the
 * customizable display name and the profile's @handle. Keep the current
 * activity order — search narrows the roster, it never re-ranks it. */
function filterBots(roster, metaByName, query, rosterOwner = null) {
  const needle = query.trim().toLowerCase().replace(/^@/, '')

  if (!needle) {
    return roster
  }

  return roster.filter(bot => {
    const display = displayName(bot, botRosterMeta(bot, metaByName, rosterOwner)).toLowerCase()
    const profile = (bot.name || '').toLowerCase()
    const handle = botHandle(bot.name, bot).toLowerCase()
    // Multi-source rows also match on their device name ("homelab" finds
    // every bot living on the Homelab connection).
    const sourceLabel = (bot.connectionLabel || '').toLowerCase()
    return (
      display.includes(needle) || profile.includes(needle) || handle.includes(needle) || sourceLabel.includes(needle)
    )
  })
}

function emptyCollaborationMemberships(schemaVersion = COLLABORATION_SCHEMA) {
  return { schemaVersion, projects: {}, sessions: {} }
}

function hasFutureCollaborationSchema(value) {
  const version = Number(value?.schemaVersion)

  return Number.isInteger(version) && version > COLLABORATION_SCHEMA
}

function normalizeCollaborationMember(value) {
  const profile = String(value?.profile || '').trim()
  const connectionId = String(value?.connectionId || '').trim()

  if (!profile || !NAME_RE.test(profile) || !connectionId) {
    return null
  }

  return {
    connectionId,
    profile,
    invitedAt: Number.isFinite(value?.invitedAt) ? value.invitedAt : 0,
    role: String(value?.role || 'collaborator').trim() || 'collaborator'
  }
}

function collaborationMemberKey(value) {
  const member = normalizeCollaborationMember(value)

  return member ? `${member.connectionId}::${member.profile}` : ''
}

function normalizeCollaborationMemberships(value) {
  const requestedVersion = Number(value?.schemaVersion)
  const schemaVersion =
    Number.isInteger(requestedVersion) && requestedVersion >= COLLABORATION_SCHEMA
      ? requestedVersion
      : COLLABORATION_SCHEMA
  const future = hasFutureCollaborationSchema(value)
  // A future writer may add root/member fields this build does not
  // understand. Preserve them losslessly while sanitising the known buckets,
  // then make every mutation below fail closed for that schema.
  const normalized = future && value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value, schemaVersion, projects: {}, sessions: {} }
    : emptyCollaborationMemberships(schemaVersion)

  for (const scope of ['projects', 'sessions']) {
    const records = value?.[scope]

    if (!records || typeof records !== 'object' || Array.isArray(records)) {
      continue
    }

    for (const [key, members] of Object.entries(records)) {
      if (!key || !Array.isArray(members)) {
        continue
      }

      const seen = new Set()
      const clean = []

      for (const value of members) {
        const member = normalizeCollaborationMember(value)
        const identity = collaborationMemberKey(member)

        if (!member || !identity || seen.has(identity)) {
          continue
        }

        seen.add(identity)
        clean.push(future && value && typeof value === 'object' ? { ...value, ...member } : member)
      }

      if (clean.length) {
        normalized[scope][key] = clean
      }
    }
  }

  return normalized
}

function mergeCollaborationMemberships(storedValue, liveValue) {
  const stored = normalizeCollaborationMemberships(storedValue)
  const live = normalizeCollaborationMemberships(liveValue)

  // Unknown future semantics are authoritative and immutable to this build.
  if (hasFutureCollaborationSchema(stored)) {
    return stored
  }
  if (hasFutureCollaborationSchema(live)) {
    return live
  }

  const merged = emptyCollaborationMemberships(Math.max(stored.schemaVersion, live.schemaVersion))

  for (const scope of ['projects', 'sessions']) {
    for (const key of new Set([...Object.keys(stored[scope]), ...Object.keys(live[scope])])) {
      const members = new Map()

      for (const member of [...(stored[scope][key] || []), ...(live[scope][key] || [])]) {
        members.set(collaborationMemberKey(member), member)
      }

      if (members.size) {
        merged[scope][key] = [...members.values()]
      }
    }
  }

  return normalizeCollaborationMemberships(merged)
}

function collaborationSourceId() {
  return String(host.state.connectionId?.get?.() || host.activeConnectionId?.() || 'local').trim() || 'local'
}

function normalizeProjectPath(path) {
  return String(path || '').trim().replace(/\\/g, '/').replace(/\/+$/, '')
}

function collaborationProjectBindingKeyForSession(surface, sessionId) {
  const source = String(surface?.leadConnectionId || '').trim()
  const profile = String(surface?.leadProfile || '').trim()
  const session = String(sessionId || '').trim()

  if (!source || !profile || !NAME_RE.test(profile) || !session) {
    return ''
  }

  return JSON.stringify([source, profile, session])
}

function collaborationProjectBindingKey(surface) {
  return collaborationProjectBindingKeyForSession(surface, surface?.storedSessionId)
}

function collaborationProjectBindingKeys(
  surface,
  sessionBindings = $collaborationSessionBindings.get()
) {
  return [
    collaborationProjectBindingKeyForSession(surface, surface?.storedSessionId),
    collaborationProjectBindingKeyForSession(surface, surface?.runtimeSessionId),
    ...collaborationBoundSessionIds(sessionBindings, surface)
      .map(value => collaborationProjectBindingKeyForSession(surface, value))
  ].filter((key, index, keys) => key && keys.indexOf(key) === index)
}

function normalizeCollaborationProjectBindings(value) {
  const normalized = {}

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return normalized
  }

  for (const [key, projectValue] of Object.entries(value)) {
    let identity

    try {
      identity = JSON.parse(key)
    } catch {
      continue
    }

    const project = normalizeProjectPath(projectValue)

    if (
      !Array.isArray(identity) ||
      identity.length !== 3 ||
      identity.some(part => typeof part !== 'string' || !part.trim()) ||
      !NAME_RE.test(identity[1]) ||
      !project
    ) {
      continue
    }

    normalized[JSON.stringify(identity.map(part => part.trim()))] = project
  }

  return normalized
}

function updateCollaborationProjectBinding(
  bindings,
  surface,
  sessionBindings = $collaborationSessionBindings.get()
) {
  const current = normalizeCollaborationProjectBindings(bindings)
  const keys = collaborationProjectBindingKeys(surface, sessionBindings)
  const project = normalizeProjectPath(surface?.projectKey)

  if (!keys.length) {
    return { bindings: current, changed: false }
  }

  if (!project) {
    if (surface?.projectResolutionKnown !== true) {
      const remembered = keys.map(key => current[key]).find(Boolean)

      if (!remembered || keys.every(key => current[key] === remembered)) {
        return { bindings: current, changed: false }
      }

      const next = { ...current }
      for (const key of keys) {
        next[key] = remembered
      }

      return { bindings: next, changed: true }
    }

    if (!keys.some(key => current[key])) {
      return { bindings: current, changed: false }
    }

    const next = { ...current }
    for (const key of keys) {
      delete next[key]
    }

    return { bindings: next, changed: true }
  }

  if (keys.every(key => current[key] === project)) {
    return { bindings: current, changed: false }
  }

  const next = { ...current }
  for (const key of keys) {
    next[key] = project
  }

  return { bindings: next, changed: true }
}

function resolveCollaborationSurface(
  surface,
  bindings,
  sessionBindings = $collaborationSessionBindings.get()
) {
  const exactProject = normalizeProjectPath(surface?.projectKey)
  const keys = collaborationProjectBindingKeys(surface, sessionBindings)
  const normalizedBindings = normalizeCollaborationProjectBindings(bindings)
  const boundProject =
    surface?.projectResolutionKnown === true || !keys.length
      ? ''
      : keys.map(key => normalizedBindings[key]).find(Boolean) || ''
  const projectKey = exactProject || boundProject

  return projectKey === String(surface?.projectKey || '') ? surface : { ...surface, projectKey }
}

function saveCollaborationProjectBindings(next) {
  const normalized = normalizeCollaborationProjectBindings(next)
  $collaborationProjectBindings.set(normalized)

  try {
    pluginCtx?.storage?.set?.(COLLABORATION_PROJECT_BINDINGS_KEY, normalized)
  } catch {
    /* persistence unavailable — the exact foreground surface still works */
  }

  return normalized
}

function rememberCollaborationProject(surface, options = {}) {
  const current = options.bindings || $collaborationProjectBindings.get()
  const result = updateCollaborationProjectBinding(
    current,
    surface,
    options.sessionBindings || $collaborationSessionBindings.get()
  )

  if (!result.changed) {
    return false
  }

  const save = typeof options.save === 'function' ? options.save : saveCollaborationProjectBindings
  save(result.bindings)

  return true
}

function collaborationSessionBindingKey(surface) {
  const source = String(surface?.leadConnectionId || '').trim()
  const profile = String(surface?.leadProfile || '').trim()
  const runtime = String(surface?.runtimeSessionId || '').trim()

  return source && profile && NAME_RE.test(profile) && runtime
    ? JSON.stringify([source, profile, runtime])
    : ''
}

function normalizeCollaborationSessionBindings(value) {
  const normalized = {}

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return normalized
  }

  for (const [key, storedValue] of Object.entries(value)) {
    let identity

    try {
      identity = JSON.parse(key)
    } catch {
      continue
    }

    const storedIds = [...new Set((Array.isArray(storedValue) ? storedValue : [storedValue])
      .map(item => String(item || '').trim())
      .filter(Boolean))].slice(0, 8)

    if (
      !Array.isArray(identity) ||
      identity.length !== 3 ||
      identity.some(part => typeof part !== 'string' || !part.trim()) ||
      !NAME_RE.test(identity[1]) ||
      !storedIds.length
    ) {
      continue
    }

    normalized[JSON.stringify(identity.map(part => part.trim()))] = storedIds
  }

  return normalized
}

function mergeCollaborationSessionBindings(storedValue, liveValue) {
  const stored = normalizeCollaborationSessionBindings(storedValue)
  const live = normalizeCollaborationSessionBindings(liveValue)
  const merged = { ...stored }

  for (const [key, liveIds] of Object.entries(live)) {
    merged[key] = [...new Set([...liveIds, ...(stored[key] || [])])].slice(0, 8)
  }

  return merged
}

function collaborationBoundSessionIds(bindings, surface) {
  const key = collaborationSessionBindingKey(surface)

  return key ? normalizeCollaborationSessionBindings(bindings)[key] || [] : []
}

function updateCollaborationSessionBinding(bindings, surface) {
  const current = normalizeCollaborationSessionBindings(bindings)
  const key = collaborationSessionBindingKey(surface)
  const stored = String(surface?.storedSessionId || '').trim()
  const prior = key ? current[key] || [] : []

  if (!key || !stored || prior[0] === stored) {
    return { bindings: current, changed: false }
  }

  return {
    bindings: { ...current, [key]: [stored, ...prior.filter(value => value !== stored)].slice(0, 8) },
    changed: true
  }
}

function saveCollaborationSessionBindings(next) {
  const normalized = normalizeCollaborationSessionBindings(next)
  $collaborationSessionBindings.set(normalized)

  try {
    pluginCtx?.storage?.set?.(COLLABORATION_SESSION_BINDINGS_KEY, normalized)
  } catch {
    /* persistence unavailable — the live runtime bridge still works */
  }

  return normalized
}

function rememberCollaborationSession(surface, options = {}) {
  const current = options.bindings || $collaborationSessionBindings.get()
  const result = updateCollaborationSessionBinding(current, surface)

  if (!result.changed) {
    return false
  }

  const save = typeof options.save === 'function' ? options.save : saveCollaborationSessionBindings
  save(result.bindings)

  return true
}

function collaborationScopeKey(scope, surface, sourceId = surface?.leadConnectionId) {
  const leadSource = String(surface?.leadConnectionId || '').trim()
  const source = String(sourceId || '').trim()
  const lead = String(surface?.leadProfile || 'default').trim() || 'default'

  // Persistence is source-qualified. During cold/draft surfaces the lead may
  // not have a connection identity yet; borrowing the globally active source
  // would silently attach membership to a different conversation.
  if (!leadSource || !source || source !== leadSource) {
    return ''
  }

  if (scope === 'session') {
    const id = String(surface?.storedSessionId || surface?.runtimeSessionId || '').trim()

    return id ? `session:${source}:${lead}:${id}` : ''
  }

  const project = normalizeProjectPath(surface?.projectKey)

  return project ? `project:${source}:${lead}:${project}` : ''
}

function collaborationStoredSessionScopeKey(surface, storedSessionId, sourceId = surface?.leadConnectionId) {
  const leadSource = String(surface?.leadConnectionId || '').trim()
  const source = String(sourceId || '').trim()
  const lead = String(surface?.leadProfile || 'default').trim() || 'default'
  const stored = String(storedSessionId || '').trim()

  return leadSource && source === leadSource && stored
    ? `session:${source}:${lead}:${stored}`
    : ''
}

function collaborationRuntimeSessionScopeKey(surface, sourceId = surface?.leadConnectionId) {
  const leadSource = String(surface?.leadConnectionId || '').trim()
  const source = String(sourceId || '').trim()
  const lead = String(surface?.leadProfile || 'default').trim() || 'default'
  const runtimeId = String(surface?.runtimeSessionId || '').trim()

  return leadSource && source === leadSource && runtimeId
    ? `session:${source}:${lead}:${runtimeId}`
    : ''
}

function legacyCollaborationProjectScopeKey(surface, sourceId = surface?.leadConnectionId) {
  const leadSource = String(surface?.leadConnectionId || '').trim()
  const source = String(sourceId || '').trim()
  const project = normalizeProjectPath(surface?.projectKey)

  return leadSource && source === leadSource && project ? `project:${source}:${project}` : ''
}

function collaborationScopeAvailability(surface) {
  const sourceId = String(surface?.leadConnectionId || '').trim()

  return {
    sourceAvailable: Boolean(sourceId),
    sourceId,
    session: Boolean(collaborationScopeKey('session', surface, sourceId)),
    project: Boolean(collaborationScopeKey('project', surface, sourceId))
  }
}

function collaborationScopeMessageKey(scope, availability) {
  if (!availability?.sourceAvailable) {
    return 'session.unavailable'
  }

  if (availability?.[scope]) {
    return ''
  }

  return scope === 'session' ? 'session.sessionUnavailable' : 'session.projectUnavailable'
}

function collaborationMemberForBot(bot, rosterOwner = null) {
  const profile = String(bot?.name || bot?.profile || '').trim()
  const explicitConnectionId = String(bot?.connectionId || '').trim()
  const connectionId =
    explicitConnectionId || (!bot?.remoteSource ? String(rosterOwner?.connectionId || '').trim() : '')

  // A remote Agent without a source identity cannot be persisted safely:
  // normalizing a blank source to `local` would collide with a local profile
  // of the same name and make scoped removal target the wrong participant.
  if (!profile || !connectionId) {
    return null
  }

  return normalizeCollaborationMember({
    connectionId,
    profile,
    invitedAt: Date.now(),
    role: 'collaborator'
  })
}

function collaborationMembersForSurface(
  store,
  surface,
  sourceId = surface?.leadConnectionId,
  sessionBindings = $collaborationSessionBindings.get()
) {
  const normalized = normalizeCollaborationMemberships(store)
  const merged = new Map()

  for (const scope of ['project', 'session']) {
    for (const member of collaborationMembersInScope(normalized, surface, scope, sourceId, sessionBindings)) {
      const identity = collaborationMemberKey(member)
      const current = merged.get(identity)

      merged.set(identity, {
        ...member,
        scopes: current ? [...current.scopes, scope] : [scope]
      })
    }
  }

  const leadIdentity = collaborationMemberKey({
    connectionId: surface?.leadConnectionId,
    profile: surface?.leadProfile
  })

  // A project can retain membership written while another profile led the
  // session. Keep that durable record for those sessions, but never render
  // the current lead a second time as its own collaborator.
  return [...merged.values()].filter(member => collaborationMemberKey(member) !== leadIdentity)
}

function collaborationMembersInScope(
  store,
  surface,
  scope,
  sourceId = surface?.leadConnectionId,
  sessionBindings = $collaborationSessionBindings.get()
) {
  const normalized = normalizeCollaborationMemberships(store)
  const bucket = scope === 'project' ? 'projects' : 'sessions'
  const key = collaborationScopeKey(scope, surface, sourceId)

  if (!key) {
    return []
  }

  const values = [...(normalized[bucket][key] || [])]

  // A fresh chat has only a runtime id. Once persistence assigns its durable
  // id, read both identities until the additive migration below is saved so
  // an invite never disappears for a render or after a reload retry.
  if (scope === 'session') {
    const runtimeKey = collaborationRuntimeSessionScopeKey(surface, sourceId)

    if (runtimeKey && runtimeKey !== key) {
      values.push(...(normalized.sessions[runtimeKey] || []))
    }

    for (const priorStored of collaborationBoundSessionIds(sessionBindings, surface)) {
      const priorKey = collaborationStoredSessionScopeKey(surface, priorStored, sourceId)

      if (priorKey && priorKey !== key && priorKey !== runtimeKey) {
        values.push(...(normalized.sessions[priorKey] || []))
      }
    }
  }

  // v31 previews briefly wrote project:<source>:<project>. Adopt that
  // unqualified bucket only on an authoritative foreground resolution; an
  // unknown/background surface must never guess which lead profile owned it.
  if (scope === 'project' && surface?.projectResolutionKnown === true) {
    const legacyKey = legacyCollaborationProjectScopeKey(surface, sourceId)

    if (legacyKey && legacyKey !== key) {
      values.push(...(normalized.projects[legacyKey] || []))
    }
  }

  const unique = new Map()

  for (const value of values) {
    unique.set(collaborationMemberKey(value), value)
  }

  return [...unique.values()]
}

function migrateRuntimeCollaborationSessionScope(
  store,
  surface,
  sourceId = surface?.leadConnectionId,
  sessionBindings = $collaborationSessionBindings.get()
) {
  const current = normalizeCollaborationMemberships(store)

  if (hasFutureCollaborationSchema(current)) {
    return { changed: false, store: current }
  }

  const durableKey = collaborationScopeKey('session', surface, sourceId)
  const runtimeKey = collaborationRuntimeSessionScopeKey(surface, sourceId)
  const storedId = String(surface?.storedSessionId || '').trim()
  const previousKeys = collaborationBoundSessionIds(sessionBindings, surface)
    .map(value => collaborationStoredSessionScopeKey(surface, value, sourceId))
  const sourceKeys = [...new Set([runtimeKey, ...previousKeys].filter(key => key && key !== durableKey))]
  const sourceMembers = sourceKeys.flatMap(key => current.sessions[key] || [])

  if (!storedId || !durableKey || !sourceMembers.length) {
    return { changed: false, store: current }
  }

  const combined = new Map()

  for (const value of [...sourceMembers, ...(current.sessions[durableKey] || [])]) {
    combined.set(collaborationMemberKey(value), value)
  }

  const sessions = { ...current.sessions, [durableKey]: [...combined.values()] }
  for (const key of sourceKeys) {
    delete sessions[key]
  }

  return {
    changed: true,
    store: normalizeCollaborationMemberships({ ...current, sessions })
  }
}

function migrateLegacyCollaborationProjectScope(store, surface, sourceId = surface?.leadConnectionId) {
  const current = normalizeCollaborationMemberships(store)

  if (hasFutureCollaborationSchema(current) || surface?.projectResolutionKnown !== true) {
    return { changed: false, store: current }
  }

  const key = collaborationScopeKey('project', surface, sourceId)
  const legacyKey = legacyCollaborationProjectScopeKey(surface, sourceId)
  const legacyMembers = legacyKey && legacyKey !== key ? current.projects[legacyKey] || [] : []

  if (!key || !legacyMembers.length) {
    return { changed: false, store: current }
  }

  const combined = new Map()

  for (const value of [...legacyMembers, ...(current.projects[key] || [])]) {
    combined.set(collaborationMemberKey(value), value)
  }

  const projects = { ...current.projects, [key]: [...combined.values()] }
  delete projects[legacyKey]

  return {
    changed: true,
    store: normalizeCollaborationMemberships({ ...current, projects })
  }
}

function saveCollaborationMemberships(next) {
  const normalized = normalizeCollaborationMemberships(next)
  $collaborationMemberships.set(normalized)

  if (hasFutureCollaborationSchema(normalized)) {
    return normalized
  }

  try {
    pluginCtx?.storage?.set?.(COLLABORATION_KEY, normalized)
  } catch {
    /* persistence unavailable — keep this window's additive state */
  }

  return normalized
}

function updateCollaborationMembership(
  store,
  surface,
  scope,
  member,
  present,
  sourceId,
  sessionBindings = $collaborationSessionBindings.get()
) {
  if (hasFutureCollaborationSchema(store)) {
    return { changed: false, store: normalizeCollaborationMemberships(store) }
  }

  const scopeKey = collaborationScopeKey(scope, surface, sourceId)
  const normalizedMember = normalizeCollaborationMember(member)
  const leadIdentity = collaborationMemberKey({
    connectionId: surface?.leadConnectionId || sourceId || 'local',
    profile: surface?.leadProfile || 'default'
  })

  if (!scopeKey || !normalizedMember || collaborationMemberKey(normalizedMember) === leadIdentity) {
    return { changed: false, store: normalizeCollaborationMemberships(store) }
  }

  const bucket = scope === 'project' ? 'projects' : 'sessions'
  const migration =
    scope === 'project'
      ? migrateLegacyCollaborationProjectScope(store, surface, sourceId)
      : migrateRuntimeCollaborationSessionScope(store, surface, sourceId, sessionBindings)
  const current = migration.store
  const nextScope = { ...current[bucket] }
  const members = [...(nextScope[scopeKey] || [])]
  const migrated = migration.changed

  const identity = collaborationMemberKey(normalizedMember)
  const exists = members.some(value => collaborationMemberKey(value) === identity)

  if (present === exists && !migrated) {
    return { changed: false, store: current }
  }

  const nextMembers = present
    ? [...members, normalizedMember]
    : members.filter(value => collaborationMemberKey(value) !== identity)
  if (nextMembers.length) {
    nextScope[scopeKey] = nextMembers
  } else {
    delete nextScope[scopeKey]
  }

  return {
    changed: true,
    store: normalizeCollaborationMemberships({ ...current, [bucket]: nextScope })
  }
}

function setCollaborationMember(surface, scope, bot, present, options = {}) {
  const sourceId = String(surface?.leadConnectionId || '').trim()

  if (!sourceId) {
    return false
  }

  const member = collaborationMemberForBot(bot, options.rosterOwner)
  const result = updateCollaborationMembership(
    options.store || $collaborationMemberships.get(),
    surface,
    scope,
    member,
    present,
    sourceId,
    options.sessionBindings || $collaborationSessionBindings.get()
  )

  if (!result.changed) {
    return false
  }

  const save = typeof options.save === 'function' ? options.save : saveCollaborationMemberships
  save(result.store)

  return true
}

const AGENT_DESCRIPTION_CACHE_TTL = 5 * 60 * 1000
const AGENT_DESCRIPTION_CONCURRENCY = 4
const agentDescriptionCache = new Map()
const agentDescriptionPending = new Map()

function agentDescriptionKey(value) {
  return `${String(value?.connectionId || 'local').trim() || 'local'}::${String(value?.name || value?.profile || 'default').trim() || 'default'}`
}

function uniqueAgentTerms(values) {
  const seen = new Set()
  const result = []

  for (const value of values) {
    const text = String(value || '').trim()
    const key = text.toLowerCase()

    if (text && !seen.has(key)) {
      seen.add(key)
      result.push(text)
    }
  }

  return result
}

function enabledAgentCapabilities(values) {
  return Array.isArray(values)
    ? values.filter(value => typeof value === 'string' || (value && value.enabled === true))
    : []
}

function normalizeAgentDescription(bot, detail) {
  const rawModel = detail?.model
  const model =
    (typeof rawModel === 'string' ? rawModel : rawModel?.default) ||
    (typeof bot?.model === 'string' ? bot.model : bot?.model?.default) ||
    ''
  const provider =
    (typeof rawModel === 'object' ? rawModel?.provider : detail?.provider) ||
    bot?.provider ||
    ''
  const skills = enabledAgentCapabilities(detail?.skills)
  const toolsets = enabledAgentCapabilities(detail?.toolsets)
  const mcpServers = enabledAgentCapabilities(detail?.mcp_servers)
  const skillNames = skills.map(value => (typeof value === 'string' ? value : value?.name || value?.id))
  const toolsetNames = toolsets.map(value =>
    typeof value === 'string' ? value : value?.label || value?.name || value?.id
  )
  const toolsetSearchTerms = toolsets.flatMap(value =>
    typeof value === 'string' ? [value] : [value?.name, value?.label]
  )
  const mcpNames = mcpServers.map(value => (typeof value === 'string' ? value : value?.name || value?.id))
  const capabilities = uniqueAgentTerms([...skillNames, ...toolsetNames, ...mcpNames])
  const capabilitySearch = uniqueAgentTerms([
    ...skillNames,
    ...toolsetSearchTerms,
    ...mcpNames
  ])

  return {
    role: String(detail?.role || bot?.role || '').trim(),
    description: String(detail?.description || bot?.description || '').trim(),
    model: String(model || '').trim(),
    provider: String(provider || '').trim(),
    capabilities,
    capabilitySearch,
    skills: uniqueAgentTerms(skillNames),
    toolsets: uniqueAgentTerms(toolsetNames),
    mcp_servers: uniqueAgentTerms(mcpNames),
    capabilitiesHydrated: true
  }
}

function cachedAgentDescription(cache, key, now) {
  const entry = cache.get(key)

  if (!entry || entry.expiresAt <= now) {
    if (entry) {
      cache.delete(key)
    }

    return null
  }

  return entry.value
}

function mergeAgentDescriptions(roster, cache = agentDescriptionCache, now = Date.now()) {
  return roster.map(bot => {
    const detail = cachedAgentDescription(cache, agentDescriptionKey(bot), now)

    return detail ? { ...bot, ...detail } : bot
  })
}

function invalidateAgentDescription(name, connectionId = collaborationSourceId()) {
  agentDescriptionCache.delete(agentDescriptionKey({ connectionId, name }))
}

async function hydrateAgentDescriptions(roster, activeConnectionId, runtime = host, options = {}) {
  const cache = options.cache || agentDescriptionCache
  const pending = options.pending || agentDescriptionPending
  const now = typeof options.now === 'function' ? options.now : Date.now
  const concurrency = Math.max(1, Number(options.concurrency) || AGENT_DESCRIPTION_CONCURRENCY)
  const ttl = Math.max(1, Number(options.ttl) || AGENT_DESCRIPTION_CACHE_TTL)
  const descriptions = new Map()
  const targets = []
  const activeId = String(activeConnectionId || '').trim()

  for (const bot of roster) {
    if (!bot?.name) {
      continue
    }

    const key = agentDescriptionKey(bot)
    const cached = cachedAgentDescription(cache, key, now())

    if (cached) {
      descriptions.set(key, cached)
    } else {
      targets.push(bot)
    }
  }

  let routes = []

  if (targets.some(bot => bot.remoteSource) && typeof runtime.profileRoutes === 'function') {
    try {
      routes = await runtime.profileRoutes()
    } catch {
      routes = []
    }
  }

  const routeByKey = new Map(
    (Array.isArray(routes) ? routes : []).map(route => [agentDescriptionKey(route), route])
  )
  const outcomes = []

  for (let index = 0; index < targets.length; index += concurrency) {
    const batch = targets.slice(index, index + concurrency)
    const settled = await Promise.allSettled(
      batch.map(async bot => {
        const key = agentDescriptionKey(bot)
        let request = pending.get(key)

        if (!request) {
          request = (async () => {
            const botConnectionId = String(bot.connectionId || '').trim()
            const usesActiveSource =
              bot.remoteSource === false ||
              (bot.remoteSource !== true && (!activeId || !botConnectionId || botConnectionId === activeId))
            let detail

            if (usesActiveSource) {
              detail = await runtime.request('profiles.describe', { name: bot.name })
            } else {
              const route = routeByKey.get(key)

              if (!route || typeof runtime.requestProfile !== 'function') {
                throw new Error(`No profile route for ${key}`)
              }

              detail = await runtime.requestProfile(route, 'profiles.describe', {
                name: String(route.targetProfile || bot.name).trim() || bot.name
              })
            }

            const value = normalizeAgentDescription(bot, detail)
            cache.set(key, { expiresAt: now() + ttl, value })

            return value
          })().finally(() => pending.delete(key))
          pending.set(key, request)
        }

        const value = await request
        descriptions.set(key, value)

        try {
          options.onUpdate?.(key, value)
        } catch {
          /* a rendering callback cannot fail capability hydration */
        }

        return { key, value }
      })
    )

    outcomes.push(...settled)
  }

  return { descriptions, outcomes }
}

function agentRoleText(bot) {
  return String(bot?.role || '').trim()
}

function agentDescriptionText(bot, meta) {
  return uniqueAgentTerms([meta?.description, bot?.description]).join(' · ')
}

function agentModelText(bot) {
  return uniqueAgentTerms([bot?.provider, typeof bot?.model === 'string' ? bot.model : bot?.model?.default]).join(' · ')
}

function agentCapabilityText(bot, _meta, copy = agentText) {
  const list = []
  const add = value => {
    if (typeof value === 'string' && value.trim()) {
      list.push(value.trim())
    }
  }
  const addMany = values => {
    if (Array.isArray(values)) {
      values
        .filter(value => typeof value === 'string' || value?.enabled === true)
        .forEach(value => add(typeof value === 'string' ? value : value?.label || value?.name || value?.id))
    }
  }

  addMany(bot?.capabilities)
  if (!bot?.capabilitiesHydrated) {
    addMany(bot?.skills)
    addMany(bot?.toolsets)
    addMany(bot?.tools)
    addMany(bot?.mcp_servers)
  }

  if (!list.length && Number(bot?.skill_count) > 0) {
    add(copy('session.skills', bot.skill_count))
  }

  return [...new Set(list)].join(' · ')
}

function filterAgentCandidates(roster, metaByName, query, copy = agentText, rosterOwner = null) {
  const needle = String(query || '').trim().toLowerCase()

  if (!needle) {
    return roster
  }

  return roster.filter(bot => {
    const meta = botRosterMeta(bot, metaByName, rosterOwner)
    const haystack = [
      bot?.name,
      botHandle(bot?.name, bot),
      displayName(bot, meta),
      bot?.role,
      meta?.description,
      bot?.description,
      bot?.provider,
      typeof bot?.model === 'string' ? bot.model : bot?.model?.default,
      bot?.connectionLabel,
      ...(Array.isArray(bot?.capabilitySearch) ? bot.capabilitySearch : []),
      agentCapabilityText(bot, meta, copy)
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(needle)
  })
}

function agentSourcePresentation(bot, roster) {
  const profile = String(bot?.name || bot?.profile || '').trim().toLowerCase()
  const connectionId = String(bot?.connectionId || '').trim()
  const sourceIds = new Set(
    roster
      .filter(value => String(value?.name || value?.profile || '').trim().toLowerCase() === profile)
      .map(value => String(value?.connectionId || '').trim())
      .filter(Boolean)
  )
  const visible = Boolean(bot?.remoteSource) || sourceIds.size > 1

  if (!visible) {
    return { accessible: '', handle: '', source: '', visible: false }
  }

  const handle = `@${botHandle(bot?.name || bot?.profile, bot)}`
  const source = String(bot?.connectionLabel || connectionId).trim()

  return {
    accessible: uniqueAgentTerms([handle, source]).join(' · '),
    handle,
    source,
    visible: true
  }
}

function agentAccessibleLabel(bot, roster, meta) {
  const source = agentSourcePresentation(bot, roster)

  return uniqueAgentTerms([displayName(bot, meta), source.accessible]).join(' · ')
}

function rosterBotForMember(roster, member, rosterOwner = null) {
  const exact = roster.find(
    bot =>
      collaborationMemberKey(collaborationMemberForBot(bot, rosterOwner)) ===
      collaborationMemberKey(member)
  )

  if (exact) {
    return exact
  }

  if (member.connectionId === 'local' && rosterOwner?.connectionId === 'local') {
    return (
      roster.find(
        bot =>
          !bot.remoteSource &&
          (!bot.connectionId || bot.connectionId === 'local') &&
          bot.name === member.profile
      ) || null
    )
  }

  return null
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

/** Flatten markdown syntax out of a one-line roster preview so rows read
 *  like Discord's — no raw **bold**, `code`, > quotes, or [link](url)
 *  characters in the preview line. */
function stripPreviewMarkdown(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`\n]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|\s)[*_](\S(?:.*?\S)?)[*_](?=\s|$|[.,;:!?])/g, '$1$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Canonical multi-group read with legacy scalar compatibility. Profiles that
 *  predate `groups` still fall back to `group`; once the canonical array exists,
 *  it is authoritative. Writes keep `group` as a first-membership projection so
 *  older desktops can still display one room without corrupting the array. */
function botGroups(meta) {
  const groups = []
  const seen = new Set()
  const values = Array.isArray(meta?.groups) ? meta.groups : [meta?.group]

  for (const value of values) {
    if (typeof value !== 'string') {
      continue
    }

    const group = value.trim()

    if (group && !seen.has(group)) {
      seen.add(group)
      groups.push(group)
    }
  }

  return groups
}

function groupMembershipPatch(meta, group, enabled) {
  const name = String(group || '').trim()
  let groups = botGroups(meta)

  if (enabled) {
    if (name && !groups.includes(name)) {
      groups = [...groups, name]
    }
  } else {
    groups = groups.filter(existing => existing !== name)
  }

  return { groups, group: groups[0] || null }
}

async function updateDurableGroupMembership(member, group, enabled, runtime = host) {
  const connectionId = String(member?.connectionId || '').trim()
  const name = String(member?.name || '').trim()

  if (!connectionId || !name) {
    return false
  }

  const routed = {
    ...member,
    name,
    connectionId,
    remoteSource: true,
    sourceScoped: true
  }
  const listed = await requestForBot(routed, 'profiles.list', {}, runtime)
  const profile = listed?.profiles?.find(value => value?.name === name)
  const current = profile?.ui_meta?.['hermes-bots']
  const next = { ...(current && typeof current === 'object' ? current : {}), ...groupMembershipPatch(current, group, enabled) }
  const result = await requestForBot(
    routed,
    'profiles.configure',
    { name, ui_meta: { 'hermes-bots': next } },
    runtime
  )

  return result?.applied?.ui_meta !== false
}

/** Group chats that should hold a roster row: every group named in bot meta
 *  (local members) plus every room record that still has stored members or
 *  log — cross-connection rooms whose members can't ride bot-meta. */
function groupChatNames(metaByName, rooms) {
  const names = new Set(knownGroups(metaByName))

  for (const [name, room] of Object.entries(rooms || {})) {
    if ((Array.isArray(room?.members) && room.members.length) || (Array.isArray(room?.log) && room.log.length)) {
      names.add(name)
    }
  }

  return [...names]
}

/** Millisecond timestamp of a room's newest log entry (0 for a silent room) —
 *  the group's recency key, competing in the same ordering as bot rows. */
function groupLastActivity(room) {
  const log = Array.isArray(room?.log) ? room.log : []

  return log.length ? log[log.length - 1].at || 0 : 0
}

/** Seat a group's member roster: local bots whose meta names the group, plus
 *  the room record's stored descriptors (remote members can't ride bot-meta).
 *  Prefers the LIVE roster row for a stored descriptor when present. */
function groupChatMemberBots(
  group,
  roster,
  metaByName,
  rooms = $groupChats.get(),
  rosterOwner = $lastRosterOwner.get(),
  metaOwner = $botMetaOwner.get()
) {
  const stored = (rooms?.[group] || {}).members || []

  // Once a room has durable composite identities they are authoritative.
  // Unioning the old name-keyed bot-meta membership here would ghost-seat a
  // same-named Agent from the newly active source and expose A's room to B.
  if (stored.length) {
    return stored.map(descriptor =>
      (roster || []).find(bot => botRosterKey(bot) === botRosterKey(descriptor)) || descriptor
    )
  }

  // Legacy rooms without a durable roster retain their name-keyed metadata
  // fallback until they are next saved with source-qualified members.
  return (roster || []).filter(
    bot => !bot.remoteSource && botGroups(botRosterMeta(bot, metaByName, rosterOwner, metaOwner)).includes(group)
  )
}

/** Persist source-qualified identities for every selected member. The active
 *  source's row may become remote after a connection switch, so retaining it
 *  here is what keeps the same room intact across machines. */
function durableGroupChatMembers(bots, rosterOwner = null) {
  const owner = normalizeRosterOwner(rosterOwner?.connectionId, rosterOwner?.profile)

  return (bots || []).flatMap(bot => {
    const connectionId = String(bot?.connectionId || (!bot?.remoteSource ? owner?.connectionId : '') || '').trim()

    if (!bot?.name || !connectionId) {
      return []
    }

    return [
      {
        name: bot.name,
        handle: bot.handle || bot.name,
        connectionId,
        connectionKind: bot.connectionKind || (connectionId === 'local' ? 'local' : undefined),
        connectionLabel: bot.connectionLabel,
        remoteSource: true,
        sourceScoped: true
      }
    ]
  })
}

function groupChatEligibleBots(roster, rosterOwner = null) {
  return (roster || []).filter(bot => durableGroupChatMembers([bot], rosterOwner).length === 1)
}

/** Existing group names, alphabetical — feeds the Manage-groups dialog. */
function knownGroups(metaByName) {
  const names = new Set()

  for (const meta of Object.values(metaByName || {})) {
    for (const group of botGroups(meta)) {
      names.add(group)
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

// ── group chats: bounded round-robin coordination over a shared room log ─────
//
// Behavioral model (clean-room): a group conversation is ONE ordered room log
// owned by the plugin. A user send triggers at most GROUP_CHAT_MAX_ROUNDS
// serial round-robin rounds over the member roster — never parallel, no LLM
// router. Who speaks each round is a deterministic @mention parse since the
// last user message (mentioned members only, else everyone); whether a member
// actually speaks is its own turn's choice — replying with exactly "(pass)"
// (or nothing, or failing) is silence. Hard caps end every turn; a round in
// which everyone passed means the conversation settled. Each member runs its
// turn in its OWN persistent per-group Hermes session and is fed only the
// room messages that are NEW since it last saw the room.

const GROUP_CHAT_MAX_ROUNDS = 3
const GROUP_CHAT_MAX_MESSAGES = 10
const GROUP_CHAT_HISTORY_LIMIT = 24
const GROUP_CHAT_MAX_MEMBERS = 6

/** "(pass)" (loosely: pass / (pass) / pass.) or empty = the member stayed silent. */
function isGroupPassText(text) {
  const trimmed = String(text || '').trim()

  if (!trimmed) {
    return true
  }

  return /^\(?\s*pass\s*\)?\.?$/i.test(trimmed)
}

/** Deterministic @mention parse. Handles @name, @"two words" via display
 *  titles, and @everyone/@all. Names match case-insensitively against member
 *  profile names, display titles, and collapsed no-space forms. */
function parseGroupChatMentions(text, members) {
  const source = String(text || '')
  const mentioned = new Set()
  let everyone = false
  const handles = new Map()

  for (const member of members) {
    const title = String(member.title || '').trim()
    // Cross-connection members are also addressable by their @name-device
    // handle (the roster's disambiguated form) — same-named agents on two
    // machines resolve to the right one.
    const handle = String(member.handle || botHandle(member.name, member) || '').trim()
    const forms = new Set([
      member.name.toLowerCase(),
      member.name.toLowerCase().replace(/[\s_-]+/g, ''),
      ...(handle ? [handle.toLowerCase(), handle.toLowerCase().replace(/[\s_-]+/g, '')] : []),
      ...(title
        ? [title.toLowerCase(), title.toLowerCase().replace(/[\s_-]+/g, ''), title.split(/\s+/)[0].toLowerCase()]
        : [])
    ])

    for (const form of forms) {
      if (form) {
        handles.set(form, groupMemberKey(member))
      }
    }
  }

  for (const match of source.matchAll(/@([a-z0-9][a-z0-9._-]*)/gi)) {
    const handle = match[1].toLowerCase()

    if (handle === 'everyone' || handle === 'all') {
      everyone = true
      continue
    }

    if (handle === 'user') {
      continue
    }

    const resolved = handles.get(handle) || handles.get(handle.replace(/[._-]+/g, ''))

    if (resolved) {
      mentioned.add(resolved)
    }
  }

  return { everyone, mentioned }
}

/** Members that should take a turn this round: everyone when no member is
 *  @-mentioned in messages since the last user entry (or @everyone appears),
 *  otherwise only the mentioned members. Recomputed every round so a member
 *  pulled in mid-conversation joins the next round. */
function resolveGroupResponders(log, members) {
  let sinceLastUser = []

  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].from.kind === 'user') {
      sinceLastUser = log.slice(i)
      break
    }
  }

  const mentioned = new Set()
  let everyone = false

  for (const entry of sinceLastUser) {
    const parsed = parseGroupChatMentions(entry.text, members)

    if (parsed.everyone) {
      everyone = true
    }

    for (const name of parsed.mentioned) {
      mentioned.add(name)
    }
  }

  if (everyone || mentioned.size === 0) {
    return members
  }

  return members.filter(member => mentioned.has(groupMemberKey(member)))
}

/** Rotate the roster so a different member leads each round. */
function rotateGroupSpeakers(members, round) {
  if (members.length < 2) {
    return members
  }

  const shift = round % members.length

  return [...members.slice(shift), ...members.slice(0, shift)]
}

/** Transcript form of a room speaker's profile name. The primary profile is
 *  literally named "default" — render it as Hermes (matching displayName and
 *  the @hermes handle) so the main agent never loses its name in rooms. */
function groupSpeakerLabel(name) {
  return (name || '').trim().toLowerCase() === 'default' ? 'Hermes' : name
}

/** Room-log line as a member sees it: `Name (user): …` / `Name: …` /
 *  `Name (you): …`. */
function formatGroupChatLine(entry, viewerName) {
  if (entry.from.kind === 'user') {
    return `${entry.from.name || 'User'} (user): ${entry.text}`
  }

  const suffix = entry.from.name === viewerName ? ' (you)' : ''
  // Cross-connection speakers carry their device so same-named agents on
  // two machines stay tellable apart in every member's transcript.
  const source = entry.from.source ? ` [${entry.from.source}]` : ''

  return `${groupSpeakerLabel(entry.from.name)}${suffix}${source}: ${entry.text}`
}

/** The full per-turn payload for one member: participation rules + the room
 *  delta. Rules travel in the turn payload (not SOUL) so every existing bot
 *  can join a group chat without a profile migration. */
function buildGroupChatTurnPrompt({ groupName, members, viewer, deltaLines }) {
  const viewerKey = groupMemberKey(viewer)
  const peers = members.filter(m => groupMemberKey(m) !== viewerKey)
  const peerNames = peers
    .map(m => {
      const handle = m.title ? `${m.title} (@${botHandle(m.name, m)})` : `@${botHandle(m.name, m)}`
      return m.remoteSource ? `${handle} [on ${m.connectionLabel || m.connectionId}]` : handle
    })
    .join(', ')

  return [
    `[Group chat: "${groupName}"] You are @${botHandle(viewer.name, viewer)}, one participant in a group chat with ${peerNames || 'no one else yet'} and the user.`,
    '',
    'New messages in the room since your last turn (oldest first):',
    ...deltaLines.map(line => `  ${line}`),
    '',
    'Rules for this room:',
    '- Reply with ONE conversational message ONLY if you have something new worth adding: build on what was just said, claim or hand off work, answer a question aimed at you, or report a real result. Keep chatter short (1-3 sentences) — but when you are delivering a result, an answer the user asked for, or substantive work, give it at full quality and length; never thin out real content to fit the room.',
    '- If you have nothing new to add, reply with exactly "(pass)". Passing is good — it lets the conversation settle.',
    '- Mention a teammate as @name to pull them in; mention @user only for a judgment call or a result the user needs. Do not repeat points already made.',
    '- Never reveal content from your private 1:1 chats. Your reply text goes to the room verbatim — no preamble, no meta-commentary.'
  ].join('\n')
}

/** Trim a room log + its watermarks to the retained window, keeping
 *  watermark indices consistent with the trimmed array. */
function trimGroupChatLog(log, watermarks, limit = GROUP_CHAT_HISTORY_LIMIT * 4) {
  if (log.length <= limit) {
    return { log, watermarks }
  }

  const drop = log.length - limit
  const trimmed = {}

  for (const [name, index] of Object.entries(watermarks || {})) {
    trimmed[name] = Math.max(0, index - drop)
  }

  return { log: log.slice(drop), watermarks: trimmed }
}

/** Mutate one group's room state through the atom + persist the durable part. */
function updateGroupChat(group, mutate) {
  const all = { ...$groupChats.get() }
  const current = all[group] || { log: [], watermarks: {}, epoch: 0, running: false }
  const next = mutate({ ...current, log: [...current.log], watermarks: { ...current.watermarks } })
  const bounded = trimGroupChatLog(next.log, next.watermarks)

  next.log = bounded.log
  next.watermarks = bounded.watermarks
  all[group] = next
  $groupChats.set(all)

  try {
    const durable = {}

    for (const [name, room] of Object.entries(all)) {
      durable[name] = {
        log: room.log,
        watermarks: room.watermarks,
        sessions: room.sessions || {},
        // Timed-out turns awaiting a late reply — keyed by member, valued
        // with the pre-turn message baseline. Survives reloads so finished
        // work is still harvested after a window restart.
        stranded: room.stranded || {},
        // Source-qualified member descriptors keep the room whole when the
        // active connection changes and today's local members become remote.
        members: Array.isArray(room.members) ? room.members : []
      }
    }

    Promise.resolve(pluginCtx?.storage?.set?.('group-chats', durable)).catch(() => undefined)
  } catch {
    /* storage unavailable — room survives for this window only */
  }

  return next
}

/** Soft-disband a group chat: remove only this group from every local member's
 *  membership list (the metadata syncs cross-machine via ui_meta), drop the
 *  room log from the atom + plugin storage, and close the room view if it's
 *  open. Other group memberships and the members' per-group gateway sessions
 *  ("Group: <name>") are intentionally KEPT. */
async function disbandGroupChat(group, members) {
  // Invalidate any in-flight round-robin FIRST: bump the epoch so a running
  // drive bails at its next member boundary instead of appending to a room
  // the user just discarded.
  const all = { ...$groupChats.get() }
  const prior = all[group] || {}

  delete all[group]
  // Keep a runtime-only tombstone while a drive may still be mid-turn; it
  // carries no log and is never persisted, so it can't rehydrate.
  if (prior.running) {
    all[group] = { log: [], watermarks: {}, sessions: {}, epoch: (prior.epoch || 0) + 1, running: false }
  }

  $groupChats.set(all)

  if ($groupChatWorkspace.get() === group) {
    $groupChatWorkspace.set(null)
  }

  // Retire the room's MAIN-window tab too (host.openWorkspace path).
  closeGroupChatMainTab(group)

  const needs = { ...$groupNeedsYou.get() }

  delete needs[group]
  $groupNeedsYou.set(needs)

  // Persist the room map WITHOUT the disbanded room so it can't come back
  // on the next window load.
  try {
    const durable = {}

    for (const [name, room] of Object.entries($groupChats.get())) {
      if (name !== group && Array.isArray(room.log)) {
        durable[name] = {
          log: room.log,
          watermarks: room.watermarks,
          sessions: room.sessions || {},
          members: Array.isArray(room.members) ? room.members : []
        }
      }
    }

    await Promise.resolve(pluginCtx?.storage?.set?.('group-chats', durable))
  } catch {
    /* storage unavailable — the atom reset above still empties the room */
  }

  // Remove membership last, routed through each durable member's captured
  // source. Durable descriptors intentionally all carry remoteSource:true so
  // they remain routable after an A -> B switch; skipping that flag would
  // leave stale ui_meta and resurrect the disbanded row on the next refresh.
  const owner = currentBotMetaOwner()
  const cleanup = (members || []).flatMap(member => {
    if (!member?.name) {
      return []
    }

    if (member.connectionId) {
      return [updateDurableGroupMembership(member, group, false)]
    }

    // Pre-v31 rooms had no durable descriptor. Retain the old local cleanup
    // only under an exact explicit local owner; unknown/remote stays closed.
    if (!member.remoteSource && isExactLocalRosterOwner(owner)) {
      const meta = botRosterMeta(member, $botMeta.get(), owner)
      return [saveBotMeta(member.name, groupMembershipPatch(meta, group, false), meta, owner)]
    }

    return []
  })

  await Promise.allSettled(cleanup)
}

function appendGroupChatEntry(group, from, text) {
  const entry = { from, text: String(text).trim(), at: Date.now() }

  updateGroupChat(group, room => {
    room.log.push(entry)
    return room
  })

  // Needs-you: a member addressing @user badges the group header.
  if (from.kind === 'member' && /@user\b/i.test(entry.text)) {
    $groupNeedsYou.set({ ...$groupNeedsYou.get(), [group]: true })
  }

  return entry
}

/** Ensure the member's per-group session exists and return a LIVE runtime
 *  session id for it. Gateway-native: session.create mints the session
 *  (lazy until its first message), session.resume by stored id — or by
 *  title, which also covers rehydrated rooms whose sid was lost — reopens
 *  it after restarts. Cross-connection members route to their OWN source
 *  via requestForBot; the window's gateway never switches. */
async function ensureGroupChatSession(group, member) {
  const title = `Group: ${group}`
  const room = $groupChats.get()[group] || {}
  const key = groupMemberKey(member)
  const known = room.sessions && room.sessions[key]

  // Try resuming what we know (stored sid first, then title lookup).
  for (const target of [known, title]) {
    if (!target || target === true) {
      continue
    }

    try {
      const res = await requestForBot(member, 'session.resume', {
        session_id: target,
        profile: member.name,
        omit_messages: true
      })

      if (res?.session_id) {
        return { runtime: res.session_id, stored: res.session_key || known }
      }
    } catch {
      /* fall through to create */
    }
  }

  const created = await requestForBot(member, 'session.create', {
    profile: member.name,
    title,
    // Room member sessions are plumbing — always hidden from the sidebar.
    hidden: true
  })
  const stored = created?.stored_session_id || null

  if (stored) {
    updateGroupChat(group, r => {
      r.sessions = { ...(r.sessions || {}), [key]: stored }
      return r
    })
  }

  return { runtime: created?.session_id || null, stored }
}

const GROUP_TURN_TIMEOUT_MS = 180000
const GROUP_TURN_POLL_MS = 2000
// A member turn that is VISIBLY still working (session reports
// inflight/running) keeps its slot alive up to this hard cap. The base
// timeout alone silently dropped long real turns: a 7-minute research run
// timed out at 3 minutes, read as a pass, and its finished result never
// reached the room (db's Aug 2026 report).
const GROUP_TURN_HARD_CAP_MS = 20 * 60000

/** One member turn, gateway-native: submit the room delta as a prompt into
 *  the member's per-group session, then poll the session until a NEW
 *  assistant message lands (or timeout → pass). While the session visibly
 *  reports work in flight the deadline extends (bounded by the hard cap),
 *  so slow models aren't cut off mid-run. A turn that still times out
 *  records a stranded marker so the finished reply can be harvested into
 *  the room at the member's next turn instead of being lost. */
async function runGroupChatMemberTurn(group, member, prompt) {
  const { runtime, stored } = await ensureGroupChatSession(group, member)

  if (!runtime) {
    return null
  }

  // Baseline: how many messages exist before our submit.
  let before = 0

  try {
    const pre = await requestForBot(member, 'session.resume', {
      session_id: stored || runtime,
      profile: member.name
    })
    before = Array.isArray(pre?.messages) ? pre.messages.length : pre?.message_count || 0
  } catch {
    /* lazy session — zero messages */
  }

  await requestForBot(member, 'prompt.submit', { session_id: runtime, text: prompt })

  const started = Date.now()
  let deadline = started + GROUP_TURN_TIMEOUT_MS

  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, GROUP_TURN_POLL_MS))

    let state = null

    try {
      state = await requestForBot(member, 'session.resume', {
        session_id: stored || runtime,
        profile: member.name
      })
    } catch {
      continue
    }

    const messages = Array.isArray(state?.messages) ? state.messages : []
    const busy = Boolean(state?.inflight || state?.running)
    const done = !busy

    if (messages.length > before && done) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]

        if (msg?.role === 'assistant') {
          const text = typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content.map(p => (typeof p === 'string' ? p : p?.text || '')).join('')
              : msg?.text || ''

          return String(text).trim()
        }
      }

      return null
    }

    // Still visibly working: extend the deadline (never past the hard cap).
    if (busy) {
      deadline = Math.min(started + GROUP_TURN_HARD_CAP_MS, Math.max(deadline, Date.now() + GROUP_TURN_TIMEOUT_MS))
    }
  }

  // Timeout — reads as a pass, but remember the baseline (runtime-only) so
  // the finished reply can be posted late instead of vanishing.
  updateGroupChat(group, r => {
    r.stranded = { ...(r.stranded || {}), [groupMemberKey(member)]: before }
    return r
  })

  return null
}

/** Post a timed-out member's finished reply into the room, if it landed
 *  after we stopped waiting. Called at the member's next turn boundary and
 *  on user sends, so long-running work is delivered late rather than lost. */
async function harvestStrandedGroupReply(group, member) {
  const memberKey = groupMemberKey(member)
  const room = $groupChats.get()[group] || {}
  const strandedBefore = room.stranded?.[memberKey]

  if (typeof strandedBefore !== 'number') {
    return
  }

  let state = null

  try {
    const stored = room.sessions?.[memberKey]
    state = await requestForBot(member, 'session.resume', {
      session_id: stored || `Group: ${group}`,
      profile: member.name
    })
  } catch {
    return // source unreachable — leave the marker for the next boundary
  }

  if (state?.inflight || state?.running) {
    return // still grinding — keep waiting
  }

  // Done (or dead): the marker is consumed either way.
  updateGroupChat(group, r => {
    const next = { ...(r.stranded || {}) }
    delete next[memberKey]
    r.stranded = next
    return r
  })

  const messages = Array.isArray(state?.messages) ? state.messages : []

  if (messages.length <= strandedBefore) {
    return
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]

    if (msg?.role === 'assistant') {
      const text = typeof msg.content === 'string'
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map(p => (typeof p === 'string' ? p : p?.text || '')).join('')
          : msg?.text || ''
      const reply = String(text).trim()

      if (reply && !isGroupPassText(reply)) {
        appendGroupChatEntry(
          group,
          { kind: 'member', name: member.name, ...(member.remoteSource ? { source: member.connectionLabel || member.connectionId } : {}) },
          reply
        )
        updateGroupChat(group, r => {
          r.watermarks[memberKey] = r.log.length
          return r
        })
      }

      return
    }
  }
}

/** Drive one bounded round-robin room turn. Serial — one member at a time.
 *  A newer user send bumps the room epoch; this loop notices at the next
 *  member boundary, bails, and the newest send's own loop takes over. */
async function runGroupChatRounds(group, members) {
  const startEpoch = ($groupChats.get()[group] || {}).epoch || 0
  const isCurrent = () => (($groupChats.get()[group] || {}).epoch || 0) === startEpoch
  let posted = 0

  try {
    for (let round = 0; round < GROUP_CHAT_MAX_ROUNDS; round++) {
      // Deliver any replies that finished after their turn timed out —
      // every member, not just this round's responders, so long work is
      // late, never lost.
      for (const member of members) {
        if (!isCurrent()) {
          return
        }

        await harvestStrandedGroupReply(group, member)
      }

      const roomLog = ($groupChats.get()[group] || {}).log || []
      const responders = rotateGroupSpeakers(resolveGroupResponders(roomLog, members), round)
      let spokeThisRound = 0

      for (const member of responders) {
        if (!isCurrent() || posted >= GROUP_CHAT_MAX_MESSAGES) {
          return
        }

        const room = $groupChats.get()[group] || { log: [], watermarks: {} }
        const memberKey = groupMemberKey(member)
        const seen = room.watermarks[memberKey] || 0
        const delta = room.log.slice(seen)

        if (!delta.length) {
          continue
        }

        const prompt = buildGroupChatTurnPrompt({
          groupName: group,
          members,
          viewer: member,
          deltaLines: delta.slice(-GROUP_CHAT_HISTORY_LIMIT).map(e => formatGroupChatLine(e, member.name))
        })

        // Surface WHO is on turn (runtime-only, like running/epoch) so the
        // room shows "Radar is thinking…" instead of a generic working line —
        // long model turns otherwise read as the room being stuck.
        updateGroupChat(group, r => {
          r.turn = member.name
          return r
        })

        let reply = null

        try {
          reply = await runGroupChatMemberTurn(group, member, prompt)
        } catch {
          reply = null // a failed turn is a pass, never a room error
        }

        // The member has now seen everything up to the pre-reply log length.
        updateGroupChat(group, r => {
          r.watermarks[memberKey] = r.log.length
          return r
        })

        if (reply !== null && !isGroupPassText(reply)) {
          appendGroupChatEntry(
            group,
            { kind: 'member', name: member.name, ...(member.remoteSource ? { source: member.connectionLabel || member.connectionId } : {}) },
            reply
          )
          // Its own message counts as seen too.
          updateGroupChat(group, r => {
            r.watermarks[memberKey] = r.log.length
            return r
          })
          posted += 1
          spokeThisRound += 1
        }
      }

      if (spokeThisRound === 0) {
        return // everyone passed — the conversation settled
      }
    }
  } finally {
    if (isCurrent()) {
      updateGroupChat(group, r => {
        r.running = false
        r.turn = null
        return r
      })
    }
  }
}

/** User send into a group room: append, bump epoch (supersedes any running
 *  loop at its next member boundary), and start the room turn unless one is
 *  already running under the new epoch semantics. */
function sendToGroupChat(group, members, text) {
  const trimmed = String(text || '').trim()

  if (!trimmed || !members.length) {
    return
  }

  $groupNeedsYou.set({ ...$groupNeedsYou.get(), [group]: false })
  appendGroupChatEntry(group, { kind: 'user', name: 'You' }, trimmed)

  const wasRunning = ($groupChats.get()[group] || {}).running === true

  updateGroupChat(group, room => {
    room.epoch = (room.epoch || 0) + 1
    room.running = true
    return room
  })

  if (!wasRunning) {
    void runGroupChatRounds(group, members).catch(() => {
      updateGroupChat(group, r => {
        r.running = false
        return r
      })
    })
  } else {
    // A loop is live; it bails at its next boundary. Chain the fresh loop
    // after a short settle so exactly one drive owns the room.
    setTimeout(() => {
      void runGroupChatRounds(group, members).catch(() => {
        updateGroupChat(group, r => {
          r.running = false
          return r
        })
      })
    }, 250)
  }
}

/** Share one in-flight async operation across concurrent callers. Failures
 * clear the slot so a later attempt can retry. */
function singleFlight(ref, start) {
  if (ref.current) {
    return ref.current
  }

  let flight
  try {
    flight = Promise.resolve(start())
  } catch (err) {
    flight = Promise.reject(err)
  }
  ref.current = flight
  flight.catch(() => {
    if (ref.current === flight) {
      ref.current = null
    }
  })
  return flight
}

/** The agent-to-agent messaging protocol, reusable so a CUSTOM SOUL keeps
 *  the handoff protocol too — a custom SOUL used to silently drop it,
 *  breaking @mentions for customized bots (@wesleysimplicio, #16). */
function messagingProtocolSection(name, roster) {
  const teammates = (roster || []).filter(b => b.name !== name)
  const handle = botHandle(name)

  return [
    '## Messaging other agents',
    '',
    'You work alongside other named agents. Every agent (including you) has',
    'ONE canonical conversation titled "Bot Chat" — created with the agent,',
    'so it always exists. Agent-to-agent messages are delivered straight',
    'into it, like a DM. To message a teammate, run:',
    '',
    '```',
    'hermes -p <agent-name> chat --in ~ -c "Bot Chat" --create-if-missing -Q -q "Message from \uD83E\uDD16 ' + handle + ' (@' + handle + '): your message"',
    '',
    'Run the send with background=true and notify_on_complete=true on the',
    'terminal tool, then finish your turn — the reply arrives later as a',
    'background process notification. Never block waiting for it.',
    '```',
    '',
    '(`--in ~ -c "Bot Chat" --create-if-missing` resumes their canonical',
    'conversation in the home workspace, creating it if the target has no',
    '"Bot Chat" yet. `-Q` keeps output clean. Always open with the',
    '"Message from \uD83E\uDD16 ' + handle + ' (@' + handle + '):" prefix so they know',
    'who is talking (the @handle lets the app show your avatar to them).',
    'Their reply prints to stdout — relay the relevant part back to the',
    'user, and say which agent it came from.)',
    '',
    'If a message in YOUR chat starts with "Message from \uD83E\uDD16 <name>", it is',
    'a teammate messaging you, not the user. Answer it directly — your reply',
    'reaches them via their own delivery — and use the same command if you',
    'need to start a conversation yourself.',
    '',
    'When the user writes @<agent-name> or says "ask <name> to ..." /',
    '"tell <name> ...", that is a handoff: message that agent, wait for the',
    'reply, and report back.',
    '',
    'The roster grows over time — run `hermes profile list` for the LIVE',
    'teammate list before a handoff. Teammates when you were created:',
    ...(teammates.length
      ? teammates.map(b => `- \`${b.name}\`${b.description ? ` — ${b.description}` : ''}`)
      : ['- (none yet)'])
  ].join('\n')
}

/** True when SOUL.md already carries the Bot Mode handoff section.
 *  #16 appends this at create-time; pre-existing profiles (especially
 *  `default`) never went through composeSoul and silently lack it. */
function hasMessagingProtocol(soul) {
  return /(^|\n)## Messaging other agents(\s|$)/.test(soul || '')
}

/** Idempotent: append the protocol once, never duplicate a custom SOUL
 *  that already has it (clone-from-default after a backfill, Edit save).
 *  No-op when the backend injects the protocol into the system prompt
 *  itself (bot_mode_protocol) — SOUL.md stays the user's identity text. */
function ensureMessagingProtocol(soul, name, roster, protocolInjected = false) {
  const text = (soul || '').trim()
  if (protocolInjected || hasMessagingProtocol(text)) return text
  const section = messagingProtocolSection(name, roster)
  return text ? text + '\n\n' + section : section
}

const soulProtocolChecked = new Set()
const soulProtocolInflight = new Set()

/** One-shot per profile per session: if an existing SOUL has no protocol,
 *  append it. This is the install-time fix for default / pre-Bot-Mode
 *  personas that #16 never touched. Never overwrites identity text. */
async function backfillMessagingProtocol(
  roster,
  rosterOwner,
  { protocolInjected = false, runtime = host } = {}
) {
  // Newer backends teach the protocol via the system prompt — never touch
  // user SOUL files when the server already covers every session.
  if (protocolInjected) {
    return
  }

  const owner = normalizeRosterOwner(rosterOwner?.connectionId, rosterOwner?.profile)

  if (!owner) {
    return
  }

  const candidates = []

  for (const bot of roster || []) {
    const name = String(bot?.name || '').trim()
    const source = String(bot?.connectionId || owner.connectionId).trim()
    const key = source && name ? `${source}::${name}` : ''

    if (
      !key ||
      source !== owner.connectionId ||
      soulProtocolChecked.has(key) ||
      soulProtocolInflight.has(key)
    ) {
      continue
    }

    soulProtocolInflight.add(key)
    candidates.push({ bot, key, name, source })
  }

  if (!candidates.length) {
    return
  }

  let routes = []

  if (typeof runtime?.requestProfile === 'function' && typeof runtime?.profileRoutes === 'function') {
    try {
      routes = await runtime.profileRoutes()
    } catch {
      routes = []
    }
  }

  const routeFor = candidate =>
    (Array.isArray(routes) ? routes : []).find(route =>
      String(route?.connectionId || '').trim() === candidate.source &&
      String(route?.targetProfile || route?.profile || '').trim() === candidate.name
    ) || null

  await Promise.allSettled(
    candidates.map(async candidate => {
      const { key, name } = candidate
      const route = routeFor(candidate)
      const request = async (method, params) => {
        if (route && typeof runtime?.requestProfile === 'function') {
          return runtime.requestProfile(route, method, params)
        }

        // Older SDK fallback is safe only while the captured active owner is
        // still exact. Revalidate before every ambient request so a delayed A
        // describe can never configure B's same-named profile after a switch.
        if (!rosterOwnerStillActive(owner, runtime)) {
          throw new Error(agentSourceUnavailableMessage(agentText, name, owner.connectionId))
        }

        return runtime.request(method, params)
      }

      try {
        const res = await request('profiles.describe', { name })
        const soul = (res && res.soul) || ''
        if (hasMessagingProtocol(soul)) {
          soulProtocolChecked.add(key)
          return
        }

        await request('profiles.configure', {
          name,
          soul: ensureMessagingProtocol(soul, name, roster, protocolInjected)
        })
        soulProtocolChecked.add(key)
      } catch {
        // A normal one-off RPC miss stays one-shot. An ambient legacy request
        // aborted because its captured owner changed must remain retryable
        // when the user returns to that source.
        if (route || rosterOwnerStillActive(owner, runtime)) {
          soulProtocolChecked.add(key)
        }
      } finally {
        soulProtocolInflight.delete(key)
      }
    })
  )
}

/** SOUL.md for a new bot: identity (or the user's custom SOUL) + the
 *  messaging protocol — which ships UNLESS the backend injects it into the
 *  system prompt itself (bot_mode_protocol capability). */
function composeSoul({ name, title, description, roster, customSoul, protocolInjected = false }) {
  if (customSoul && customSoul.trim()) {
    return ensureMessagingProtocol(customSoul, name, roster, protocolInjected)
  }

  const lines = [
    `# ${displayName({ name, title })}`,
    '',
    title ? `**Role:** ${title}` : null,
    description ? `**Mission:** ${description}` : null,
    '',
    `You are ${displayName({ name, title })}, a persistent named agent (profile \`${name}\`) on this machine.`,
    'You keep your own memory, skills, and conversation history across sessions.'
  ]

  const identity = lines.filter(line => line !== null).join('\n')

  return protocolInjected ? identity : identity + '\n\n' + messagingProtocolSection(name, roster)
}

// ── human-readable row helpers ───────────────────────────────────────────────

/** Bot-to-bot delivery prefix (see messagingProtocolSection): either the
 *  current "Message from 🤖 name (@handle):" form or the older
 *  "[Message from agent 'name']" shape. Captures the sender's handle. */
const A2A_RE = /^Message from (?:agent '([^']+)'|🤖\s*([^\s(@]+))/i

/** Strip the delivery prefix so a DM preview reads like a DM, not a log line. */
const A2A_PREFIX_RE = /^Message from (?:agent '[^']+'|🤖[^:]+):\s*/i

/** Classify a roster preview: `{ fromBot: handle|null }`. A preview that
 *  starts with the delivery prefix is a bot-to-bot message — the receiving
 *  bot's row should show WHO sent it, not present it as the human's chat. */
function previewKind(preview) {
  const text = (preview || '').trim()
  if (!text) {
    return { fromBot: null }
  }
  const match = text.match(A2A_RE)
  if (match) {
    return { fromBot: (match[1] || match[2] || '').trim().toLowerCase() || null }
  }
  return { fromBot: null }
}

/** Session titles the gateway auto-assigns that carry no information. */
const GENERIC_TITLES = new Set(['', 'bot chat', 'new chat', 'new conversation', 'conversation', 'chat', 'untitled'])

function isGenericTitle(title) {
  return GENERIC_TITLES.has((title || '').trim().toLowerCase())
}

/** Title for the session chip: the real session title when it means
 *  something, otherwise a short label generated from the newest message
 *  (delivery prefixes stripped) so "Bot Chat" rows still say what the
 *  conversation is actually about. */
function generatedSessionTitle(session, preview) {
  const raw = (session?.title || '').trim()
  if (raw && !isGenericTitle(raw)) {
    return raw
  }
  const cleaned = (preview || '').trim().replace(A2A_PREFIX_RE, '').trim()
  if (!cleaned) {
    return raw || agentText('profile.conversation')
  }
  const words = cleaned.split(/\s+/).slice(0, 5).join(' ').replace(/[,;:.]+$/, '')
  if (!words) {
    return raw || agentText('profile.conversation')
  }
  return words.length > 34 ? `${words.slice(0, 33)}…` : words
}

/** Roster liveness window: a bot whose last message landed within this many
 *  seconds is treated as "active now" (pulsing dot in its row). */
const ACTIVE_WINDOW_S = 90

/** Bots that are working right now: the profile the gateway is running a
 *  turn for (busy), plus any bot whose last message landed inside the
 *  liveness window. Pure — output follows the input roster's order, so
 *  presence never reorders or hides the normal list. */
function activeBots(roster, activeProfile, gatewayState, now = Date.now()) {
  return (roster || []).filter(bot => {
    const busyTurn = !bot.remoteSource && bot.name === activeProfile && gatewayState === 'busy'
    const last = bot.last_session?.last_active || 0
    const inWindow = Boolean(last && now / 1000 - last < ACTIVE_WINDOW_S)

    return busyTurn || inWindow
  })
}

// ── bot row ──────────────────────────────────────────────────────────────────

function agentProfileActionsAvailable(bot) {
  return Boolean(bot?.name) && bot?.remoteSource !== true
}

function agentProfileDeleteRoute(owner, runtime = host) {
  const normalized = normalizeRosterOwner(owner?.connectionId, owner?.profile)

  if (!normalized) {
    return null
  }

  if (normalized.connectionId !== 'local' && runtime?.deleteProfileConnectionScoped !== true) {
    return null
  }

  return {
    connectionId: runtime?.deleteProfileConnectionScoped === true ? normalized.connectionId : undefined,
    profile: normalized.profile
  }
}

function agentDeleteClearsLegacyMeta(owner, cacheOwner) {
  return isExactLocalRosterOwner(owner) && sameRosterOwner(owner, cacheOwner)
}

function captureAgentProfileAction(bot, rosterOwner) {
  if (!agentProfileActionsAvailable(bot)) {
    return null
  }

  const owner = normalizeRosterOwner(bot?.connectionId || rosterOwner?.connectionId, rosterOwner?.profile)

  return owner ? { ...bot, actionOwner: owner } : null
}

function agentProfileActionMatchesOwner(bot, rosterOwner) {
  const expected = normalizeRosterOwner(bot?.actionOwner?.connectionId, bot?.actionOwner?.profile)
  const current = normalizeRosterOwner(rosterOwner?.connectionId, rosterOwner?.profile)

  return Boolean(
    agentProfileActionsAvailable(bot) &&
      expected &&
      current &&
      expected.connectionId === current.connectionId &&
      expected.profile === current.profile
  )
}

function invokeAgentProfileAction(bot, action, rosterOwner = null) {
  if (!agentProfileActionMatchesOwner(bot, rosterOwner) || typeof action !== 'function') {
    return false
  }

  action(bot)
  return true
}

function BotRow({ bot, rosterOwner, onDelete, onEdit, onGroup }) {
  const copy = useAgentText()
  const activeProfile = useValue(host.state.profile)
  const meta = botRosterMeta(bot, useValue($botMeta), rosterOwner)
  const groups = botGroups(meta)
  const last = bot.last_session
  const isActive = !bot.remoteSource && bot.name === activeProfile
  const { shape, color, image } = botAppearance(bot.name, meta)
  // Keep user photos/pets. Drop the 160px SVG backfill so the math face can move.
  const photo = Boolean(image && !isBackfilledFacePng(image))
  const gatewayState = useValue(host.state.gateway)
  const activeNow = Boolean(last?.last_active && Date.now() / 1000 - last.last_active < ACTIVE_WINDOW_S)
  // Work pose only when this bot is actually doing something: the active
  // profile while the gateway is busy, or a bot that wrote within the
  // liveness window. Not every bot whenever the gateway is busy.
  const botMood = (isActive && gatewayState === 'busy') || activeNow ? 'work' : 'idle'
  // Subscribe on every render. A source switch turns the same keyed row from
  // thin to rich; conditionally calling useValue here breaks React hook order.
  const unreadByName = useValue($botUnread)
  const unread = !bot.remoteSource && Boolean(unreadByName[bot.name])
  // WHO sent the last message (bot-to-bot DM vs human) — the full stored
  // history lives in the Sessions workspace (context menu), not inline.
  // Preview identity must match click identity (#88200): when the backend
  // resolved the pinned canonical chat, preview THAT session — not the
  // profile's most recent (but unrelated) activity. Liveness checks above
  // keep last_session semantics: any recent activity means the bot is alive.
  const previewSession = bot.preferred_session || last
  const { fromBot } = previewKind(previewSession?.preview)
  // DM previews read like DMs: strip the delivery prefix, keep the message.
  const displayPreview = stripPreviewMarkdown(
    fromBot
      ? (previewSession?.preview || '').replace(A2A_PREFIX_RE, '').trim() || '…'
      : previewSession?.preview || bot.description || copy('roster.noConversations')
  )
  const actionBot = captureAgentProfileAction(bot, rosterOwner)
  const runProfileAction = action =>
    invokeAgentProfileAction(actionBot, action, {
      connectionId: host.state.connectionId?.get?.() || 'local',
      profile: host.state.profile?.get?.() || 'default'
    })

  const warm = () => {
    // Multi-source row: pre-dial the agent's OWN source (feature-detected).
    if (bot.sourceScoped && typeof host.warmAgent === 'function') {
      try {
        host.warmAgent(bot.connectionId, bot.name)
      } catch {
        /* warm is best-effort */
      }

      return
    }

    if (typeof host.warmProfile !== 'function') {
      return
    }

    try {
      host.warmProfile(bot.name)
    } catch {
      /* warm is best-effort */
    }
  }

  const open = async () => {
    haptic('tap')
    $selectedBot.set(bot.name)

    if (bot.remoteSource) {
      const handle = botHandle(bot.name, bot)
      host.notify?.({
        kind: 'info',
        title: displayName(bot),
        message: copy('remote.stayHere', handle)
      })
      return
    }

    let pinnedChat = meta?.chat

    if (!bot.remoteSource && $botUnread.get()[bot.name]) {
      const next = { ...$botUnread.get() }
      delete next[bot.name]
      $botUnread.set(next)
    }

    // Activate the owner first so every canonical-chat RPC lands on the
    // backend that owns this bot's state database.
    try {
      pinnedChat = await prepareBotSource(bot, pinnedChat)
    } catch (error) {
      host.notifyError?.(error, copy('remote.couldNotReach', bot.connectionLabel || copy('remote.sourceFallback')))

      return
    }

    const openOwner = normalizeRosterOwner(bot.connectionId || rosterOwner?.connectionId, rosterOwner?.profile)

    if (!openOwner || !rosterOwnerStillActive(openOwner)) {
      return
    }

    try {
      const id = await openBotCanonicalChat(bot.name, pinnedChat, bot.last_session, openOwner)

      if (id) {
        return
      }
    } catch {
      // Fall through to the older-gateway draft below.
    }

    if (!rosterOwnerStillActive(openOwner)) {
      return
    }

    if (typeof host.newChat === 'function') {
      // Older gateway without profile-scoped session.create — plain draft.
      host.newChat(bot.name)
    } else {
      host.navigate('/')
    }
  }

  const row = jsxs('button', {
    type: 'button',
    onPointerEnter: warm,
    onClick: open,
    className: cn(
      'flex w-full min-w-0 max-w-full items-center gap-2.5 overflow-hidden rounded-md px-2 py-2 text-left transition-colors',
      'hover:bg-(--chrome-action-hover)',
      isActive && 'bg-(--chrome-action-hover)',
      // Hidden bots only render while the header eye toggle is on — dimmed,
      // so the temporary reveal reads as a different state from the roster.
      meta?.hidden && 'opacity-60'
    ),
    children: [
      jsx('div', {
        className: 'shrink-0',
        children: jsx(BotFace, { shape, color, image: photo ? image : null, size: 34, name: bot.name, mood: botMood })
      }),
      jsxs('div', {
        className: 'min-w-0 flex-1',
        children: [
          jsxs('div', {
            className: 'flex items-baseline justify-between gap-2',
            children: [
              jsxs('div', {
                className: 'flex min-w-0 items-baseline gap-1.5 truncate',
                children: [
                  meta?.pinned
                    ? jsx('span', {
                        className: 'shrink-0 text-[0.6875rem] text-(--ui-text-quaternary)',
                        title: copy('roster.pinned'),
                        children: '📌'
                      })
                    : null,
                  meta?.hidden
                    ? jsx(Codicon, {
                        name: 'eye-closed',
                        className: 'shrink-0 text-[0.6875rem] text-(--ui-text-quaternary)',
                        title: copy('roster.hidden')
                      })
                    : null,
                  jsx('span', {
                    className: 'truncate text-[0.8125rem] font-medium',
                    children: displayName(bot, meta)
                  }),
                  showsHandle(bot.name, meta, bot)
                    ? jsx('span', {
                        className: 'shrink-0 font-mono text-[0.6875rem] text-(--ui-text-quaternary)',
                        children: `@${botHandle(bot.name, bot)}`
                      })
                    : null,
                  bot.remoteSource
                    ? jsx('span', {
                        className:
                          'shrink-0 rounded bg-(--chrome-action-hover) px-1 font-mono text-[0.625rem] text-(--ui-text-tertiary)',
                        title: copy('remote.livesOn', bot.connectionLabel),
                        children: bot.connectionLabel
                      })
                    : null
                ]
              }),
              unread
                ? jsx('span', {
                    className: 'size-2 shrink-0 rounded-full bg-(--ui-accent,#4f9cf9)',
                    'aria-label': copy('roster.unread')
                  })
                : null,
              activeNow
                ? jsx('span', {
                    className: 'hermes-bots-pulse size-1.5 shrink-0 rounded-full bg-(--ui-accent,#4f9cf9)',
                    title: copy('roster.activeRecently')
                  })
                : null,
              last
                ? jsx('span', {
                    className: 'shrink-0 text-[0.6875rem] text-(--ui-text-quaternary)',
                    children: relativeTime(last.last_active * 1000)
                  })
                : null
            ]
          }),
          jsxs('div', {
            className: 'flex min-w-0 items-center gap-1',
            children: [
              jsx('div', {
                className: fromBot
                  ? 'min-w-0 truncate text-xs italic text-(--ui-accent,#4f9cf9)'
                  : 'min-w-0 truncate text-xs text-(--ui-text-tertiary)',
                children: displayPreview
              }),
              fromBot
                ? jsxs('span', {
                    className:
                      'flex shrink-0 items-center gap-1 rounded-full bg-(--chrome-action-hover) px-1.5 py-px text-[0.625rem] font-medium text-(--ui-accent,#4f9cf9)',
                    title: copy('roster.lastFrom', fromBot),
                    children: ['🤖', `@${fromBot}`]
                  })
                : null
            ]
          })
        ]
      })
    ]
  })

  // Thin rows from another source are navigation targets only. Their profile
  // metadata is not loaded yet, so edit/delete/pin/group actions would mutate
  // whichever backend happens to be active. A normal click activates the
  // owner; the refreshed rich row then exposes the full context menu.
  if (!actionBot) {
    return row
  }

  return jsxs(ContextMenu, {
    children: [
      jsx(ContextMenuTrigger, { asChild: true, children: row }),
      jsxs(ContextMenuContent, {
        children: [
          jsx(ContextMenuItem, {
            onSelect: () => runProfileAction(() => {
              const pinned = Boolean(meta?.pinned)
              saveBotMeta(bot.name, { pinned: !pinned }, meta, actionBot.actionOwner)
              host.notify({
                kind: 'info',
                message: pinned
                  ? copy('roster.unpinned', displayName(bot, meta))
                  : copy('roster.pinnedTop', displayName(bot, meta))
              })
            }),
            children: meta?.pinned ? copy('roster.unpin') : copy('roster.pinTop')
          }),
          jsx(ContextMenuItem, {
            onSelect: () => runProfileAction(() => {
              const hidden = Boolean(meta?.hidden)
              // `hidden: false` (not null) so unhide round-trips through the
              // server ui_meta merge the same way the local merge sees it.
              saveBotMeta(bot.name, { hidden: !hidden }, meta, actionBot.actionOwner)

              if (!hidden) {
                fallbackSelectionAfterHide(bot.name)
              }

              host.notify({
                kind: 'info',
                message: hidden
                  ? copy('roster.visibleAgain', displayName(bot, meta))
                  : copy('roster.hiddenNotice', displayName(bot, meta))
              })
            }),
            children: meta?.hidden ? copy('roster.unhide') : copy('roster.hide')
          }),
          jsx(ContextMenuSeparator, {}),
          jsx(ContextMenuItem, {
            onSelect: () => runProfileAction(() => openBotSessionsWorkspace(bot)),
            children: copy('common.sessions')
          }),
          jsx(ContextMenuItem, {
            onSelect: () => runProfileAction(() => onEdit(actionBot)),
            children: copy('common.editProfile')
          }),
          !bot.remoteSource
            ? jsx(ContextMenuItem, {
                onSelect: () => runProfileAction(() => onGroup(actionBot)),
                children: groups.length ? copy('roster.groups', groups.join(', ')) : copy('roster.manageGroups')
              })
            : null,
          jsx(ContextMenuItem, {
            onSelect: () => runProfileAction(() => {
              host.notify({ kind: 'info', message: copy('profile.duplicateStarted', displayName(bot, meta)) })
              duplicateBot(actionBot, $lastRoster.get().filter(candidate => !candidate.remoteSource), meta)
                .then(name => {
                  queryClient.invalidateQueries({ queryKey: ROSTER_KEY })
                  host.notify({ kind: 'success', message: copy('profile.duplicateCreated', name, bot.name) })
                })
                .catch(err => host.notifyError(err, copy('profile.duplicateFailed')))
            }),
            children: copy('common.duplicate')
          }),
          jsx(ContextMenuSeparator, {}),
          jsx(ContextMenuItem, {
            onSelect: () => runProfileAction(() => {
              $selectedBot.set(bot.name)

              if (typeof host.newChat === 'function') {
                host.newChat(bot.name)
              }
            }),
            children: copy('roster.newChat')
          }),
          bot.is_default ? null : jsx(ContextMenuSeparator, {}),
          bot.is_default
            ? null
            : jsx(ContextMenuItem, {
                onSelect: () => runProfileAction(() => onDelete(actionBot)),
                variant: 'destructive',
                children: copy('common.delete')
              })
        ]
      })
    ]
  })
}

// ── model picker (provider/model dropdowns via model.options) ───────────────

function useModelOptions(rosterOwner) {
  const owner = normalizeRosterOwner(rosterOwner?.connectionId, rosterOwner?.profile)

  return useQuery({
    queryKey: [ID, 'model-options', owner?.connectionId || '', owner?.profile || ''],
    queryFn: () =>
      createRosterOwnerRequester(host, owner)('model.options', {
        include_unconfigured: true,
        explicit_only: false,
        refresh: true
      }),
    enabled: Boolean(owner),
    staleTime: 120000,
    retry: false
  })
}

/**
 * Provider + model dropdowns from the gateway's configured inventory — the
 * same data the core model picker shows. `value = {provider, model}`;
 * onChange receives the merged patch.
 */
function ModelPicker({ value, onChange, placeholderModel = null, rosterOwner = currentBotMetaOwner() }) {
  const copy = useAgentText()
  const { data, isLoading, error } = useModelOptions(rosterOwner)

  // Hooks are ALWAYS declared up front, before any conditional return.
  // Declaring them after a return trips React error #310.
  const NONE = '__default__'
  const CUSTOM = '__custom__'
  const providers = (data?.providers || []).filter(p => p && p.slug)
  const isKnown =
    !value.provider || value.provider === NONE || providers.some(p => p.slug === value.provider)
  const [useFreeText, setUseFreeText] = useState(!isKnown)

  if (isLoading) {
    return jsx('div', {
      className: 'flex justify-center py-2',
      children: jsx(GlyphSpinner, { spinner: 'breathe', className: 'text-(--ui-text-tertiary)' })
    })
  }

  if (error || !providers.length) {
    // Fallback: free text (older gateway or empty inventory).
    return jsxs('div', {
      style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
      children: [
        labeled(
          copy('model.provider'),
          jsx(Input, {
            placeholder: copy('model.providerPlaceholder'),
            value: value.provider,
            onChange: event => onChange({ provider: event.target.value })
          })
        ),
        labeled(
          copy('model.model'),
          jsx(Input, {
            placeholder: copy('model.modelPlaceholder'),
            value: value.model,
            onChange: event => onChange({ model: event.target.value })
          })
        )
      ]
    })
  }

  if (useFreeText) {
    return jsxs('div', {
      style: { display: 'flex', flexDirection: 'column', gap: '8px' },
      children: [
        jsxs('div', {
          style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
          children: [
            labeled(
              copy('model.providerCustom'),
              jsx(Input, {
                placeholder: copy('model.providerExample'),
                value: value.provider,
                onChange: event => onChange({ provider: event.target.value })
              })
            ),
            labeled(
              copy('model.modelCustom'),
              jsx(Input, {
                placeholder: copy('model.modelExample'),
                value: value.model,
                onChange: event => onChange({ model: event.target.value })
              })
            )
          ]
        }),
        jsx(Button, {
          variant: 'ghost',
          size: 'sm',
          className: 'h-6 self-start text-xs text-(--ui-text-tertiary)',
          onClick: () => setUseFreeText(false),
          children: copy('model.backToDropdowns')
        })
      ]
    })
  }

  const activeProvider = providers.find(p => p.slug === value.provider) || null
  const models = activeProvider
    ? (activeProvider.models || []).map(m => (typeof m === 'string' ? m : m.id || m.name || ''))
    : []

  return jsxs('div', {
    style: { display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '10px' },
    children: [
      labeled(
        copy('model.provider'),
        jsxs(Select, {
          value: value.provider || NONE,
          onValueChange: v => {
            if (v === NONE) {
              onChange({ provider: '', model: '' })
            } else if (v === CUSTOM) {
              setUseFreeText(true)
            } else {
              const prov = providers.find(p => p.slug === v)
              const provModels = (prov?.models || []).map(m =>
                typeof m === 'string' ? m : m.id || m.name || ''
              )
              const first = provModels[0] || ''
              onChange({
                provider: v,
                model: prov && provModels.includes(value.model) ? value.model : first
              })
            }
          },
          children: [
            jsx(SelectTrigger, { className: 'h-8 rounded-md', children: jsx(SelectValue, {}) }),
            jsxs(SelectContent, {
              children: [
                jsx(SelectItem, { value: NONE, children: copy('model.inherit') }),
                ...providers.map(p =>
                  jsx(
                    SelectItem,
                    { value: p.slug, children: p.name ? `${p.name} (${p.slug})` : p.slug },
                    p.slug
                  )
                ),
                jsx(SelectItem, { value: CUSTOM, children: copy('model.manual') })
              ]
            })
          ]
        })
      ),
      labeled(
        copy('model.model'),
        activeProvider && models.length > 0
          ? jsxs(Select, {
              value: value.model || (models[0] ?? ''),
              onValueChange: v => onChange({ model: v }),
              children: [
                jsx(SelectTrigger, { className: 'h-8 rounded-md', children: jsx(SelectValue, {}) }),
                jsx(SelectContent, {
                  children: models.map(m => jsx(SelectItem, { value: m, children: m }, m))
                })
              ]
            })
          : jsx(Input, {
              placeholder: placeholderModel || copy('model.exampleName'),
              value: value.model,
              onChange: event => onChange({ model: event.target.value })
            })
      )
    ]
  })
}

// ── advanced profile config (skills / toolsets / model / SOUL) ──────────────
//
// Shared by Edit Profile and New Agent (edit mode only for skills/toolsets —
// a not-yet-created profile has nothing installed to toggle). Backed by
// profiles.describe / profiles.configure; feature-detects older gateways.

function CheckList({ items, onToggle, columns = 2, disabled = false }) {
  return jsx('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: '2px 12px'
    },
    children: items.map(item =>
      jsxs(
        'label',
        {
          className: 'flex min-w-0 cursor-pointer items-center gap-1.5 py-0.5 text-xs text-(--ui-text-secondary)',
          title: item.description || item.name,
          children: [
            jsx(Checkbox, {
              checked: item.enabled,
              disabled,
              onCheckedChange: value => onToggle(item.name, Boolean(value))
            }),
            jsx('span', { className: 'truncate', children: item.name }),
            item.tool_count
              ? jsx('span', {
                  className: 'shrink-0 text-[0.6rem] text-(--ui-text-quaternary)',
                  children: `${item.tool_count}`
                })
              : null
          ]
        },
        item.name
      )
    )
  })
}

function agentEmbeddedCapabilitiesAvailable(component, rosterOwner, runtime = host, remoteTarget = false) {
  return Boolean(
    component &&
    !remoteTarget &&
    (typeof runtime?.connections !== 'function' || runtime?.capabilityConnectionScoped === true) &&
    rosterOwnerStillActive(rosterOwner, runtime)
  )
}

async function loadAdvancedProfileConfig(bot, rosterOwner, runtime = host) {
  const request = createRosterOwnerRequester(runtime, rosterOwner)
  const [profile, catalog, roster] = await Promise.all([
    request('profiles.describe', { name: bot }),
    request('mcp.catalog', { profile: bot }).catch(() => null),
    request('profiles.list', {}).catch(() => null)
  ])

  return { catalog, profile, protocolInjected: Boolean(roster?.bot_mode_protocol) }
}

function AdvancedProfileConfig({ bot, state, setState, rosterOwner }) {
  const copy = useAgentText()
  const [loaded, setLoaded] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const [skillFilter, setSkillFilter] = useState('')
  const liveConnectionId = useValue(host.state.connectionId)
  const liveProfile = useValue(host.state.profile)
  const liveOwner = normalizeRosterOwner(liveConnectionId, liveProfile || 'default')
  const ownerActive = sameRosterOwner(rosterOwner, liveOwner)
  const embeddedCapabilities = agentEmbeddedCapabilitiesAvailable(SkillsView, rosterOwner)

  if (!loaded && ownerActive) {
    setLoaded(true)
    loadAdvancedProfileConfig(bot, rosterOwner)
      .then(({ profile: res, catalog: cat, protocolInjected }) => {
        const configured = res.mcp_servers || []
        const have = new Set(configured.map(m => m.name))
        const catalog = ((cat && cat.servers) || []).filter(s => !have.has(s.name))
        setState(prev => ({
          ...prev,
          provider: res.model?.provider || '',
          model: res.model?.default || '',
          soul: res.soul || '',
          protocolInjected,
          skills: res.skills || [],
          toolsets: res.toolsets || [],
          mcp: [
            ...configured.map(m => ({ ...m, enabled: m.enabled !== false })),
            ...catalog.map(s => ({
              name: s.name,
              enabled: false,
              fromCatalog: true,
              installed: s.installed,
              auth: s.auth,
              requires: s.requires || [],
              description: s.description || ''
            }))
          ],
          loaded: true
        }))
      })
      .catch(() => setUnsupported(true))
  }

  if (!ownerActive) {
    return jsx('div', {
      className: 'px-2 py-3 text-center text-xs text-(--ui-text-tertiary)',
      children: copy('profile.sourceChanged')
    })
  }

  if (unsupported) {
    return jsx('div', {
      className: 'px-2 py-3 text-center text-xs text-(--ui-text-tertiary)',
      children: copy('advanced.newerGateway')
    })
  }

  if (!state.loaded) {
    return jsx('div', {
      className: 'flex justify-center py-4',
      children: jsx(GlyphSpinner, { spinner: 'breathe', className: 'text-(--ui-text-tertiary)' })
    })
  }

  const visibleSkills = skillFilter.trim()
    ? state.skills.filter(s => s.name.toLowerCase().includes(skillFilter.trim().toLowerCase()))
    : state.skills

  const toggleSkill = (name, enabled) =>
    setState(prev => ({
      ...prev,
      dirtySkills: true,
      skills: prev.skills.map(s => (s.name === name ? { ...s, enabled } : s))
    }))

  const toggleToolset = (name, enabled) =>
    setState(prev => ({
      ...prev,
      dirtyToolsets: true,
      toolsets: prev.toolsets.map(t => (t.name === name ? { ...t, enabled } : t))
    }))

  const toggleMcp = (name, enabled) =>
    setState(prev => ({
      ...prev,
      dirtyMcp: true,
      mcp: (prev.mcp || []).map(m => (m.name === name ? { ...m, enabled } : m))
    }))

  const enabledSkills = state.skills.filter(s => s.enabled).length
  const enabledToolsets = state.toolsets.filter(t => t.enabled).length
  const mcpList = state.mcp || []
  const enabledMcp = mcpList.filter(m => m.enabled).length

  // Newer desktop builds export the WHOLE core Capabilities surface
  // (hermes-agent#87317): Skills (installed list + one-click hub installs +
  // full-skill detail), Tools (per-toolset config), and MCP — pinned to this
  // bot via fixedProfile, tab state kept out of the page router via embedded.
  // Render THAT instead of the checkbox stand-ins; writes go straight to the
  // bot's backend, so the dirty-section staging below only carries
  // model + SOUL on these builds. Older builds keep the full checklist UI.
  if (embeddedCapabilities) {
    return jsxs('div', {
      className: 'grid gap-4',
      children: [
        jsx(ModelPicker, {
          rosterOwner,
          value: { provider: state.provider, model: state.model },
          onChange: patch => setState(prev => ({ ...prev, dirtyModel: true, ...patch }))
        }),
        labeled(
          copy('advanced.capabilitiesNow'),
          jsx('div', {
            className: 'overflow-hidden rounded-md border border-(--ui-stroke-secondary)',
            style: { height: 460, minHeight: 300, resize: 'vertical', overflow: 'auto' },
            children: jsx(
              SkillsView,
              { embedded: true, fixedConnectionId: rosterOwner.connectionId, fixedProfile: bot },
              `${rosterOwner.connectionId}::${bot}`
            )
          })
        ),
        labeled(
          copy('advanced.soulProtocol'),
          jsx(Textarea, {
            className: 'min-h-28 font-mono text-xs leading-5',
            value: state.soul,
            onChange: event => setState(prev => ({ ...prev, dirtySoul: true, soul: event.target.value }))
          })
        )
      ]
    })
  }

  return jsxs('div', {
    className: 'grid gap-4',
    children: [
      jsx(ModelPicker, {
        rosterOwner,
        value: { provider: state.provider, model: state.model },
        onChange: patch => setState(prev => ({ ...prev, dirtyModel: true, ...patch }))
      }),
      labeled(
        copy('advanced.skillsEnabled', enabledSkills, state.skills.length),
        jsxs('div', {
          className: 'grid gap-1.5 rounded-md border border-(--ui-stroke-secondary) p-2',
          children: [
            jsx(Input, {
              className: 'h-7 text-xs',
              placeholder: copy('advanced.filterSkills'),
              value: skillFilter,
              onChange: event => setSkillFilter(event.target.value)
            }),
            jsx(ScrollArea, {
              className: 'hermes-scroll-cap',
              style: { maxHeight: 180 },
              children: jsx(CheckList, { items: visibleSkills, onToggle: toggleSkill, columns: 2 })
            }),
            jsx(HubSkillsSection, {
              forProfile: bot,
              onInstalled: name =>
                setState(prev =>
                  prev.skills.some(s => s.name === name)
                    ? prev
                    : { ...prev, skills: [...prev.skills, { name, enabled: true }] }
                )
            })
          ]
        })
      ),
      labeled(
        copy('advanced.toolsetsEnabled', enabledToolsets, state.toolsets.length),
        jsx('div', {
          className: 'rounded-md border border-(--ui-stroke-secondary) p-2',
          children: jsx(ScrollArea, {
            className: 'hermes-scroll-cap',
            style: { maxHeight: 320 },
            children: jsx('div', {
              className: 'grid gap-1.5',
              children: state.toolsets.map(tset =>
                jsxs(
                  'div',
                  {
                    className: 'rounded-md border border-(--ui-stroke-secondary) p-2',
                    children: [
                      jsxs('label', {
                        className: 'flex items-center gap-2 text-xs font-medium text-(--ui-text-secondary)',
                        children: [
                          jsx(Checkbox, {
                            checked: !!tset.enabled,
                            onCheckedChange: value => toggleToolset(tset.name, Boolean(value))
                          }),
                          jsx('span', { children: tset.name })
                        ]
                      }),
                      // The REAL per-toolset config (env vars / API keys / model
                      // picker / post-setup), scoped to THIS bot's profile, when
                      // the desktop build exposes it. Older builds: just the toggle.
                      embeddedCapabilities && ToolsetConfigPanel
                        ? jsx('div', {
                            className: 'mt-1.5 border-t border-(--ui-stroke-secondary) pt-1.5',
                            children: jsx(ToolsetConfigPanel, { toolset: tset.name, profile: bot })
                          })
                        : null
                    ]
                  },
                  tset.name
                )
              )
            })
          })
        })
      ),
      labeled(
        copy('advanced.mcpServers'),
        jsx('div', {
          className: 'overflow-hidden rounded-md border border-(--ui-stroke-secondary)',
          // The REAL MCP tab core Settings renders — per-server enable + OAuth
          // sign-in + API-key setup + live probes — scoped to this bot's profile.
          // Feature-detected: older desktop builds without the SDK export fall
          // back to the plugin's own checkbox list + inline setup buttons.
          children: embeddedCapabilities && McpTab && typeof host.getGateway === 'function'
            ? jsx('div', {
                style: { minHeight: 220, maxHeight: 360 },
                children: jsx(McpTab, { gateway: host.getGateway(), profile: bot })
              })
            : mcpList.length === 0
              ? jsx('div', {
                  className: 'px-1 py-2 text-center text-xs text-(--ui-text-tertiary)',
                  children: copy('mcp.none')
                })
              : jsx(ScrollArea, {
                  className: 'hermes-scroll-cap',
                  style: { maxHeight: 180 },
                  children: jsx('div', {
                    className: 'grid gap-1 p-2',
                    children: mcpList.map(m => {
                      const needsSetup = m.fromCatalog && !m.installed && ((m.requires || []).length > 0 || (m.auth || '').toLowerCase() === 'oauth')
                      return jsxs(
                        'label',
                        {
                          className: 'flex items-start gap-2 text-xs text-(--ui-text-secondary)',
                          children: [
                            jsx(Checkbox, {
                              checked: !!m.enabled,
                              disabled: needsSetup,
                              onCheckedChange: value => toggleMcp(m.name, Boolean(value))
                            }),
                            jsxs('span', {
                              className: 'min-w-0',
                              children: [
                                jsx('span', { children: m.name }),
                                m.fromCatalog && !needsSetup
                                  ? jsx('span', {
                                      className: 'ml-1.5 text-[0.65rem] text-(--ui-text-quaternary)',
                                      children: m.installed ? copy('mcp.catalogInstalled') : copy('mcp.catalog')
                                    })
                                  : null,
                                needsSetup
                                  ? jsx(McpSetupButton, {
                                      profile: bot,
                                      entry: m,
                                      onDone: () => toggleMcp(m.name, true)
                                    })
                                  : null,
                                m.description
                                  ? jsx('div', {
                                      className: 'truncate text-[0.65rem] leading-4 text-(--ui-text-quaternary)',
                                      children: m.description
                                    })
                                  : null
                              ]
                            })
                          ]
                        },
                        m.name
                      )
                    })
                  })
                })
        })
      ),
      labeled(
        copy('advanced.soulProtocol'),
        jsx(Textarea, {
          className: 'min-h-28 font-mono text-xs leading-5',
          value: state.soul,
          onChange: event => setState(prev => ({ ...prev, dirtySoul: true, soul: event.target.value }))
        })
      )
    ]
  })
}

// ── skills hub section: the REAL hub page (docs) embedded as a picker ──────
// https://hermes-agent.nousresearch.com/docs/skills?embed=picker hides the
// docs chrome and adds "+ Add to this Agent" per card, posting
// {type: 'hermes-skill-pick', ...} to us (hermes-agent#86243). We validate
// the origin, install via skills.manage, and bubble onInstalled so the
// checklist above gains the row. Search-box fallback kept for offline use.

const HUB_ORIGIN = 'https://hermes-agent.nousresearch.com'
const HUB_PICKER_URL = HUB_ORIGIN + '/docs/skills?embed=picker'

function HubSkillsSection({ forProfile, onInstalled }) {
  const copy = useAgentText()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [installing, setInstalling] = useState(null)
  const [installed, setInstalled] = useState({})
  const [browseHub, setBrowseHub] = useState(false)
  const installRef = useRef(null)
  const frameRef = useRef(null)

  // Picker messages from the embedded hub page. Origin- AND source-checked —
  // only OUR frame may ask for an install (the hub origin alone would let any
  // other window on it, e.g. an OAuth popup, trigger installs too); installs
  // route through the same install() the search fallback uses.
  useEffect(() => {
    if (!browseHub) {
      return undefined
    }

    const onMessage = event => {
      if (event.origin !== HUB_ORIGIN) {
        return
      }

      if (!frameRef.current || event.source !== frameRef.current.contentWindow) {
        return
      }

      const data = event.data

      if (!data || data.type !== 'hermes-skill-pick' || !data.name) {
        return
      }

      const target = String(data.identifier || data.name)

      // Skill identifiers are slugs / owner-name paths — keep anything
      // else out of skills.manage.
      if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(target)) {
        return
      }

      if (installRef.current) {
        void installRef.current(target, String(data.name))
      }
    }

    window.addEventListener('message', onMessage)

    return () => window.removeEventListener('message', onMessage)
  }, [browseHub])

  const search = async () => {
    const q = query.trim()

    if (!q || searching) {
      return
    }

    setSearching(true)
    setResults(null)

    try {
      const res = await host.request('skills.manage', { action: 'search', query: q })
      setResults(res.results || [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const install = async (name, displayName) => {
    const label = displayName || name

    if (installing) {
      return
    }

    setInstalling(label)

    try {
      // With forProfile the install lands in that bot's skills dir
      // (gateway skills.manage profile scoping); null = launch profile,
      // which is right at create time — the new bot clones/copies from it.
      await host.request('skills.manage', {
        action: 'install',
        query: name,
        ...(forProfile ? { profile: forProfile } : {})
      })
      setInstalled(prev => ({ ...prev, [label]: true }))
      host.notify({ kind: 'success', message: copy('hub.installed', label) })

      if (typeof onInstalled === 'function') {
        onInstalled(label)
      }
    } catch (err) {
      host.notifyError(err, copy('hub.installFailed', label))
    } finally {
      setInstalling(null)
    }
  }

  installRef.current = install

  return jsxs('div', {
    className: 'grid gap-1.5 border-t border-(--ui-stroke-secondary) pt-2',
    children: [
      jsxs('div', {
        className: 'flex items-baseline justify-between gap-2',
        children: [
          jsx('div', {
            className: 'text-[0.7rem] font-medium text-(--ui-text-secondary)',
            children: copy('hub.title')
          }),
          jsx('button', {
            type: 'button',
            className: 'text-[0.65rem] text-(--ui-text-quaternary) hover:text-(--ui-text-secondary)',
            onClick: () => setBrowseHub(v => !v),
            children: browseHub ? copy('hub.hide') : copy('hub.browse')
          })
        ]
      }),
      browseHub
        ? jsxs('div', {
            className: 'grid gap-1',
            children: [
              // Resizable viewport: native CSS resize handle (bottom-right
              // corner) lets the user drag it larger/smaller. The iframe
              // inside is rendered oversized and scaled DOWN (133% × 0.75)
              // so the hub page starts zoomed out — we can't style the
              // cross-origin page itself, but scaling the frame is ours.
              jsx('div', {
                style: {
                  width: '100%',
                  height: 560,
                  minHeight: 240,
                  minWidth: 320,
                  maxWidth: '100%',
                  resize: 'both',
                  overflow: 'hidden',
                  border: '1px solid var(--ui-stroke-secondary)',
                  borderRadius: 8,
                  position: 'relative'
                },
                children: jsx('iframe', {
                  src: HUB_PICKER_URL,
                  title: copy('hub.frameTitle'),
                  ref: frameRef,
                  style: {
                    width: '133.34%',
                    height: '133.34%',
                    border: 'none',
                    background: 'transparent',
                    transform: 'scale(0.75)',
                    transformOrigin: 'top left'
                  },
                  sandbox: 'allow-scripts allow-same-origin'
                })
              }),
              jsx('div', {
                className: 'px-1 text-[0.65rem] leading-4 text-(--ui-text-quaternary)',
                children:
                  installing
                    ? copy('hub.installing', installing)
                    : copy('hub.addHint')
              })
            ]
          })
        : null,
      jsxs('div', {
        className: 'flex gap-1.5',
        children: [
          jsx(Input, {
            className: 'h-7 flex-1 text-xs',
            placeholder: copy('hub.searchPlaceholder'),
            value: query,
            onChange: event => setQuery(event.target.value),
            onKeyDown: event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void search()
              }
            }
          }),
          jsx(Button, {
            size: 'sm',
            variant: 'secondary',
            disabled: searching || !query.trim(),
            onClick: () => void search(),
            children: searching ? copy('common.searching') : copy('common.search')
          })
        ]
      }),
      searching
        ? jsx('div', {
            className: 'px-1 text-[0.65rem] text-(--ui-text-quaternary)',
            children: copy('hub.searchingHint')
          })
        : null,
      results === null
        ? null
        : results.length === 0
          ? jsx('div', {
              className: 'px-1 py-1.5 text-[0.7rem] text-(--ui-text-quaternary)',
              children: copy('hub.noMatch')
            })
          : jsx(ScrollArea, {
              className: 'hermes-scroll-cap',
              style: { maxHeight: 150 },
              children: jsx('div', {
                className: 'grid gap-1',
                children: results.map(r =>
                  jsxs(
                    'div',
                    {
                      className: 'flex items-center gap-2 text-xs',
                      children: [
                        jsxs('div', {
                          className: 'min-w-0 flex-1',
                          children: [
                            jsx('div', { className: 'truncate font-medium', children: r.name }),
                            r.description
                              ? jsx('div', {
                                  className: 'truncate text-[0.65rem] text-(--ui-text-quaternary)',
                                  children: r.description
                                })
                              : null
                          ]
                        }),
                        installed[r.name]
                          ? jsx('span', {
                              className: 'shrink-0 text-[0.65rem] text-(--ui-text-tertiary)',
                              children: copy('hub.added')
                            })
                          : jsx(Button, {
                              size: 'sm',
                              variant: 'ghost',
                              className: 'shrink-0 px-2 font-semibold',
                              disabled: installing !== null,
                              title: copy('hub.installTitle', r.name),
                              onClick: () => void install(r.name),
                              children: installing === r.name ? '…' : '+'
                            })
                      ]
                    },
                    r.name
                  )
                )
              })
            })
    ]
  })
}

function emptyAdvancedState() {
  return {
    loaded: false,
    provider: '',
    model: '',
    soul: '',
    skills: [],
    toolsets: [],
    mcp: [],
    dirtyModel: false,
    dirtySoul: false,
    dirtySkills: false,
    dirtyToolsets: false,
    dirtyMcp: false,
    protocolInjected: false
  }
}

/** Persist only the dirty sections of the advanced editor. */
async function applyAdvancedConfig(bot, state, expectedOwner = null) {
  const payload = { name: bot }
  const applied = {}

  if (expectedOwner && !rosterOwnerStillActive(expectedOwner)) {
    return { applied, ok: false, sourceChanged: true }
  }

  if (state.dirtySoul) {
    payload.soul = ensureMessagingProtocol(state.soul, bot, $lastRoster.get(), state.protocolInjected)
  }

  if (state.dirtyModel) {
    const model = state.model.trim()
    const provider = state.provider.trim()

    if (model && provider) {
      payload.model = model
      payload.provider = provider
    } else if (!model && !provider) {
      try {
        const result = await host.request('cli.exec', {
          argv: ['--profile', bot, 'config', 'unset', 'model']
        })

        if (expectedOwner && !rosterOwnerStillActive(expectedOwner)) {
          return { applied, ok: false, sourceChanged: true }
        }

        applied.model = result?.blocked !== true && result?.code === 0
      } catch {
        applied.model = false
      }
    } else {
      applied.model = false
    }
  }

  if (state.dirtySkills) {
    payload.disabled_skills = state.skills.filter(s => !s.enabled).map(s => s.name)
  }

  if (state.dirtyToolsets) {
    const all = state.toolsets.length
    const enabled = state.toolsets.filter(t => t.enabled)
    // All enabled (or none) = clear the pin; otherwise pin the checked set.
    payload.enabled_toolsets = enabled.length === all || enabled.length === 0 ? [] : enabled.map(t => t.name)
  }

  if (state.dirtyMcp) {
    payload.enabled_mcp_servers = (state.mcp || []).filter(m => m.enabled).map(m => m.name)
  }

  if (Object.keys(payload).length === 1) {
    if (Object.values(applied).some(Boolean)) {
      invalidateAgentDescription(bot)
    }

    return { ok: Object.values(applied).every(Boolean), applied }
  }

  if (expectedOwner && !rosterOwnerStillActive(expectedOwner)) {
    return { applied, ok: false, sourceChanged: true }
  }

  const result = await host.request('profiles.configure', payload)
  const merged = { ...applied, ...(result?.applied || {}) }
  invalidateAgentDescription(bot)

  return { ...result, ok: Object.values(merged).every(Boolean), applied: merged }
}

// ── edit profile dialog ──────────────────────────────────────────────────────

function labeled(label, control) {
  return jsxs('div', {
    className: 'grid gap-1.5',
    children: [
      jsx('label', {
        className: 'text-xs font-medium text-(--ui-text-secondary)',
        children: label
      }),
      control
    ]
  })
}

function EditProfileDialog({ bot, open, onClose }) {
  const copy = useAgentText()
  const metaAll = useValue($botMeta)
  const meta = bot ? botRosterMeta(bot, metaAll, bot.actionOwner) : null
  const appearance = bot ? botAppearance(bot.name, meta) : { shape: 'circle', color: AVATAR_COLORS[3] }
  const [shape, setShape] = useState(appearance.shape)
  const [color, setColor] = useState(appearance.color)
  const [image, setImage] = useState(appearance.image)
  const [title, setTitle] = useState(meta?.title || '')
  const [description, setDescription] = useState(bot?.description || '')
  const [busy, setBusy] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [adv, setAdv] = useState(emptyAdvancedState())

  // Re-seed local state each time a different bot opens the dialog.
  const [seedKey, setSeedKey] = useState(null)
  const currentKey = bot ? `${bot.name}:${open}` : null
  if (currentKey !== seedKey) {
    setSeedKey(currentKey)
    if (bot && open) {
      setShape(appearance.shape)
      setColor(appearance.color)
      setImage(appearance.image)
      setTitle(meta?.title || '')
      setDescription(bot.description || '')
      setBusy(false)
      setAdvanced(false)
      setAdv(emptyAdvancedState())
    }
  }

  if (!bot) {
    return null
  }

  const submit = async () => {
    if (busy) {
      return
    }

    if (
      !agentProfileActionMatchesOwner(bot, {
        connectionId: host.state.connectionId?.get?.() || 'local',
        profile: host.state.profile?.get?.() || 'default'
      })
    ) {
      host.notify({ kind: 'error', message: copy('profile.sourceChanged') })
      onClose()
      return
    }

    setBusy(true)
    let advancedFailed = false
    const expectedOwner = normalizeRosterOwner(bot.actionOwner?.connectionId, bot.actionOwner?.profile)
    const persistence = await saveBotMeta(
      bot.name,
      {
        shape,
        color,
        image,
        imageKind: image ? 'photo' : 'shape',
        title: title.trim(),
        custom: true
      },
      meta,
      expectedOwner
    )

    if (!rosterOwnerStillActive(expectedOwner)) {
      host.notify({ kind: 'error', message: copy('profile.sourceChanged') })
      setBusy(false)
      onClose()
      return
    }
    // Only an explicit remote failure is an error — 'unsupported' is the
    // documented older-gateway fallback (local wins, silently), and toasting
    // it would flag every save on every legacy setup forever.
    const lookFailed = persistence.serverOutcome === 'failed'

    if (lookFailed) {
      host.notify({ kind: 'error', message: copy('edit.localLookFailed') })
    }
    if (persistence.serverOutcome === 'persisted') {
      queryClient.invalidateQueries({ queryKey: ROSTER_KEY })
    }

    const desc = description.trim()
    if (desc !== (bot.description || '').trim()) {
      if (!rosterOwnerStillActive(expectedOwner)) {
        host.notify({ kind: 'error', message: copy('profile.sourceChanged') })
        setBusy(false)
        onClose()
        return
      }

      try {
        await host.request('cli.exec', {
          argv: ['profile', 'describe', bot.name, '--text', desc]
        })

        if (!rosterOwnerStillActive(expectedOwner)) {
          host.notify({ kind: 'error', message: copy('profile.sourceChanged') })
          setBusy(false)
          onClose()
          return
        }
        invalidateAgentDescription(bot.name)
        queryClient.invalidateQueries({ queryKey: ROSTER_KEY })
      } catch (err) {
        host.notifyError(err, copy('edit.descriptionFailed'))
      }
    }

    if (adv.loaded && (adv.dirtyModel || adv.dirtySoul || adv.dirtySkills || adv.dirtyToolsets || adv.dirtyMcp)) {
      try {
        const res = await applyAdvancedConfig(bot.name, adv, expectedOwner)

        if (res?.sourceChanged || !rosterOwnerStillActive(expectedOwner)) {
          host.notify({ kind: 'error', message: copy('profile.sourceChanged') })
          setBusy(false)
          onClose()
          return
        }

        const failed = Object.entries(res?.applied || {}).filter(([, ok]) => !ok)

        if (failed.length) {
          advancedFailed = true
          host.notify({ kind: 'error', message: copy('edit.sectionsFailed', failed.map(([k]) => k).join(', ')) })
        }
      } catch (err) {
        advancedFailed = true
        host.notifyError(err, copy('edit.advancedFailed'))
      }
    }

    if (!advancedFailed && !lookFailed) {
      host.notify({ kind: 'success', message: copy('edit.updated', displayName(bot, { title })) })
    }
    setBusy(false)
    onClose()
  }

  return jsx(Dialog, {
    open,
    onOpenChange: value => !value && !busy && onClose(),
    children: jsxs(DialogContent, {
      className: advanced ? 'max-w-3xl' : 'max-w-sm',
      // Same resizable-window treatment as the create dialog.
      style: advanced
        ? { resize: 'both', overflow: 'auto', minWidth: 420, minHeight: 360, maxWidth: '95vw', maxHeight: '90vh' }
        : undefined,
      children: [
        jsxs(DialogHeader, {
          children: [
            jsx(DialogTitle, { children: copy('edit.title') }),
            jsx(DialogDescription, { children: copy('edit.description', displayName(bot, null), bot.name) })
          ]
        }),
        jsxs('div', {
          className: 'grid gap-4',
          children: [
            jsx('div', {
              className: 'flex justify-center py-1',
              children: jsx(BotFace, { shape, color, image, size: 64, name: bot.name })
            }),
            jsx(AvatarPicker, {
              shape,
              color,
              image,
              onShape: setShape,
              onColor: setColor,
              onImage: setImage,
              generateSeed: { name: bot.name, title, description }
            }),
            labeled(
              copy('edit.nameTitle'),
              jsx(Input, {
                placeholder: displayName(bot, null),
                value: title,
                onChange: event => setTitle(event.target.value)
              })
            ),
            labeled(
              copy('edit.descriptionLabel'),
              jsx(Textarea, {
                className: 'min-h-16',
                placeholder: copy('edit.descriptionPlaceholder'),
                value: description,
                onChange: event => setDescription(event.target.value)
              })
            ),
            jsxs('button', {
              type: 'button',
              className:
                'flex items-center gap-1 text-xs font-medium text-(--ui-text-tertiary) hover:text-(--ui-text-secondary)',
              onClick: () => setAdvanced(v => !v),
              children: [
                jsx(Codicon, { name: advanced ? 'chevron-down' : 'chevron-right', className: 'text-[0.8rem]' }),
                copy('edit.advanced')
              ]
            }),
            advanced
              ? jsx('div', {
                  className: 'rounded-md border border-(--ui-stroke-secondary) p-3',
                  children: jsx(AdvancedProfileConfig, {
                    bot: bot.name,
                    state: adv,
                    setState: setAdv,
                    rosterOwner: bot.actionOwner
                  })
                })
              : null
          ]
        }),
        jsxs(DialogFooter, {
          children: [
            jsx(Button, { variant: 'ghost', disabled: busy, onClick: onClose, children: copy('common.cancel') }),
            jsx(Button, { disabled: busy, onClick: submit, children: busy ? copy('common.saving') : copy('common.save') })
          ]
        })
      ]
    })
  })
}

// ── create dialog ────────────────────────────────────────────────────────────

function CreateAgentDialog({ open, onClose, roster }) {
  const copy = useAgentText()
  const liveConnectionId = useValue(host.state.connectionId)
  const liveProfile = useValue(host.state.profile)
  const [name, setName] = useState('')
  // Create mode: the profile is created LAZILY. Capability toggles are staged in
  // component state; the profile is materialized either on Create (submit) or on
  // the first MCP credential setup (ensureAgentCreated), whichever comes first —
  // so OAuth / API-key setup works DURING creation, not only after in Edit.
  const draftLifecycleRef = useRef(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [shape, setShape] = useState('circle')
  const [color, setColor] = useState(AVATAR_COLORS[3])
  const [image, setImage] = useState(null)
  const [advanced, setAdvanced] = useState(false)
  const [cloneFrom, setCloneFrom] = useState('default')
  const [model, setModel] = useState('')
  const [provider, setProvider] = useState('')
  const [soul, setSoul] = useState('')
  const [noSkills, setNoSkills] = useState(false)
  const [shareAuth, setShareAuth] = useState(DEFAULT_SHARE_AUTH)
  const [advTab, setAdvTab] = useState('general')
  // Where the profile is created: '' = the active gateway (unchanged default),
  // else a registry connection id — the profiles.create lands on THAT
  // machine's backend via host.requestProfile, no gateway switch. Only
  // rendered when the desktop has a multi-connection registry.
  const [targetConnection, setTargetConnection] = useState('')
  const [connections, setConnections] = useState(null)

  useEffect(() => {
    if (!open || connections !== null || typeof host.connections !== 'function' || typeof host.requestProfile !== 'function') {
      return
    }

    host
      .connections()
      .then(value => setConnections(normalizeAgentConnections(value)))
      .catch(() => setConnections([]))
  }, [open, connections])

  const activeConnectionId = String(liveConnectionId || '').trim()
  // Remote target = an explicitly picked registry connection that is not the
  // one this window is already on.
  const remoteTarget = Boolean(targetConnection) && targetConnection !== (activeConnectionId || 'local')
  const targetLabel = remoteTarget
    ? (connections || []).find(c => c.id === targetConnection)?.label || targetConnection
    : ''

  // Set once ensureAgentCreated() materializes the profile for the live
  // Capabilities tab (SkillsView needs a real backend to point at). State —
  // not just lifecycle state — because the render must flip when it lands.
  const [createdForCaps, setCreatedForCaps] = useState(null)
  const [caps, setCaps] = useState(null)
  const [capsFailedScope, setCapsFailedScope] = useState('')
  const capsRequestStateRef = useRef({ scopeKey: '', generation: 0, pending: false })
  const [dirtyCaps, setDirtyCaps] = useState({ skills: false, toolsets: false, mcp: false })
  const [capFilter, setCapFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [draftLock, setDraftLock] = useState(null)

  const slug = slugify(name)
  const valid = slug.length > 0 && NAME_RE.test(slug)
  const targetConnectionRecord = (connections || []).find(connection => connection.id === (targetConnection || activeConnectionId))
  const targetMode = targetConnectionRecord?.kind === 'local' ? 'local' : targetConnectionRecord ? 'remote' : null
  const capSource = cloneFrom === '__none__' ? 'default' : cloneFrom
  const modelRosterOwner = normalizeRosterOwner(
    remoteTarget ? targetConnection : activeConnectionId || 'local',
    remoteTarget ? 'default' : liveProfile || 'default'
  )
  const capabilityScopeKey = agentCapabilityCatalogScopeKey(modelRosterOwner, capSource)

  if (capsRequestStateRef.current.scopeKey !== capabilityScopeKey) {
    capsRequestStateRef.current = {
      scopeKey: capabilityScopeKey,
      generation: capsRequestStateRef.current.generation + 1,
      pending: false
    }
  }

  const resetCapabilityCatalog = () => {
    capsRequestStateRef.current = {
      scopeKey: '',
      generation: capsRequestStateRef.current.generation + 1,
      pending: false
    }
    setCaps(null)
    setCapsFailedScope('')
    setDirtyCaps({ skills: false, toolsets: false, mcp: false })
  }

  const embeddedCapabilities = agentEmbeddedCapabilitiesAvailable(
    SkillsView,
    modelRosterOwner,
    host,
    remoteTarget
  )
  const creationLocked = agentCreationFieldsLocked(draftLock)
  const createdSlug = draftLifecycleRef.current?.created()?.slug || null

  const cleanupDraft = async draft => {
    try {
      const result = await requestAgentDraft(host, draft, 'cli.exec', {
        argv: ['profile', 'delete', draft.slug, '--yes']
      })

      if (result?.blocked || result?.code !== 0) {
        throw new Error(result?.hint || result?.output || copy('profile.deleteFailed', draft.slug))
      }

      const currentSource = String(host.state.connectionId?.get?.() || 'local').trim() || 'local'

      if (!draft.remoteTarget && currentSource === draft.connectionId) {
        const meta = { ...$botMeta.get() }
        delete meta[draft.slug]
        $botMeta.set(meta)
        void Promise.resolve(pluginCtx?.storage?.set?.('bot-meta', meta)).catch(() => undefined)
      }

      queryClient.invalidateQueries({ queryKey: ROSTER_KEY })
      host.notify({ kind: 'success', message: copy('profile.draftDiscarded', draft.slug) })
    } catch (error) {
      host.notifyError(error, copy('profile.draftCleanupFailed', draft.slug))
    }
  }

  if (!draftLifecycleRef.current) {
    draftLifecycleRef.current = createAgentDraftLifecycle({ cleanup: cleanupDraft, onChange: setDraftLock })
  }

  // Once the draft profile is materialized (Capabilities tab / MCP setup) it
  // shows up in the roster — its OWN slug must not read as "taken".
  // A remote-target create is gated by the TARGET machine's roster: a local
  // name clash is fine there, and the remote's own duplicate check rejects
  // real collisions at profiles.create time.
  const taken = remoteTarget
    ? roster.some(b => b.remoteSource && b.connectionId === targetConnection && b.name === slug && b.name !== createdSlug)
    : roster.some(b => !b.remoteSource && b.name === slug && b.name !== createdSlug)

  // Draft semantics for the lazily-created profile: opening the Capabilities
  // tab (or running MCP setup) materializes the profile so the LIVE config
  // surfaces have a real backend to write to — but until the user hits
  // Create Agent it is a DRAFT. Cancelling the dialog deletes it, so
  // preconfigure-then-back-out leaves zero residue. Best-effort and
  // fire-and-forget: a failed cleanup surfaces a toast, never blocks close.
  const discardDraft = () => {
    void draftLifecycleRef.current?.cancel()
  }

  const reset = () => {
    setName('')
    setTitle('')
    setDescription('')
    setShape('circle')
    setColor(AVATAR_COLORS[3])
    setImage(null)
    setAdvanced(false)
    // Same default as the initial useState — resetting to '__none__' made
    // the second agent you create silently start from a fresh profile
    // instead of cloning the main one like the first dialog open did.
    setCloneFrom('default')
    setModel('')
    setProvider('')
    setSoul('')
    setNoSkills(false)
    setShareAuth(DEFAULT_SHARE_AUTH)
    setAdvTab('general')
    setCreatedForCaps(null)
    resetCapabilityCatalog()
    setCapFilter('')
    setTargetConnection('')
    setBusy(false)
    setError(null)
  }

  // Capability catalog for the tabs: the profile doesn't exist yet, so show
  // what it WILL have — the clone source's catalog, else the main profile's.
  const ensureCaps = () => {
    const currentRequest = capsRequestStateRef.current

    if (
      !capabilityScopeKey ||
      caps?.scopeKey === capabilityScopeKey ||
      capsFailedScope === capabilityScopeKey ||
      (currentRequest.scopeKey === capabilityScopeKey && currentRequest.pending)
    ) {
      return
    }

    const token = {
      scopeKey: capabilityScopeKey,
      generation: currentRequest.generation + 1
    }
    capsRequestStateRef.current = { ...token, pending: true }
    const request = createRosterOwnerRequester(host, modelRosterOwner)
    const describeName = remoteTarget ? 'default' : capSource

    void loadAgentCapabilityCatalog(
      request,
      token,
      capSource,
      describeName,
      pending => agentCapabilityCatalogRequestCurrent(pending, capsRequestStateRef.current)
    )
      .then(nextCaps => {
        if (!agentCapabilityCatalogRequestCurrent(token, capsRequestStateRef.current)) {
          return
        }

        capsRequestStateRef.current = { ...token, pending: false }
        if (nextCaps) {
          setCaps(nextCaps)
        }
      })
      .catch(() => {
        if (agentCapabilityCatalogRequestCurrent(token, capsRequestStateRef.current)) {
          capsRequestStateRef.current = { ...token, pending: false }
          setCapsFailedScope(token.scopeKey)
        }
      })
  }

  const toggleCap = (kind, name, enabled) => {
    setDirtyCaps(prev => ({ ...prev, [kind === 'mcp' ? 'mcp' : kind]: true }))
    setCaps(prev =>
      prev
        ? { ...prev, [kind]: prev[kind].map(x => (x.name === name ? { ...x, enabled } : x)) }
        : prev
    )
  }

  // Materialize exactly once through an immutable owner descriptor. The
  // lifecycle shares concurrent triggers and cleans a late result after a
  // Cancel generation edge without consulting mutable form state.
  const ensureAgentCreated = () => {
    if (!valid || taken) {
      return Promise.resolve(null)
    }

    const provenance = createAgentDraftProvenance({
      slug,
      remoteTarget,
      targetConnectionId: targetConnection,
      activeConnectionId: activeConnectionId || 'local',
      activeProfile: host.state.profile.get?.() || 'default',
      targetMode
    })
    const descriptionText = [title, description].filter(Boolean).join(' — ')
    const createPayload = {
      name: slug,
      description: descriptionText,
      // Clone sources are profiles of the TARGET backend. The picker's
      // roster is the local one, so a remote create always starts from the
      // remote machine's default (or fresh) — never a local profile name
      // the remote box doesn't have.
      clone_from: cloneFrom === '__none__' ? null : remoteTarget ? 'default' : cloneFrom,
      no_skills: noSkills,
      // Shared (not copied) auth keeps ONE OAuth/token pool with the main
      // profile, so refreshes can't invalidate each other. The create result
      // must explicitly confirm this contract; older gateways that ignore
      // the flag are cleaned up instead of silently forking credentials.
      ...agentCreateAuthPayload(shareAuth),
      ...(model.trim() && provider.trim() ? { model: model.trim(), provider: provider.trim() } : {})
    }
    const appearance = {
      shape,
      color,
      image,
      imageKind: image ? 'photo' : 'shape',
      title: title.trim(),
      created: Date.now()
    }

    return draftLifecycleRef.current.ensure(
      provenance,
      async draft => {
        const protocolInjected = await agentDraftProtocolInjected(host, draft)

        return requestAgentDraft(host, draft, 'profiles.create', {
          ...createPayload,
          soul: composeSoul({ name: slug, title, description, roster, customSoul: soul, protocolInjected })
        })
      },
      async (draft, isCurrent) => {
        // Apply capability picks from the Advanced tabs (best-effort; the
        // profile exists either way and Edit Profile can finish the job).
        try {
          const capPayload = {}

          const currentCaps = caps?.scopeKey === capabilityScopeKey ? caps : null

          if (dirtyCaps.skills && currentCaps) {
            capPayload.disabled_skills = currentCaps.skills.filter(s => !s.enabled).map(s => s.name)
          }
          if (dirtyCaps.toolsets && currentCaps) {
            const en = currentCaps.toolsets.filter(t => t.enabled)
            capPayload.enabled_toolsets =
              en.length === currentCaps.toolsets.length || en.length === 0 ? [] : en.map(t => t.name)
          }
          if (dirtyCaps.mcp && currentCaps) {
            capPayload.enabled_mcp_servers = currentCaps.mcp.filter(m => m.enabled).map(m => m.name)
          }
          if (isCurrent() && Object.keys(capPayload).length) {
            await requestAgentDraft(host, draft, 'profiles.configure', { name: draft.slug, ...capPayload })
          }
        } catch {
          /* capability application is best-effort */
        }

        if (!isCurrent()) {
          return
        }

        // Appearance always follows the same immutable route as create. This
        // is required even when the target was the active source at click
        // time: the user can switch A -> B while profiles.create is in flight.
        await applyAgentDraftAppearance(host, draft, appearance)

        if (isCurrent()) {
          queryClient.invalidateQueries({ queryKey: ROSTER_KEY })
        }
      },
      result => {
        if (!agentSharedAuthCreateResultAccepted(result, shareAuth)) {
          throw new Error('shared_auth_not_supported')
        }
      }
    )
  }

  const submit = async () => {
    if (!valid || taken || busy) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      const slugCreated = await ensureAgentCreated()
      if (!slugCreated) {
        setBusy(false)
        setError(copy('create.createFailed'))
        return
      }

      const createdDraft = draftLifecycleRef.current?.created()
      const finalizePlan = agentDraftFinalizePlan(createdDraft, currentBotMetaOwner())
      const canonicalOwner = normalizeRosterOwner(createdDraft?.connectionId, createdDraft?.route?.profile)

      if (!createdDraft || !finalizePlan.slug) {
        setBusy(false)
        setError(copy('create.createFailed'))
        return
      }

      host.notify({
        kind: 'success',
        message: finalizePlan.remotePresentation
          ? copy(
              'create.createdOn',
              displayName({ name: finalizePlan.slug, title }),
              createdDraft.remoteTarget ? targetLabel || finalizePlan.connectionId : finalizePlan.connectionId
            )
          : copy('create.created', displayName({ name: finalizePlan.slug, title }))
      })
      draftLifecycleRef.current?.finalize()
      reset()
      onClose()

      if (!finalizePlan.openCanonical) {
        // The bot lives on another machine: it appears in the roster via the
        // union enumeration. A source switch during creation also lands here:
        // fail closed instead of opening/pinning a same-named profile on the
        // newly active backend.
        queryClient.invalidateQueries({ queryKey: ROSTER_KEY })
        return
      }

      $selectedBot.set(finalizePlan.slug)

      // Birth the bot's forever chat right away: it introduces itself as
      // the first thing the user sees, and the pin exists from minute one.
      try {
        // Creates, pins, opens, and kicks off the intro in one flow.
        const sid = await createCanonicalChat(finalizePlan.slug, canonicalOwner)

        if (!sid && rosterOwnerStillActive(canonicalOwner) && typeof host.newChat === 'function') {
          host.newChat(finalizePlan.slug)
        }
      } catch {
        if (rosterOwnerStillActive(canonicalOwner) && typeof host.newChat === 'function') {
          host.newChat(finalizePlan.slug)
        }
      }
    } catch (err) {
      setBusy(false)
      const message = err instanceof Error ? err.message : String(err)
      setError(
        message.includes('shared_auth_pool_unavailable')
          ? copy('create.sharedAuthUnavailable')
          : message.includes('shared_auth_not_supported')
            ? copy('create.sharedAuthUnsupported')
            : message
      )
    }
  }

  return jsx(Dialog, {
    open,
    onOpenChange: value => {
      if (!value && !busy) {
        // Cancel path (esc / overlay click): a materialized draft profile is
        // discarded — preconfigure-then-back-out leaves nothing behind.
        discardDraft()
        reset()
        onClose()
      }
    },
    children: jsxs(DialogContent, {
      className: advanced ? 'max-w-3xl' : 'max-w-md',
      // Native resize handle (bottom-right corner): the dialog becomes a
      // window the user can grow/shrink. overflow:auto is required for CSS
      // resize to engage; caps keep it on screen.
      style: advanced
        ? { resize: 'both', overflow: 'auto', minWidth: 420, minHeight: 360, maxWidth: '95vw', maxHeight: '90vh' }
        : undefined,
      children: [
        jsxs(DialogHeader, {
          children: [
            jsx(DialogTitle, { children: copy('create.title') }),
            jsx(DialogDescription, {
              children: copy('create.description')
            })
          ]
        }),
        jsxs('div', {
          className: 'grid gap-3.5',
          children: [
            jsx('div', {
              className: 'flex justify-center py-1',
              children: jsx(BotFace, { shape, color, image, size: 56, name: slug || 'agent' })
            }),
            jsx('div', {
              'aria-disabled': creationLocked || undefined,
              className: creationLocked ? 'pointer-events-none opacity-65' : undefined,
              inert: creationLocked ? '' : undefined,
              children: jsx(AvatarPicker, {
                shape,
                color,
                image,
                onShape: setShape,
                onColor: setColor,
                onImage: setImage,
                generateSeed: { name: slug || 'agent', title, description }
              })
            }),
            labeled(
              copy('create.name'),
              jsx(Input, {
                autoFocus: true,
                placeholder: copy('create.namePlaceholder'),
                value: name,
                disabled: creationLocked,
                onChange: event => setName(event.target.value)
              })
            ),
            taken
              ? jsx('div', {
                  className: 'text-xs text-(--ui-accent)',
                  children: remoteTarget
                    ? copy('create.duplicateRemote', slug, targetLabel)
                    : copy('create.duplicateLocal', slug)
                })
              : null,
            // Multi-connection desktops choose WHERE the agent lives. Hidden
            // on single-connection setups — the active gateway is the only
            // possible home, exactly the old behavior.
            Array.isArray(connections) && connections.length > 1
              ? labeled(
                  copy('create.createOn'),
                  jsxs(Select, {
                    disabled: creationLocked,
                    value: targetConnection || activeConnectionId || 'local',
                    onValueChange: value => {
                      setTargetConnection(value === (activeConnectionId || 'local') ? '' : value)
                      // The capability catalog and clone list belong to the
                      // target backend — refetch for the new home. The live
                      // Capabilities tab only exists for the active gateway.
                      resetCapabilityCatalog()
                      setAdvTab('general')
                    },
                    children: [
                      jsx(SelectTrigger, {
                        className: 'h-8 rounded-md',
                        children: jsx(SelectValue, {})
                      }),
                      jsx(SelectContent, {
                        children: connections.map(connection =>
                          jsx(
                            SelectItem,
                            {
                              value: connection.id,
                              children:
                                connection.id === (activeConnectionId || 'local')
                                  ? copy('create.current', connection.label || connection.id)
                                  : connection.label || connection.id
                            },
                            connection.id
                          )
                        )
                      })
                    ]
                  })
                )
              : null,
            remoteTarget
              ? jsx('div', {
                  className: 'text-[0.7rem] leading-5 text-(--ui-text-tertiary)',
                  children: copy('create.remoteHelp', targetLabel)
                })
              : null,
            labeled(
              copy('create.titleLabel'),
              jsx(Input, {
                placeholder: copy('create.titlePlaceholder'),
                value: title,
                disabled: creationLocked,
                onChange: event => setTitle(event.target.value)
              })
            ),
            labeled(
              copy('create.descriptionLabel'),
              jsx(Textarea, {
                className: 'min-h-16',
                placeholder: copy('create.descriptionPlaceholder'),
                value: description,
                disabled: creationLocked,
                onChange: event => setDescription(event.target.value)
              })
            ),
            jsxs('button', {
              type: 'button',
              className:
                'flex items-center gap-1 text-xs font-medium text-(--ui-text-tertiary) hover:text-(--ui-text-secondary)',
              onClick: () => {
                setAdvanced(v => {
                  if (!v) {
                    ensureCaps()
                  }
                  return !v
                })
              },
              children: [
                jsx(Codicon, { name: advanced ? 'chevron-down' : 'chevron-right', className: 'text-[0.8rem]' }),
                copy('create.advanced')
              ]
            }),
            advanced
              ? jsxs('div', {
                  className: 'grid gap-3 rounded-md border border-(--ui-stroke-secondary) p-3',
                  children: [
                    jsx('div', {
                      className: 'flex gap-1',
                      // Newer desktops export the whole Capabilities surface —
                      // one live tab replaces the three staged checklists.
                      // The live Capabilities surface (SkillsView) binds to
                      // the ACTIVE gateway's backend — a remote-target draft
                      // lives elsewhere, so it keeps the staged checklists
                      // (their catalog reads already route to the target).
                      children: (embeddedCapabilities
                        ? [
                            ['general', copy('create.general')],
                            ['capabilities', copy('create.capabilities')]
                          ]
                        : [
                            ['general', copy('create.general')],
                            ['skills', copy('create.skills')],
                            ['toolsets', copy('create.tools')],
                            ['mcp', copy('create.mcp')]
                          ]
                      ).map(([id, label]) =>
                        jsx(
                          'button',
                          {
                            type: 'button',
                            className: cn(
                              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                              advTab === id
                                ? 'bg-(--chrome-action-hover) text-(--ui-text-primary)'
                                : 'text-(--ui-text-tertiary) hover:text-(--ui-text-secondary)'
                            ),
                            onClick: () => {
                              setAdvTab(id)
                              setCapFilter('')
                              if (id === 'capabilities') {
                                // The live surface needs a real profile —
                                // materialize it now (same lazy-create door
                                // the MCP setup buttons use).
                                void ensureAgentCreated()
                                  .then(created => created && setCreatedForCaps(created))
                                  .catch(err => host.notifyError(err, copy('create.profileNotReady')))
                              } else if (id !== 'general') {
                                ensureCaps()
                              }
                            },
                            children: label
                          },
                          id
                        )
                      )
                    }),
                    advTab === 'general'
                      ? jsxs('fieldset', {
                          className: 'grid min-w-0 gap-3.5 border-0 p-0',
                          disabled: creationLocked,
                          children: [
                            labeled(
                              remoteTarget ? copy('create.cloneOn', targetLabel) : copy('create.clone'),
                              jsxs(Select, {
                                disabled: remoteTarget || creationLocked,
                                value: remoteTarget ? 'default' : cloneFrom,
                                onValueChange: value => {
                                  setCloneFrom(value)
                                  resetCapabilityCatalog()
                                },
                                children: [
                                  jsx(SelectTrigger, {
                                    className: 'h-8 rounded-md',
                                    children: jsx(SelectValue, {})
                                  }),
                                  jsxs(SelectContent, {
                                    children: [
                                      jsx(SelectItem, {
                                        value: '__none__',
                                        children: copy('create.fresh')
                                      }),
                                      ...roster.map(b => jsx(SelectItem, { value: b.name, children: b.name }, b.name))
                                    ]
                                  })
                                ]
                              })
                            ),
                            jsx(ModelPicker, {
                              rosterOwner: modelRosterOwner,
                              value: { provider, model },
                              onChange: patch => {
                                if ('provider' in patch) {
                                  setProvider(patch.provider)
                                }
                                if ('model' in patch) {
                                  setModel(patch.model)
                                }
                              },
                              placeholderModel: copy('model.inherited')
                            }),
                            labeled(
                              copy('create.soul'),
                              jsx(Textarea, {
                                className: 'min-h-24 font-mono text-xs leading-5',
                                placeholder:
                                  copy('create.soulHint'),
                                value: soul,
                                onChange: event => setSoul(event.target.value)
                              })
                            ),
                            jsxs('label', {
                              className: 'flex items-center gap-2 text-xs text-(--ui-text-secondary)',
                              children: [
                                jsx(Checkbox, {
                                  checked: shareAuth,
                                  onCheckedChange: value => setShareAuth(Boolean(value))
                                }),
                                copy('create.shareAuth')
                              ]
                            }),
                            jsx('div', {
                              className: 'pl-6 pt-0.5 text-[0.7rem] leading-5 text-(--ui-text-tertiary)',
                              children: copy('create.shareAuthHelp')
                            }),
                            jsxs('label', {
                              className: 'flex items-center gap-2 text-xs text-(--ui-text-secondary)',
                              children: [
                                jsx(Checkbox, {
                                  checked: noSkills,
                                  onCheckedChange: value => setNoSkills(Boolean(value))
                                }),
                                copy('create.empty')
                              ]
                            })
                          ]
                        })
                      : advTab === 'capabilities' && embeddedCapabilities
                        ? !valid || taken
                          ? jsx('div', {
                              className: 'px-2 py-3 text-center text-xs text-(--ui-text-tertiary)',
                              children: taken
                                ? copy('create.nameTakenCaps')
                                : copy('create.nameFirstCaps')
                            })
                          : !createdForCaps
                            ? jsx('div', {
                                className: 'flex justify-center py-4',
                                children: jsx(GlyphSpinner, {
                                  spinner: 'breathe',
                                  className: 'text-(--ui-text-tertiary)'
                                })
                              })
                            : jsx('div', {
                                className: 'overflow-hidden rounded-md border border-(--ui-stroke-secondary)',
                                style: { height: 440, minHeight: 280, resize: 'vertical', overflow: 'auto' },
                                // The REAL core Capabilities surface (skills +
                                // one-click hub installs + tools + MCP), pinned
                                // to the just-created profile. Writes land
                                // immediately — no staging needed.
                                children: jsx(
                                  SkillsView,
                                  {
                                    embedded: true,
                                    fixedConnectionId: modelRosterOwner.connectionId,
                                    fixedProfile: createdForCaps
                                  },
                                  `${modelRosterOwner.connectionId}::${createdForCaps}`
                                )
                              })
                      : capsFailedScope === capabilityScopeKey
                        ? jsx('div', {
                            className: 'px-2 py-3 text-center text-xs text-(--ui-text-tertiary)',
                            children:
                              copy('advanced.catalogNeedsGateway')
                          })
                        : !caps || caps.scopeKey !== capabilityScopeKey
                          ? jsx('div', {
                              className: 'flex justify-center py-4',
                              children: jsx(GlyphSpinner, {
                                spinner: 'breathe',
                                className: 'text-(--ui-text-tertiary)'
                              })
                            })
                          : advTab === 'skills'
                            ? noSkills
                              ? jsx('div', {
                                  className: 'px-2 py-3 text-center text-xs text-(--ui-text-tertiary)',
                                  children: copy('advanced.emptySkills')
                                })
                              : jsxs('div', {
                                  className: 'grid gap-1.5',
                                  children: [
                                    jsx(Input, {
                                      className: 'h-7 text-xs',
                                      placeholder: copy('advanced.filterSkills'),
                                      value: capFilter,
                                      onChange: event => setCapFilter(event.target.value)
                                    }),
                                    jsx(ScrollArea, {
                                      className: 'hermes-scroll-cap',
                                      style: { maxHeight: 200 },
                                      children: jsx(CheckList, {
                                        items: capFilter.trim()
                                          ? caps.skills.filter(s =>
                                              s.name.toLowerCase().includes(capFilter.trim().toLowerCase())
                                            )
                                          : caps.skills,
                                        disabled: creationLocked,
                                        onToggle: (name, enabled) => toggleCap('skills', name, enabled),
                                        columns: 2
                                      })
                                    }),
                                    jsx('div', {
                                      className: 'text-[0.65rem] leading-4 text-(--ui-text-quaternary)',
                                      children: copy('advanced.catalogSource', caps.source)
                                    }),
                                    creationLocked
                                      ? null
                                      : jsx(HubSkillsSection, {
                                          forProfile: null,
                                          onInstalled: name =>
                                            setCaps(prev =>
                                              !prev || prev.skills.some(s => s.name === name)
                                                ? prev
                                                : { ...prev, skills: [...prev.skills, { name, enabled: true }] }
                                            )
                                        })
                                  ]
                                })
                            : advTab === 'toolsets'
                              ? jsxs('div', {
                                  className: 'grid gap-1.5',
                                  children: [
                                    jsx(ScrollArea, {
                                      className: 'hermes-scroll-cap',
                                      style: { maxHeight: 200 },
                                      children: jsx(CheckList, {
                                        items: caps.toolsets,
                                        disabled: creationLocked,
                                        onToggle: (name, enabled) => toggleCap('toolsets', name, enabled),
                                        columns: 2
                                      })
                                    }),
                                    jsx('div', {
                                      className: 'text-[0.65rem] leading-4 text-(--ui-text-quaternary)',
                                      children: copy('advanced.defaultTools')
                                    })
                                  ]
                                })
                              : caps.mcp.length === 0
                                ? jsx('div', {
                                    className: 'px-2 py-3 text-center text-xs text-(--ui-text-tertiary)',
                                    children: copy('mcp.none')
                                  })
                                : jsxs('div', {
                                    className: 'grid gap-1.5',
                                    children: [
                                      jsx(ScrollArea, {
                                        className: 'hermes-scroll-cap',
                                        style: { maxHeight: 200 },
                                        children: jsx('div', {
                                          className: 'grid gap-1',
                                          children: caps.mcp.map(m => {
                                            const needsSetup =
                                              m.fromCatalog && !m.installed && ((m.requires || []).length > 0 || (m.auth || '').toLowerCase() === 'oauth')

                                            return jsxs(
                                              'label',
                                              {
                                                className: 'flex items-start gap-2 text-xs text-(--ui-text-secondary)',
                                                children: [
                                                  jsx(Checkbox, {
                                                    checked: !!m.enabled,
                                                    disabled: needsSetup || creationLocked,
                                                    onCheckedChange: value => toggleCap('mcp', m.name, Boolean(value))
                                                  }),
                                                  jsxs('span', {
                                                    className: 'min-w-0',
                                                    children: [
                                                      jsx('span', { children: m.name }),
                                                      m.fromCatalog && !needsSetup
                                                        ? jsx('span', {
                                                            className: 'ml-1.5 text-[0.65rem] text-(--ui-text-quaternary)',
                                                            children: m.installed
                                                              ? copy('mcp.catalogInstalled')
                                                              : copy('mcp.catalog')
                                                          })
                                                        : null,
                                                      needsSetup
                                                        ? agentMcpSetupAvailable(remoteTarget)
                                                          ? jsx(McpSetupButton, {
                                                              profile: createdSlug,
                                                              entry: m,
                                                              ensureProfile: ensureAgentCreated,
                                                              onDone: () => {
                                                                // Setup done: mark installed so the row's
                                                                // checkbox un-disables, and enable it.
                                                                setCaps(prev =>
                                                                  prev
                                                                    ? {
                                                                        ...prev,
                                                                        mcp: prev.mcp.map(x =>
                                                                          x.name === m.name
                                                                            ? { ...x, installed: true, enabled: true }
                                                                            : x
                                                                        )
                                                                      }
                                                                    : prev
                                                                )
                                                                setDirtyCaps(prev => ({ ...prev, mcp: true }))
                                                              }
                                                            })
                                                          : jsx('span', {
                                                              className:
                                                                'ml-1.5 text-[0.65rem] text-(--ui-text-quaternary)',
                                                              children: copy(
                                                                'mcp.needsSetup',
                                                                (m.requires || []).join(', ')
                                                              )
                                                            })
                                                        : null,
                                                      m.description
                                                        ? jsx('div', {
                                                            className:
                                                              'truncate text-[0.65rem] leading-4 text-(--ui-text-quaternary)',
                                                            children: m.description
                                                          })
                                                        : null
                                                    ]
                                                  })
                                                ]
                                              },
                                              m.name
                                            )
                                          })
                                        })
                                      }),
                                      jsx('div', {
                                        className: 'text-[0.65rem] leading-4 text-(--ui-text-quaternary)',
                                        children: copy('mcp.createHelp')
                                      })
                                    ]
                                  })
                  ]
                })
              : null,
            error
              ? jsx('div', {
                  className: 'rounded-md border border-(--ui-stroke-secondary) px-3 py-2 text-xs text-(--ui-accent)',
                  children: error
                })
              : null
          ]
        }),
        jsxs(DialogFooter, {
          children: [
            jsx(Button, {
              variant: 'ghost',
              disabled: busy,
              onClick: () => {
                discardDraft()
                reset()
                onClose()
              },
              children: copy('common.cancel')
            }),
            jsx(Button, {
              disabled: busy || !valid || taken,
              onClick: submit,
              children: busy ? copy('create.creating') : copy('create.action')
            })
          ]
        })
      ]
    })
  })
}

// ── routines (cron) ──────────────────────────────────────────────────────────
//
// Jobs are namespaced "[bot:<name>] <routine>". A job running in the active
// bot profile uses the plain instruction; a different profile keeps the
// hermes -p <bot> chat delegation wrapper so the run reaches that bot's
// history. The tile follows the bot you're chatting with (gateway profile).
const BOT_TAG_RE = /^\[bot:([a-z0-9][a-z0-9_-]*)\]\s*/i
const SAFE_ROUTINE_MARKER = '[bot-mode:routine:v2] '
const LEGACY_DELEGATED_ROUTINE_PREFIX = 'You are running the scheduled routine "'

function routineBot(job) {
  const match = BOT_TAG_RE.exec(job?.name || '')
  return match ? match[1].toLowerCase() : null
}

function routineTitle(job, copy = agentText) {
  return (job?.name || '').replace(BOT_TAG_RE, '') || copy('routines.untitled')
}

function isLegacyDelegatedRoutine(job) {
  const preview = typeof job?.prompt_preview === 'string' ? job.prompt_preview : job?.prompt
  return Boolean(routineBot(job) && typeof preview === 'string' && preview.startsWith(LEGACY_DELEGATED_ROUTINE_PREFIX))
}

function routineOwnerKey(owner, profile = owner?.profile) {
  const normalized = normalizeRosterOwner(owner?.connectionId, profile || owner?.profile)

  return normalized ? `${normalized.connectionId}::${normalized.profile}` : ''
}

function routineQueryKey(owner, profile = owner?.profile) {
  const normalized = normalizeRosterOwner(owner?.connectionId, profile || owner?.profile)

  return [...ROUTINES_KEY, normalized?.connectionId || '', normalized?.profile || '']
}

async function loadRoutines(profile, rosterOwner = currentBotMetaOwner(), runtime = host) {
  const owner = normalizeRosterOwner(rosterOwner?.connectionId, rosterOwner?.profile)
  const request = createRosterOwnerRequester(runtime, owner)
  // profile scopes cron.manage to that bot's own cron store (core RPC gained an
  // optional `profile` param). Older gateways ignore the unknown param and
  // return the launch-profile store — the [bot:] tag filter in selectRoutineJobs
  // remains the graceful fallback there.
  const scope = profile ? { profile } : {}
  const data = await request('cron.manage', { action: 'list', include_disabled: true, ...scope })
  const jobs = Array.isArray(data?.jobs) ? data.jobs : []
  const activeLegacyJobs = jobs.filter(
    job => isLegacyDelegatedRoutine(job) && job.enabled !== false && job.state !== 'paused'
  )

  // A pause failing must not fail the LIST — the pane would report "could
  // not load cronjobs" over data that loaded fine, and the 20s poll would
  // re-attempt the failing pause inside a failing query forever. Each pause
  // swallows its own error; the overlay only claims jobs the gateway
  // actually paused, and the next poll retries the rest.
  const pauses = await Promise.all(
    activeLegacyJobs.map(job =>
      request('cron.manage', { action: 'pause', name: job.job_id, ...scope })
        .then(() => true)
        .catch(() => false)
    )
  )

  if (!activeLegacyJobs.length) {
    return { ...data, routineOwner: owner }
  }

  const pausedIds = new Set(activeLegacyJobs.filter((job, index) => pauses[index]).map(job => job.job_id))
  return {
    ...data,
    routineOwner: owner,
    jobs: jobs.map(job => (pausedIds.has(job.job_id) ? { ...job, enabled: false, state: 'paused' } : job))
  }
}

function useRoutines(profile, rosterOwner) {
  const owner = normalizeRosterOwner(rosterOwner?.connectionId, rosterOwner?.profile)

  return useQuery({
    queryKey: routineQueryKey(owner, profile),
    queryFn: () => loadRoutines(profile, owner),
    enabled: Boolean(owner),
    refetchInterval: 20000,
    staleTime: 8000
  })
}

function routineCreateTarget(owner, activeBot) {
  return owner?.bot || owner || activeBot
}

async function invalidateRoutineOwner(profile, rosterOwner) {
  await queryClient.invalidateQueries({
    queryKey: routineQueryKey(rosterOwner, profile),
    exact: true
  })
}

async function runRoutineAction(job, action, profile, rosterOwner, runtime = host) {
  const owner = normalizeRosterOwner(rosterOwner?.connectionId, rosterOwner?.profile)
  const request = createRosterOwnerRequester(runtime, owner)

  await request('cron.manage', { action, name: job?.job_id, ...(profile ? { profile } : {}) })
  return true
}

/** Pick which cron jobs to show. A failed refresh keeps the last good list. */
function selectRoutineJobs(data, error, lastJobs, bot) {
  const live = Array.isArray(data?.jobs) ? data.jobs : null
  const all = live ?? (error ? lastJobs : [])
  const scopedToBot = normalizedProfileName(data?.scoped) === normalizedProfileName(bot)
  return {
    live,
    all,
    jobs: scopedToBot ? all : all.filter(job => (routineBot(job) || 'default') === bot)
  }
}

/**
 * Why the Routines pane can be empty while the bot's cron store has jobs.
 *
 * On older gateways the pane only shows jobs namespaced `[bot:<name>]` for the
 * active bot (plus untagged legacy jobs on the default bot). When jobs exist in
 * the store but none surface for this bot, the user is left staring at the
 * generic empty state with no hint that cronjobs are present but hidden.
 * Return a short explanation string in that case, or null when the store is
 * genuinely empty (or the active bot's jobs are already shown).
 */
function routineFilterHint(all, jobs, copy = agentText) {
  if (jobs.length !== 0 || !Array.isArray(all) || all.length === 0) {
    return null
  }
  return copy('routines.filterHint')
}

function normalizedProfileName(profile) {
  return typeof profile === 'string' ? profile.trim().toLowerCase() : ''
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`
}

/** Escape for interpolation INSIDE an existing double-quoted shell string:
 *  keeps ", `, $, and \ literal so free-text titles (which sync from ui_meta)
 *  and gateway profile names can't expand or break out of the quotes. */
function shellDoubleQuote(value) {
  return String(value).replace(/[\\"`$]/g, ch => '\\' + ch)
}

function routineInputError(title, instruction, copy = agentText) {
  if (String(title).includes('\0')) {
    return copy('routines.nameNul')
  }

  if (String(instruction).includes('\0')) {
    return copy('routines.instructionNul')
  }

  return null
}

function routinePrompt(bot, title, instruction, activeProfile) {
  if (normalizedProfileName(bot) && normalizedProfileName(bot) === normalizedProfileName(activeProfile)) {
    return instruction
  }

  return (
    `${SAFE_ROUTINE_MARKER}You are running the scheduled routine "${title}" for agent '${bot}'. ` +
    `Execute it AS that agent so the run lands in its own history: run this in the terminal and relay the output:\n\n` +
    `hermes -p ${shellQuote(bot)} chat -c ${shellQuote(`Routine: ${title}`)} -q ${shellQuote(`[Scheduled routine] ${instruction}`)}\n\n` +
    `If the command fails, report the error instead.`
  )
}
function scheduleLabel(schedule, copy = agentText) {
  const once = /^once in (.+)$/.exec(schedule || '')

  if (once) {
    return copy('routines.once', once[1])
  }

  const bare = /^(\d+)([mhd])$/.exec(schedule || '')

  if (bare) {
    return copy('routines.once', `${bare[1]}${bare[2]}`)
  }

  const match = /^every (\d+)m$/.exec(schedule || '')

  if (match) {
    const minutes = Number(match[1])

    if (minutes % 1440 === 0) {
      const d = minutes / 1440
      return d === 1 ? copy('routines.daily') : copy('routines.everyDays', d)
    }

    if (minutes % 60 === 0) {
      const h = minutes / 60
      return h === 1 ? copy('routines.hourly') : copy('routines.everyHours', h)
    }

    return copy('routines.everyMinutes', minutes)
  }

  return schedule || ''
}

function RoutineRow({ job, profile, rosterOwner }) {
  const copy = useAgentText()
  const [busy, setBusy] = useState(false)
  // Optimistic overlay: null = trust server state. Set immediately on
  // toggle so the switch responds even before the refetch lands.
  const [pendingActive, setPendingActive] = useState(null)
  const legacyUnsafe = isLegacyDelegatedRoutine(job)
  const serverActive = !legacyUnsafe && job.enabled !== false && job.state !== 'paused'
  const active = pendingActive === null ? serverActive : pendingActive

  if (pendingActive !== null && pendingActive === serverActive) {
    setPendingActive(null) // server caught up
  }

  const act = async action => {
    if (busy) {
      return
    }

    setBusy(true)

    if (action === 'pause' || action === 'resume') {
      setPendingActive(action === 'resume')
    }

    try {
      await runRoutineAction(job, action, profile, rosterOwner)
      await invalidateRoutineOwner(profile, rosterOwner)
    } catch (err) {
      setPendingActive(null)
      host.notifyError(err, copy('routines.updateFailed'))
    } finally {
      setBusy(false)
    }
  }

  return jsxs('div', {
    className: cn(
      'group grid gap-1.5 rounded-lg border border-(--ui-stroke-secondary) p-2.5 transition-colors',
      'hover:border-(--ui-stroke-primary, var(--ui-stroke-secondary))'
    ),
    children: [
      jsxs('div', {
        className: 'flex items-center gap-2',
        children: [
          jsx('span', {
            'aria-hidden': true,
            className: cn('size-1.5 shrink-0 rounded-full', active ? 'bg-emerald-500' : 'bg-(--ui-text-quaternary)')
          }),
          jsx('span', {
            className: cn('min-w-0 flex-1 truncate text-xs font-medium', !active && 'text-(--ui-text-tertiary)'),
            children: routineTitle(job, copy)
          }),
          jsx(Switch, {
            checked: active,
            disabled: busy || legacyUnsafe,
            onCheckedChange: value => act(value ? 'resume' : 'pause')
          }),
          jsx(Tip, {
            label: copy('routines.delete'),
            children: jsx('button', {
              type: 'button',
              disabled: busy,
              className:
                'flex size-5 items-center justify-center rounded text-(--ui-text-quaternary) opacity-0 transition-opacity group-hover:opacity-100 hover:bg-(--chrome-action-hover) hover:text-foreground',
              onClick: () => act('remove'),
              children: jsx(Codicon, { name: 'trash', className: 'text-[0.75rem]' })
            })
          })
        ]
      }),
      jsxs('div', {
        className: 'flex items-center justify-between gap-2 pl-3.5',
        children: [
          jsxs('span', {
            className:
              'inline-flex items-center gap-1 rounded-full border border-(--ui-stroke-secondary) px-1.5 py-0.5 text-[0.65rem] text-(--ui-text-tertiary)',
            children: [jsx(Codicon, { name: 'calendar', className: 'text-[0.7rem]' }), scheduleLabel(job.schedule, copy)]
          }),
          jsx('span', {
            className: 'truncate text-[0.65rem] text-(--ui-text-quaternary)',
            children: active && job.next_run_at
              ? copy('routines.next', relativeTime(new Date(job.next_run_at).getTime()))
              : copy('routines.paused')
          })
        ]
      }),
      legacyUnsafe
        ? jsx('div', {
            className:
              'rounded-md border border-(--ui-stroke-secondary) px-2 py-1.5 text-[0.65rem] leading-4 text-(--ui-accent)',
            children: copy('routines.legacyPaused')
          })
        : null
    ]
  })
}

// Structured schedule picker: frequency first, then only the detail that
// frequency needs (time of day, weekday, day of month, interval). Emits a
// Hermes-native schedule string; Advanced exposes it raw.
const FREQUENCIES = [
  { id: 'once', key: 'frequencyOnce' },
  { id: 'hourly', key: 'frequencyHourly' },
  { id: 'daily', key: 'frequencyDaily' },
  { id: 'weekdays', key: 'frequencyWeekdays' },
  { id: 'weekly', key: 'frequencyWeekly' },
  { id: 'monthly', key: 'frequencyMonthly' },
  { id: 'interval', key: 'frequencyInterval' },
  { id: 'advanced', key: 'frequencyAdvanced' }
]

const WEEKDAYS = [
  { id: '1', key: 'monday' },
  { id: '2', key: 'tuesday' },
  { id: '3', key: 'wednesday' },
  { id: '4', key: 'thursday' },
  { id: '5', key: 'friday' },
  { id: '6', key: 'saturday' },
  { id: '0', key: 'sunday' }
]

function localizedRoutineOptions(options, copy) {
  return options.map(option => ({ id: option.id, label: copy(`routines.${option.key}`) }))
}

function routineTimes(copy = agentText) {
  const out = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const ampm = h < 12 ? copy('routines.am') : copy('routines.pm')
      const h12 = h % 12 === 0 ? 12 : h % 12
      out.push({ id: `${h}:${m}`, label: `${h12}:${String(m).padStart(2, '0')} ${ampm}`, h, m })
    }
  }
  return out
}

/** Compose the Hermes schedule string from picker state. */
function composeSchedule(state) {
  const [h, m] = (state.time || '9:0').split(':').map(Number)

  switch (state.freq) {
    case 'once': {
      const n = Math.max(1, parseInt(state.onceN, 10) || 1)
      return `${n}${state.onceUnit || 'h'}`
    }
    case 'hourly':
      return 'every 1h'
    case 'daily':
      return `${m} ${h} * * *`
    case 'weekdays':
      return `${m} ${h} * * 1-5`
    case 'weekly':
      return `${m} ${h} * * ${state.weekday || '1'}`
    case 'monthly':
      return `${m} ${h} ${state.monthday || '1'} * *`
    case 'interval': {
      const n = Math.max(1, parseInt(state.intervalN, 10) || 1)
      return `every ${n}${state.intervalUnit || 'h'}`
    }
    default:
      return state.raw || ''
  }
}

function scheduleSummary(state, copy = agentText) {
  const weekdays = localizedRoutineOptions(WEEKDAYS, copy)
  const times = routineTimes(copy)
  const t = times.find(x => x.id === state.time)
  const tl = t ? t.label : `9:00 ${copy('routines.am')}`

  const unitWord = u =>
    u === 'm' ? copy('routines.minuteUnit') : u === 'd' ? copy('routines.dayUnit') : copy('routines.hourUnit')
  const cap =
    state.freq !== 'once' && String(state.repeatN || '').trim()
      ? copy('routines.totalRuns', Math.max(1, parseInt(state.repeatN, 10) || 1))
      : ''

  switch (state.freq) {
    case 'once':
      return copy('routines.summaryOnce', Math.max(1, parseInt(state.onceN, 10) || 1), unitWord(state.onceUnit))
    case 'hourly':
      return copy('routines.summaryHourly') + cap
    case 'daily':
      return copy('routines.summaryDaily', tl) + cap
    case 'weekdays':
      return copy('routines.summaryWeekdays', tl) + cap
    case 'weekly':
      return copy('routines.summaryWeekly', (weekdays.find(w => w.id === state.weekday) || weekdays[0]).label, tl) + cap
    case 'monthly':
      return copy('routines.summaryMonthly', state.monthday || '1', tl) + cap
    case 'interval':
      return copy('routines.summaryInterval', Math.max(1, parseInt(state.intervalN, 10) || 1), unitWord(state.intervalUnit)) + cap
    default:
      return copy('routines.summaryRaw')
  }
}

function pickerSelect(value, onChange, options) {
  return jsxs(Select, {
    value,
    onValueChange: onChange,
    children: [
      jsx(SelectTrigger, { className: 'h-8 rounded-md', children: jsx(SelectValue, {}) }),
      jsx(SelectContent, {
        children: options.map(o => jsx(SelectItem, { value: o.id, children: o.label }, o.id))
      })
    ]
  })
}

function SchedulePicker({ state, setState }) {
  const copy = useAgentText()
  const upd = patch => setState(prev => ({ ...prev, ...patch }))
  const needsTime = ['daily', 'weekdays', 'weekly', 'monthly'].includes(state.freq)
  const frequencies = localizedRoutineOptions(FREQUENCIES, copy)
  const weekdays = localizedRoutineOptions(WEEKDAYS, copy)
  const times = routineTimes(copy)

  return jsxs('div', {
    className: 'grid gap-2',
    children: [
      jsxs('div', {
        style: { display: 'grid', gridTemplateColumns: needsTime ? '1fr 1fr' : '1fr', gap: '8px' },
        children: [
          pickerSelect(state.freq, v => upd({ freq: v }), frequencies),
          needsTime ? pickerSelect(state.time, v => upd({ time: v }), times) : null
        ]
      }),
      state.freq === 'once'
        ? jsxs('div', {
            style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
            children: [
              jsx(Input, {
                className: 'h-8',
                placeholder: '30',
                value: state.onceN,
                onChange: event => upd({ onceN: event.target.value.replace(/[^0-9]/g, '').slice(0, 4) })
              }),
              pickerSelect(state.onceUnit, v => upd({ onceUnit: v }), [
                { id: 'm', label: copy('routines.minutesFromNow') },
                { id: 'h', label: copy('routines.hoursFromNow') },
                { id: 'd', label: copy('routines.daysFromNow') }
              ])
            ]
          })
        : null,
      state.freq === 'weekly'
        ? pickerSelect(state.weekday, v => upd({ weekday: v }), weekdays)
        : null,
      state.freq === 'monthly'
        ? labeled(
            copy('routines.dayOfMonth'),
            jsx(Input, {
              className: 'h-8',
              placeholder: '1',
              value: state.monthday,
              onChange: event => upd({ monthday: event.target.value.replace(/[^0-9]/g, '').slice(0, 2) })
            })
          )
        : null,
      state.freq === 'interval'
        ? jsxs('div', {
            style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
            children: [
              jsx(Input, {
                className: 'h-8',
                placeholder: '2',
                value: state.intervalN,
                onChange: event => upd({ intervalN: event.target.value.replace(/[^0-9]/g, '').slice(0, 4) })
              }),
              pickerSelect(state.intervalUnit, v => upd({ intervalUnit: v }), [
                { id: 'm', label: copy('routines.minutes') },
                { id: 'h', label: copy('routines.hours') },
                { id: 'd', label: copy('routines.days') }
              ])
            ]
          })
        : null,
      state.freq === 'advanced'
        ? jsx(Input, {
            className: 'h-8 font-mono text-xs',
            placeholder: copy('routines.rawPlaceholder'),
            value: state.raw,
            onChange: event => upd({ raw: event.target.value })
          })
        : null,
      state.freq !== 'once' && state.freq !== 'advanced'
        ? jsxs('div', {
            className: 'flex items-center gap-2',
            children: [
              jsx('span', { className: 'text-xs text-(--ui-text-tertiary)', children: copy('routines.stopAfter') }),
              jsx(Input, {
                className: 'h-7 w-16 text-xs',
                placeholder: '\u221e',
                value: state.repeatN,
                onChange: event => upd({ repeatN: event.target.value.replace(/[^0-9]/g, '').slice(0, 4) })
              }),
              jsx('span', { className: 'text-xs text-(--ui-text-tertiary)', children: copy('routines.runsForever') })
            ]
          })
        : null,
      jsx('div', {
        className: 'text-[0.65rem] text-(--ui-text-quaternary)',
        children: `${scheduleSummary(state, copy)} \u00b7 ${composeSchedule(state) || '\u2014'}`
      })
    ]
  })
}

function defaultScheduleState() {
  return { freq: 'daily', time: '9:0', weekday: '1', monthday: '1', intervalN: '2', intervalUnit: 'h', onceN: '30', onceUnit: 'm', repeatN: '', raw: '' }
}

function CreateRoutineDialog({ bot, rosterOwner, open, onClose }) {
  const copy = useAgentText()
  const [name, setName] = useState('')
  const [instruction, setInstruction] = useState('')
  const [sched, setSched] = useState(defaultScheduleState())
  const [continuity, setContinuity] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const schedule = composeSchedule(sched)

  const reset = () => {
    setName('')
    setInstruction('')
    setSched(defaultScheduleState())
    setContinuity(false)
    setBusy(false)
    setError(null)
  }

  const submit = async () => {
    const title = name.trim()
    const task = instruction.trim()
    const inputError = routineInputError(title, task, copy)

    if (inputError) {
      setError(inputError)
      return
    }

    if (!title || !task || !schedule.trim() || busy) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      const repeatN =
        sched.freq !== 'once' && sched.freq !== 'advanced' && String(sched.repeatN || '').trim()
          ? Math.max(1, parseInt(sched.repeatN, 10) || 1)
          : null
      const request = createRosterOwnerRequester(host, rosterOwner)
      await request('cron.manage', {
        action: 'add',
        name: `[bot:${bot}] ${title}`,
        schedule: schedule.trim(),
        prompt: routinePrompt(bot, title, task, rosterOwner?.profile),
        ...(bot ? { profile: bot } : {}),
        ...(repeatN ? { repeat: repeatN } : {}),
        ...(continuity ? { continuity: true } : {})
      })
      await invalidateRoutineOwner(bot, rosterOwner)
      host.notify({ kind: 'success', message: copy('routines.scheduled', title) })
      reset()
      onClose()
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return jsx(Dialog, {
    open,
    onOpenChange: value => {
      if (!value && !busy) {
        reset()
        onClose()
      }
    },
    children: jsxs(DialogContent, {
      className: 'max-w-md',
      children: [
        jsxs(DialogHeader, {
          children: [
            jsx(DialogTitle, { children: copy('routines.newTitle') }),
            jsx(DialogDescription, {
              children: copy('routines.newDescription', displayName({ name: bot }, $botMeta.get()[bot]))
            })
          ]
        }),
        jsxs('div', {
          className: 'grid gap-3.5',
          children: [
            labeled(
              copy('routines.name'),
              jsx(Input, {
                autoFocus: true,
                placeholder: copy('routines.namePlaceholder'),
                value: name,
                onChange: event => setName(event.target.value)
              })
            ),
            labeled(
              copy('routines.instruction'),
              jsx(Textarea, {
                className: 'min-h-20',
                placeholder: copy('routines.instructionPlaceholder'),
                value: instruction,
                onChange: event => setInstruction(event.target.value)
              })
            ),
            labeled(copy('routines.when'), jsx(SchedulePicker, { state: sched, setState: setSched })),
            jsxs('label', {
              className: 'flex items-center gap-2 text-xs text-(--ui-text-tertiary) cursor-pointer select-none',
              children: [
                jsx('input', {
                  type: 'checkbox',
                  className: 'accent-(--ui-accent)',
                  checked: continuity,
                  onChange: event => setContinuity(event.target.checked)
                }),
                copy('routines.continuity')
              ]
            }),
            error
              ? jsx('div', {
                  className: 'rounded-md border border-(--ui-stroke-secondary) px-3 py-2 text-xs text-(--ui-accent)',
                  children: error
                })
              : null
          ]
        }),
        jsxs(DialogFooter, {
          children: [
            jsx(Button, {
              variant: 'ghost',
              disabled: busy,
              onClick: () => {
                reset()
                onClose()
              },
              children: copy('common.cancel')
            }),
            jsx(Button, {
              disabled: busy || !name.trim() || !instruction.trim() || !schedule.trim(),
              onClick: submit,
              children: busy ? copy('routines.scheduling') : copy('routines.create')
            })
          ]
        })
      ]
    })
  })
}

function RoutinesPane() {
  const copy = useAgentText()
  const selected = useValue($selectedBot)
  const gatewayProfile = useValue(host.state.profile)
  const gatewayConnectionId = useValue(host.state.connectionId)
  // The tile maps to the bot you're chatting with: the live gateway profile
  // is the truth once a chat opens; $selectedBot covers the gap between a
  // roster click and the profile swap landing.
  const bot = (gatewayProfile || selected || 'default').trim() || 'default'
  const routineOwner = normalizeRosterOwner(gatewayConnectionId, bot)
  const meta = useValue($botMeta)[bot]
  const { shape, color, image } = botAppearance(bot, meta)
  const { data, error, isLoading, refetch } = useRoutines(bot, routineOwner)
  const [createOpen, setCreateOpen] = useState(false)
  const [createOwner, setCreateOwner] = useState(null)
  const createTarget = routineCreateTarget(createOwner, bot)

  const openCreate = () => {
    setCreateOwner({ bot, rosterOwner: routineOwner })
    setCreateOpen(true)
  }

  const cacheKey = routineOwnerKey(routineOwner, bot)
  const lastByOwner = $lastJobs.get()
  const view = selectRoutineJobs(data, error, lastByOwner[cacheKey] || [], bot)
  if (view.live) {
    $lastJobs.set({ ...lastByOwner, [cacheKey]: view.live })
  }
  const jobs = view.jobs
  const staleNotice = error && !view.live && view.all.length
    ? copy('routines.stale')
    : null
  const filterHint = routineFilterHint(view.all, jobs, copy)

  return jsxs('div', {
    className: 'flex h-full flex-col',
    children: [
      jsxs('div', {
        className: 'flex items-center gap-2 px-3 pt-3 pb-2',
        children: [
          jsx(BotFace, { shape, color, image, size: 22, name: bot }),
          jsxs('div', {
            className: 'min-w-0 flex-1',
            children: [
              jsxs('div', {
                className: 'flex min-w-0 items-baseline gap-1.5 truncate',
                children: [
                  jsx('div', {
                    className: 'truncate text-xs font-semibold',
                    children: displayName({ name: bot }, meta)
                  }),
                  showsHandle(bot, meta)
                    ? jsx('span', {
                        className: 'shrink-0 font-mono text-[0.65rem] text-(--ui-text-quaternary)',
                        children: `@${botHandle(bot)}`
                      })
                    : null
                ]
              }),
              jsx('div', {
                className: 'text-[0.65rem] uppercase tracking-wider text-(--ui-text-quaternary)',
                children: copy('routines.tab')
              })
            ]
          }),
          jsx(Tip, {
            label: copy('routines.newTitle'),
            children: jsx('button', {
              type: 'button',
              className:
                'flex size-6 shrink-0 items-center justify-center rounded-md text-(--ui-text-tertiary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground',
              onClick: openCreate,
              children: jsx(Codicon, { name: 'add' })
            })
          })
        ]
      }),
      jsx('div', { className: 'mx-3 border-t border-(--ui-stroke-secondary)' }),
      staleNotice
        ? jsx('div', {
            className: 'mx-3 mt-2 rounded-md bg-(--chrome-action-hover) px-2 py-1.5 text-[0.6875rem] text-(--ui-text-tertiary)',
            children: staleNotice
          })
        : null,
      isLoading && !view.all.length
        ? jsx('div', {
            className: 'flex flex-1 items-center justify-center',
            children: jsx(GlyphSpinner, { spinner: 'breathe', className: 'text-(--ui-text-tertiary)' })
          })
        : error && !view.all.length
          ? jsxs('div', {
              className: 'flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center',
              children: [
                jsx(Codicon, { name: 'warning', className: 'text-[1.6rem] text-(--ui-text-quaternary)' }),
                jsx('div', {
                  className: 'text-xs leading-5 text-(--ui-text-tertiary)',
                  children: copy('routines.loadFailed')
                }),
                jsx(Button, {
                  variant: 'secondary',
                  size: 'sm',
                  onClick: () => void refetch(),
                  children: copy('common.retry')
                })
              ]
            })
        : jobs.length === 0
          ? jsxs('div', {
              className: 'flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center',
              children: [
                // No generic placeholder here: an icon + "cronjobs are…" blurb and the
                // create button both just said "empty" (Teknium, Aug 2026). The hint
                // text stays only when jobs exist but are hidden by the bot filter —
                // that carries real information, not an empty-state marker.
                filterHint
                  ? jsx('div', {
                      className: 'text-xs leading-5 text-(--ui-text-tertiary)',
                      children: filterHint
                    })
                  : null,
                jsx(Button, {
                  variant: 'secondary',
                  size: 'sm',
                  onClick: openCreate,
                  children: filterHint ? copy('routines.createForAgent') : copy('routines.create')
                })
              ]
            })
          : jsx(ScrollArea, {
              className: 'min-h-0 flex-1',
              children: jsx('div', {
                className: 'grid gap-1.5 px-2.5 py-2',
                children: jobs.map(job => jsx(RoutineRow, { job, profile: bot, rosterOwner: routineOwner }, job.job_id))
              })
            }),
      jsx(CreateRoutineDialog, {
        bot: createTarget,
        rosterOwner: createOwner?.rosterOwner || routineOwner,
        open: createOpen,
        onClose: () => {
          setCreateOpen(false)
          setCreateOwner(null)
        }
        // key is the jsx() THIRD argument — as a prop it is silently ignored
        // and the dialog kept stale per-bot form state when the target changed.
      }, createTarget)
    ]
  })
}

// ── profile session workspace ────────────────────────────────────────────────

const PROFILE_SESSION_LIST_LIMIT = 200

function openBotSessionsWorkspace(bot) {
  if (bot?.name && NAME_RE.test(bot.name)) {
    $botSessionsWorkspace.set(bot.name)
  }
}

function filterProfileSessions(sessions, query) {
  const needle = String(query || '').trim().toLowerCase()
  const rows = Array.isArray(sessions) ? sessions : []
  if (!needle) return rows
  return rows.filter(session =>
    `${session?.title || ''} ${session?.preview || ''} ${session?.source || ''}`.toLowerCase().includes(needle)
  )
}

function useProfileSessions(botName, gatewayGeneration) {
  return useQuery({
    queryKey: [ID, 'profile-sessions', botName, gatewayGeneration],
    enabled: Boolean(botName),
    // include_hidden: this browser exists precisely to see the profile's own
    // (always-hidden) Bot Mode sessions alongside its regular ones.
    queryFn: () => host.request('session.list', { profile: botName, limit: PROFILE_SESSION_LIST_LIMIT, include_hidden: true }),
    refetchInterval: 8000,
    staleTime: 4000,
    retry: false
  })
}

async function openProfileSession(botName, storedId, gatewayGeneration) {
  const profile = String(botName || '')
  const id = String(storedId || '')
  if (!NAME_RE.test(profile) || !id || gatewayGeneration !== $sessionsGatewayGeneration.get()) return
  if (typeof host.openSession !== 'function') {
    throw new Error(agentText('profile.unsupportedSessionOpen'))
  }
  await host.openSession(id, { profile })
  if (gatewayGeneration !== $sessionsGatewayGeneration.get()) return
  $botSelectedSessions.set({ ...$botSelectedSessions.get(), [profile]: id })
}

function ProfileSessionRow({ session, botName, active, gatewayGeneration }) {
  const copy = useAgentText()
  return jsxs('button', {
    type: 'button',
    'aria-current': active ? 'page' : undefined,
    onClick: () =>
      void openProfileSession(botName, session.id, gatewayGeneration).catch(err =>
        host.notifyError(err, copy('profile.sessionOpenFailed'))
      ),
    className: cn(
      'flex w-full flex-col gap-0.5 overflow-hidden rounded-md px-2 py-1.5 text-left transition-colors',
      'hover:bg-(--chrome-action-hover)',
      active && 'bg-(--ui-row-active-background)'
    ),
    children: [
      jsx('span', {
        className: 'truncate text-[0.8125rem] font-medium',
        children: session.title || copy('sessions.untitled')
      }),
      jsx('div', {
        className: 'truncate text-[0.7rem] text-(--ui-text-tertiary)',
        children: session.preview || session.source || copy('sessions.noMessages')
      })
    ]
  })
}

function ProfileSessionsWorkspace({ bot }) {
  const copy = useAgentText()
  const gatewayGeneration = useValue($sessionsGatewayGeneration)
  const { data, isLoading, error } = useProfileSessions(bot.name, gatewayGeneration)
  const selectedByProfile = useValue($botSelectedSessions)
  const [query, setQuery] = useState('')
  const sourceSessions = data?.sessions || []
  const sessions = filterProfileSessions(sourceSessions, query)
  const inventoryBounded = sourceSessions.length >= PROFILE_SESSION_LIST_LIMIT
  const selectedId = selectedByProfile[bot.name] || ''

  const header = jsxs('div', {
    className: 'flex items-center gap-2 px-2.5 pt-2.5 pb-2',
    children: [
      jsx(Button, {
        variant: 'ghost',
        size: 'sm',
        onClick: () => $botSessionsWorkspace.set(null),
        children: copy('common.back')
      }),
      jsx('div', {
        className: 'min-w-0 flex-1 truncate text-sm font-semibold',
        children: copy('sessions.heading', displayName(bot, $botMeta.get()[bot.name]))
      })
    ]
  })

  return jsxs('div', {
    className: 'flex h-full flex-col',
    children: [
      header,
      jsx('div', {
        className: 'px-2 pb-2',
        children: jsx(Input, {
          'aria-label': copy('sessions.filterAria'),
          placeholder: copy('sessions.filterPlaceholder'),
          value: query,
          onChange: event => setQuery(event.target.value)
        })
      }),
      inventoryBounded
        ? jsx('div', {
            className: 'px-2.5 pb-2 text-[0.65rem] text-(--ui-text-quaternary)',
            children: copy('sessions.recent', PROFILE_SESSION_LIST_LIMIT)
          })
        : null,
      isLoading
        ? jsx('div', {
            className: 'flex flex-1 items-center justify-center',
            children: jsx(GlyphSpinner, { spinner: 'breathe' })
          })
        : error
          ? jsx('div', {
              className: 'px-3 py-3 text-xs text-(--ui-text-tertiary)',
              children: copy('sessions.loadFailed')
            })
          : jsx(ScrollArea, {
              className: 'min-h-0 flex-1',
              children: jsx('div', {
                className: 'grid gap-0.5 px-1.5 pb-2',
                children: sessions.length
                  ? sessions.map(session => jsx(ProfileSessionRow, {
                      session,
                      botName: bot.name,
                      active: selectedId === session.id,
                      gatewayGeneration
                    }, session.id))
                  : jsx('div', {
                      className: 'px-2 py-3 text-center text-xs text-(--ui-text-tertiary)',
                      children: query.trim()
                        ? inventoryBounded
                          ? copy('sessions.noRecentMatch', PROFILE_SESSION_LIST_LIMIT)
                          : copy('sessions.noMatch')
                        : copy('sessions.none')
                    })
              })
            })
    ]
  })
}

// ── roster pane ──────────────────────────────────────────────────────────────

/** "Active now" presence strip above the roster: chips for every bot that is
 *  working right now (the gateway-busy selected profile + bots whose last
 *  message landed inside the liveness window). Reuses the row avatar; each
 *  chip opens that bot's canonical Bot Chat. Omitted entirely when nothing
 *  is active, and never reorders the roster below it. */
function ActiveNowStrip({ roster, activeProfile, gatewayState, metaByName, rosterOwner, onOpen }) {
  const copy = useAgentText()
  const active = activeBots(roster, activeProfile, gatewayState)

  if (!active.length) {
    return null
  }

  return jsxs('div', {
    role: 'status',
    'aria-live': 'polite',
    'aria-label': copy('sessions.activeNow'),
    className: 'flex flex-wrap items-center gap-1.5 px-2.5 pb-1.5',
    children: [
      jsx('span', {
        className: 'text-[0.6875rem] font-semibold uppercase tracking-wider text-(--ui-text-quaternary)',
        children: copy('sessions.activeNow')
      }),
      ...active.map(bot => {
        const meta = botRosterMeta(bot, metaByName, rosterOwner)
        const { shape, color, image } = botAppearance(bot.name, meta)
        const photo = Boolean(image && !isBackfilledFacePng(image))
        const label = displayName(bot, meta)

        return jsx('button', {
          type: 'button',
          title: copy('sessions.openChat', label),
          className: cn(
            'flex items-center gap-1.5 rounded-md bg-(--chrome-action-hover) px-1.5 py-1 text-left transition-colors',
            'hover:bg-(--chrome-action-hover) hover:text-foreground'
          ),
          onClick: () => onOpen(bot),
          children: [
            jsx(BotFace, {
              shape,
              color,
              image: photo ? image : null,
              size: 24,
              name: bot.name,
              mood: 'work'
            }),
            jsx('span', {
              className: 'max-w-28 truncate text-xs font-medium',
              children: label
            })
          ]
        }, botRosterKey(bot))
      })
    ]
  })
}

/** Assign a bot to a group-chat membership without replacing its others.
 *  Existing groups are independent toggles; the input creates and joins a new
 *  one. Canonical groups + the legacy scalar projection ride ui_meta. */
function GroupDialog({ bot, onClose }) {
  const copy = useAgentText()
  const metaByName = useValue($botMeta)
  const [name, setName] = useState('')
  const rowMeta = botRosterMeta(bot, metaByName, bot?.actionOwner)
  const localMeta =
    isExactLocalRosterOwner(bot?.actionOwner) && sameRosterOwner($botMetaOwner.get(), bot?.actionOwner)
      ? metaByName
      : {}
  const current = botGroups(rowMeta)
  const groups = knownGroups({ ...localMeta, [bot?.name]: rowMeta })
  const actionCurrent = () =>
    agentProfileActionMatchesOwner(bot, {
      connectionId: host.state.connectionId?.get?.() || 'local',
      profile: host.state.profile?.get?.() || 'default'
    })

  const setMembership = (group, enabled) => {
    if (!actionCurrent()) {
      host.notify({ kind: 'error', message: copy('profile.sourceChanged') })
      onClose()
      return
    }

    saveBotMeta(bot.name, groupMembershipPatch(rowMeta, group, enabled), rowMeta, bot.actionOwner)
    host.notify({
      kind: 'info',
      message: enabled
        ? copy('groups.added', displayName(bot, rowMeta), group)
        : copy('groups.removed', displayName(bot, rowMeta), group)
    })
  }

  return jsx(Dialog, {
    open: Boolean(bot),
    onOpenChange: value => {
      if (!value) {
        onClose()
      }
    },
    children: jsxs(DialogContent, {
      className: 'max-w-sm',
      children: [
        jsxs(DialogHeader, {
          children: [
            jsx(DialogTitle, { children: copy('groups.manage') }),
            jsx(DialogDescription, {
              children: copy('groups.manageDescription')
            })
          ]
        }),
        groups.length
          ? jsx('div', {
              className: 'grid gap-1.5',
              children: groups.map(group => {
                const enabled = current.includes(group)

                return jsxs(
                  'label',
                  {
                    className:
                      'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-(--chrome-action-hover)',
                    children: [
                      jsx(Checkbox, {
                        checked: enabled,
                        onCheckedChange: checked => setMembership(group, checked === true)
                      }),
                      jsx('span', { children: group })
                    ]
                  },
                  group
                )
              })
            })
          : null,
        jsxs('form', {
          className: 'flex items-center gap-1.5',
          onSubmit: event => {
            event.preventDefault()
            const trimmed = name.trim()

            if (trimmed) {
              setMembership(trimmed, true)
              setName('')
            }
          },
          children: [
            jsx(Input, {
              autoFocus: true,
              placeholder: groups.length ? copy('groups.newPlaceholder') : copy('groups.namePlaceholder'),
              value: name,
              onChange: event => setName(event.target.value)
            }),
            jsx(Button, { type: 'submit', size: 'sm', disabled: !name.trim(), children: copy('groups.createJoin') })
          ]
        }),
        current.length
          ? jsx(Button, {
              variant: 'ghost',
              size: 'sm',
              className: 'justify-self-start',
              onClick: () => {
                if (actionCurrent()) {
                  saveBotMeta(bot.name, { groups: [], group: null }, rowMeta, bot.actionOwner)
                } else {
                  host.notify({ kind: 'error', message: copy('profile.sourceChanged') })
                  onClose()
                }
              },
              children: copy('groups.removeAll')
            })
          : null
      ]
    })
  })
}

/** Discord-style group chat creation: pick 2+ bots via checkboxes (with
 *  search), name the group, create. Assignment appends to each local bot's
 *  group membership list, so the room appears in the roster and syncs
 *  cross-machine via ui_meta without replacing its other groups. */
function CreateGroupChatDialog({ open, roster, rosterOwner, onClose, onCreated }) {
  const copy = useAgentText()
  const allMeta = useValue($botMeta)
  const [query, setQuery] = useState('')
  const [checked, setChecked] = useState({})
  const [name, setName] = useState('')

  // Reset per open so a cancelled draft doesn't leak into the next one.
  useEffect(() => {
    if (open) {
      setQuery('')
      setChecked({})
      setName('')
    }
  }, [open])

  const selected = roster.filter(bot => checked[botRosterKey(bot)])
  const visible = filterBots(roster, allMeta, query, rosterOwner)
  const atCap = selected.length >= GROUP_CHAT_MAX_MEMBERS
  const placeholder = selected.length
    ? selected.map(bot => displayName(bot, botRosterMeta(bot, allMeta, rosterOwner))).join(', ')
    : copy('groups.nameAria')
  const canCreate = selected.length >= 2 && Boolean(name.trim() || selected.length)

  const create = () => {
    let groupName = (name.trim() || placeholder).slice(0, 64)

    if (selected.length < 2 || !groupName) {
      return
    }

    // Creating a group is always a FRESH room. Without this, re-creating a
    // group under an existing name (easy — the default name is just the
    // member names) silently reopens the old room with its full log, which
    // reads as "not a fresh group" (db's Aug 2026 report). Uniquify against
    // both live rooms and any bot's current grouping.
    const taken = new Set(Object.keys($groupChats.get()))

    for (const bot of roster) {
      const meta = botRosterMeta(bot, allMeta, rosterOwner)
      for (const existing of botGroups(meta)) {
        taken.add(existing)
      }
    }

    if (taken.has(groupName)) {
      let n = 2

      while (taken.has(`${groupName} ${n}`)) {
        n += 1
      }

      groupName = `${groupName} ${n}`.slice(0, 64)
    }

    const roomMembers = durableGroupChatMembers(selected, rosterOwner)

    if (roomMembers.length !== selected.length) {
      return
    }

    for (const bot of selected) {
      if (!bot.remoteSource) {
        const meta = botRosterMeta(bot, allMeta, rosterOwner)
        void saveBotMeta(bot.name, groupMembershipPatch(meta, groupName, true), meta, rosterOwner)
      }
    }

    // Persist every machine identity, including today's active source. That
    // member becomes remote after a source switch and cannot rely on the new
    // gateway's name-keyed bot metadata to remain seated in this room.
    updateGroupChat(groupName, room => {
      room.members = roomMembers
      return room
    })

    host.notify({ kind: 'info', message: copy('groups.created', groupName, selected.length) })
    onClose()
    onCreated?.(groupName)
  }

  return jsx(Dialog, {
    open,
    onOpenChange: value => {
      if (!value) {
        onClose()
      }
    },
    children: jsxs(DialogContent, {
      className: 'max-w-md',
      children: [
        jsxs(DialogHeader, {
          children: [
            jsx(DialogTitle, { children: copy('groups.newChat') }),
            jsx(DialogDescription, {
              children: copy('groups.pickDescription', GROUP_CHAT_MAX_MEMBERS)
            })
          ]
        }),
        jsx(SearchField, {
          'aria-label': copy('groups.searchAria'),
          autoFocus: true,
          containerClassName: 'w-full',
          inputClassName: 'w-full',
          placeholder: copy('groups.searchPlaceholder'),
          value: query,
          onChange: setQuery
        }),
        selected.length
          ? jsx('div', {
              className: 'flex flex-wrap gap-1',
              children: selected.map(bot =>
                jsxs('button', {
                  type: 'button',
                  className:
                    'flex items-center gap-1 rounded-full bg-(--chrome-action-hover) py-0.5 pl-2 pr-1.5 text-[0.6875rem] text-(--ui-text-secondary) transition-colors hover:text-foreground',
                  title: copy('groups.removeSelection'),
                  onClick: () => setChecked(prev => ({ ...prev, [botRosterKey(bot)]: false })),
                  children: [
                    displayName(bot, botRosterMeta(bot, allMeta, rosterOwner)),
                    jsx(Codicon, { name: 'close', className: 'text-[0.6rem]' })
                  ]
                }, botRosterKey(bot))
              )
            })
          : null,
        jsx(ScrollArea, {
          className: 'max-h-64 min-h-0',
          children: jsx('div', {
            className: 'grid gap-0.5 pr-2',
            children: visible.length
              ? visible.map(bot => {
                  const meta = botRosterMeta(bot, allMeta, rosterOwner)
                  const { shape, color, image } = botAppearance(bot.name, meta)
                  const isChecked = Boolean(checked[botRosterKey(bot)])
                  const disabled = !isChecked && atCap
                  const currentGroups = botGroups(meta)

                  return jsxs('label', {
                    className: cn(
                      'flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-(--chrome-action-hover)',
                      disabled && 'cursor-not-allowed opacity-50'
                    ),
                    children: [
                      jsx(BotFace, {
                        shape,
                        color,
                        image: image && !isBackfilledFacePng(image) ? image : null,
                        size: 24,
                        name: bot.name
                      }),
                      jsxs('div', {
                        className: 'min-w-0 flex-1',
                        children: [
                          jsx('div', { className: 'truncate text-xs text-foreground', children: displayName(bot, meta) }),
                          jsx('div', {
                            className: 'truncate text-[0.625rem] text-(--ui-text-quaternary)',
                            children: [
                              currentGroups.length
                                ? `@${botHandle(bot.name, bot)} · ${copy('groups.inGroups', currentGroups.map(group => `“${group}”`).join(', '))}`
                                : `@${botHandle(bot.name, bot)}`,
                              bot.remoteSource && bot.connectionLabel ? ` · ${bot.connectionLabel}` : ''
                            ].join('')
                          })
                        ]
                      }),
                      jsx(Checkbox, {
                        checked: isChecked,
                        disabled,
                        onCheckedChange: value => setChecked(prev => ({ ...prev, [botRosterKey(bot)]: Boolean(value) }))
                      })
                    ]
                  }, botRosterKey(bot))
                })
              : jsx('div', {
                  className: 'px-1.5 py-3 text-center text-xs text-(--ui-text-tertiary)',
                  children: query.trim() ? copy('groups.noMatch', query.trim()) : copy('groups.noAgents')
                })
          })
        }),
        jsx('form', {
          onSubmit: event => {
            event.preventDefault()
            create()
          },
          children: jsx(Input, {
            'aria-label': copy('groups.nameAria'),
            maxLength: 64,
            placeholder,
            value: name,
            onChange: event => setName(event.target.value)
          })
        }),
        jsxs(DialogFooter, {
          children: [
            jsx(Button, { variant: 'secondary', onClick: onClose, children: copy('common.cancel') }),
            jsx(Button, {
              disabled: !canCreate,
              title: selected.length < 2 ? copy('groups.pickMinimum') : undefined,
              onClick: create,
              children: copy('groups.createAction', selected.length)
            })
          ]
        })
      ]
    })
  })
}

/** Merged room view for one group: shared timeline with per-member
 *  attribution, a composer that drives the round-robin, and a working
 *  indicator while member turns run. Renders identically in the MAIN chat
 *  window (host.openWorkspace tile) and in the bots panel (older-desktop
 *  fallback); `onBack` is where the Back button routes — the main tile's
 *  closer, or clearing the in-panel workspace atom. */
function GroupChatWorkspace({ group, members, onBack, rosterOwner }) {
  const copy = useAgentText()
  const rooms = useValue($groupChats)
  const allMeta = useValue($botMeta)
  const room = rooms[group] || { log: [], running: false }
  const [draft, setDraft] = useState('')
  const [confirmDisband, setConfirmDisband] = useState(false)
  // Click-to-disambiguate: which log entry is showing its speaker's full
  // @handle (the roster's name-device form when names collide across
  // connections). Naturally every speaker just shows its display name.
  const [revealedSpeaker, setRevealedSpeaker] = useState(null)

  const header = jsxs('div', {
    className: 'flex items-center gap-2 px-2.5 pt-2.5 pb-2',
    children: [
      jsx(Button, {
        variant: 'ghost',
        size: 'sm',
        onClick: () => (onBack ? onBack() : $groupChatWorkspace.set(null)),
        children: copy('common.back')
      }),
      jsx('div', {
        className: 'min-w-0 flex-1 truncate text-sm font-semibold',
        children: copy('groups.chatHeading', group)
      }),
      // Member faces: the room's roster at a glance, matching each bot's
      // avatar in the sidebar. Falls back to the count for the title tooltip.
      jsx('div', {
        className: 'flex shrink-0 items-center -space-x-1.5',
        title: members.map(b => displayName(b, botRosterMeta(b, allMeta, rosterOwner))).join(', '),
        children: members.slice(0, 6).map(b => {
          const bMeta = botRosterMeta(b, allMeta, rosterOwner)
          const { shape, color, image } = botAppearance(b.name, bMeta)
          const photo = Boolean(image && !isBackfilledFacePng(image))

          return jsx('div', {
            className: 'rounded-full ring-2 ring-(--ui-bg-primary,#111)',
            children: jsx(BotFace, { shape, color, image: photo ? image : null, size: 20, name: b.name })
          }, botRosterKey(b))
        })
      }),
      jsx('span', {
        className: 'shrink-0 text-[0.65rem] text-(--ui-text-quaternary)',
        children: copy('groups.memberCount', members.length)
      }),
      jsx(Button, {
        variant: 'ghost',
        size: 'sm',
        className: 'shrink-0 text-(--ui-text-tertiary) hover:text-destructive',
        title: copy('groups.disbandTitle', group),
        onClick: () => setConfirmDisband(true),
        children: jsx(Codicon, { name: 'trash' })
      })
    ]
  })

  const submit = () => {
    const text = draft.trim()

    if (!text) {
      return
    }

    setDraft('')
    // Full descriptors ride into the turn loop: remote members keep their
    // connection fields so their turns route to their own machines.
    sendToGroupChat(
      group,
      members.map(b => ({
        ...b,
        title: (b.remoteSource ? '' : allMeta[b.name]?.title) || b.title || ''
      })),
      text
    )
  }

  return jsxs('div', {
    className: 'flex h-full flex-col',
    children: [
      header,
      jsx(ScrollArea, {
        className: 'min-h-0 flex-1',
        children: jsxs('div', {
          className: 'grid gap-1.5 px-2.5 pb-2',
          children: [
            ...(room.log.length
              ? room.log.map((entry, index) => {
                  const isUser = entry.from.kind === 'user'
                  const meta = isUser || entry.from.source ? null : allMeta[entry.from.name]
                  // Match this speaker back to its member descriptor so display
                  // names and disambiguating handles come from the roster (the
                  // primary "default" profile renders as Hermes, remote dupes
                  // carry their @name-device handle) instead of raw profile ids.
                  const member = isUser
                    ? null
                    : members.find(b =>
                        b.name === entry.from.name &&
                        (entry.from.source
                          ? (b.connectionLabel || b.connectionId) === entry.from.source
                          : !b.remoteSource)
                      ) || null
                  const display = isUser ? copy('groups.you') : displayName(member || { name: entry.from.name }, meta)
                  const entryKey = `${entry.at}:${index}`
                  const revealed = !isUser && revealedSpeaker === entryKey
                  // Clicked: append the gateway name so same-named agents on
                  // two connections are tellable apart on demand.
                  const label = isUser
                    ? copy('groups.you')
                    : revealed
                      ? `${display}${entry.from.source ? `-${entry.from.source}` : ''} (@${botHandle(entry.from.name, member || undefined)})`
                      : display
                  // Speaker avatar: same appearance pipeline as the roster
                  // (custom image/pet, else deterministic shape+color face).
                  // Remote speakers have no local meta and get the
                  // deterministic face for their name — stable per bot.
                  const { shape, color, image } = isUser
                    ? { shape: null, color: null, image: null }
                    : botAppearance(entry.from.name, meta)
                  const photo = Boolean(image && !isBackfilledFacePng(image))

                  return jsxs('div', {
                    className: cn(
                      'flex items-start gap-2',
                      isUser ? 'rounded-md bg-(--chrome-action-hover) px-2 py-1.5' : 'px-2 py-1'
                    ),
                    children: [
                      isUser
                        ? null
                        : jsx('div', {
                            className: 'mt-0.5 shrink-0',
                            children: jsx(BotFace, {
                              shape,
                              color,
                              image: photo ? image : null,
                              size: 24,
                              name: entry.from.name
                            })
                          }),
                      jsxs('div', {
                        className: 'min-w-0 flex-1',
                        children: [
                          jsxs('div', {
                            className: 'flex items-baseline gap-2',
                            children: [
                              isUser
                                ? jsx('span', {
                                    className: 'text-[0.7rem] font-semibold text-foreground',
                                    children: label
                                  })
                                : jsx('button', {
                                    type: 'button',
                                    className:
                                      'cursor-pointer border-0 bg-transparent p-0 text-left text-[0.7rem] font-semibold text-(--ui-accent,#4f9cf9)',
                                    title: revealed ? copy('groups.hideHandle') : copy('groups.showHandle'),
                                    onClick: () => setRevealedSpeaker(revealed ? null : entryKey),
                                    children: label
                                  }),
                              jsx('span', {
                                className: 'text-[0.625rem] text-(--ui-text-quaternary)',
                                children: relativeTime(entry.at)
                              })
                            ]
                          }),
                          jsx('div', {
                            className:
                              'text-xs text-(--ui-text-secondary) [&_p]:mb-1 [&_p:last-child]:mb-0 [&_ul]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:mb-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_pre]:overflow-x-auto',
                            children: Streamdown ? jsx(Streamdown, { children: entry.text }) : entry.text
                          })
                        ]
                      })
                    ]
                  }, entryKey)
                })
              : [
                  jsx('div', {
                    className: 'px-2 py-4 text-center text-xs text-(--ui-text-tertiary)',
                    children: copy('groups.empty')
                  }, 'empty')
                ]),
            room.running
              ? jsx('div', {
                  className: 'px-2 py-1 text-[0.7rem] italic text-(--ui-text-quaternary)',
                  children: room.turn
                    ? copy('groups.thinking', groupSpeakerLabel(room.turn))
                    : copy('groups.working')
                }, 'working')
              : null
          ]
        })
      }),
      jsx('div', {
        className: 'border-t border-(--ui-stroke-secondary) p-2',
        children: jsxs('form', {
          className: 'flex items-center gap-1.5',
          onSubmit: event => {
            event.preventDefault()
            submit()
          },
          children: [
            jsx(Input, {
              'aria-label': copy('groups.messageAria', group),
              placeholder: copy('groups.messagePlaceholder', group),
              value: draft,
              onChange: event => setDraft(event.target.value)
            }),
            jsx(Button, { type: 'submit', size: 'sm', disabled: !draft.trim(), children: copy('groups.send') })
          ]
        })
      }),
      jsx(ConfirmDialog, {
        open: confirmDisband,
        title: copy('groups.disbandConfirm'),
        description: copy('groups.disbandDescription', group, members.length),
        destructive: true,
        confirmLabel: copy('groups.disband'),
        busyLabel: copy('groups.disbanding'),
        doneLabel: copy('groups.disbanded'),
        onClose: () => setConfirmDisband(false),
        onConfirm: async () => {
          await disbandGroupChat(group, members)
          host.notify({ kind: 'success', message: copy('groups.disbandedToast', group) })
        }
      })
    ]
  })
}

/** Live closers for group-chat MAIN-window tabs, by group name — so a
 *  disband (or the room view's own Back) can retire the tab it opened. */
const groupChatMainTabs = new Map()

function closeGroupChatMainTab(group) {
  const close = groupChatMainTabs.get(group)

  groupChatMainTabs.delete(group)

  if (typeof close === 'function') {
    try {
      close()
    } catch {
      /* tab already gone */
    }
  }
}

/** Main-window wrapper: seats the member roster reactively (live roster +
 *  bot meta + the room's stored cross-connection descriptors) so the room
 *  keeps working as members change while the tab is open. */
function GroupChatMainView({ group }) {
  const allMeta = useValue($botMeta)
  // Subscribe: membership changes ride bot meta AND the room record.
  useValue($groupChats)
  const roster = useValue($lastRoster)
  const rosterOwner = useValue($lastRosterOwner)
  const members = groupChatMemberBots(group, roster, allMeta)

  return jsx(GroupChatWorkspace, {
    group,
    members,
    rosterOwner,
    onBack: () => closeGroupChatMainTab(group)
  })
}

/** Open a group chat the Discord way: a tab taking over the MAIN chat window
 *  (host.openWorkspace, newer desktops), falling back to the in-panel room
 *  view on desktops whose SDK predates the main-area door. */
function openGroupChat(group) {
  $groupNeedsYou.set({ ...$groupNeedsYou.get(), [group]: false })

  if (typeof host.openWorkspace === 'function') {
    try {
      const close = host.openWorkspace(`${ID}:group:${slugify(group)}`, {
        title: group,
        minWidth: '24rem',
        render: () => jsx(GroupChatMainView, { group }),
        onClose: () => groupChatMainTabs.delete(group)
      })

      groupChatMainTabs.set(group, close)

      return
    } catch {
      // Fall through to the in-panel room below.
    }
  }

  $groupChatWorkspace.set(group)
}

/** One group chat as ONE roster row — the Discord shape: stacked member
 *  avatars, group name, member count, the newest room line as the preview
 *  (markdown flattened), relative time of the last activity, and the
 *  needs-you badge on the row itself. Sorts into the same recency ordering
 *  as bot rows; clicking opens the room in the main chat window. */
function GroupRow({ group, members, needsYou, onOpen }) {
  const copy = useAgentText()
  const rooms = useValue($groupChats)
  const allMeta = useValue($botMeta)
  const room = rooms[group] || { log: [] }
  const log = Array.isArray(room.log) ? room.log : []
  const last = log.length ? log[log.length - 1] : null
  const lastAt = groupLastActivity(room)
  const preview = last
    ? `${last.from?.kind === 'user' ? copy('groups.you') : `@${last.from?.name || 'agent'}`}: ${stripPreviewMarkdown(last.text) || '…'}`
    : copy('groups.noMessages')
  const faces = members.slice(0, 3)

  return jsxs('button', {
    type: 'button',
    onClick: () => {
      haptic('tap')
      onOpen(group)
    },
    className: cn(
      'flex w-full min-w-0 max-w-full items-center gap-2.5 overflow-hidden rounded-md px-2 py-2 text-left transition-colors',
      'hover:bg-(--chrome-action-hover)'
    ),
    children: [
      // Composite avatar: up to three member faces fanned like Discord's
      // group-DM icon; a bare glyph when the room has no seated members.
      jsx('div', {
        className: 'flex w-[34px] shrink-0 items-center justify-center',
        children: faces.length
          ? jsx('div', {
              className: 'flex items-center -space-x-2.5',
              children: faces.map(member => {
                const meta = member.remoteSource ? null : allMeta[member.name]
                const { shape, color, image } = botAppearance(member.name, meta)

                return jsx(
                  'div',
                  {
                    className: 'rounded-full ring-2 ring-(--ui-bg-primary,#111)',
                    children: jsx(BotFace, {
                      shape,
                      color,
                      image: image && !isBackfilledFacePng(image) ? image : null,
                      size: 20,
                      name: member.name,
                      mood: 'idle'
                    })
                  },
                  botRosterKey(member)
                )
              })
            })
          : jsx(Codicon, { name: 'organization', className: 'text-(--ui-text-tertiary)' })
      }),
      jsxs('div', {
        className: 'min-w-0 flex-1',
        children: [
          jsxs('div', {
            className: 'flex items-baseline justify-between gap-2',
            children: [
              jsxs('div', {
                className: 'flex min-w-0 items-baseline gap-1.5 truncate',
                children: [
                  jsx('span', { className: 'truncate text-[0.8125rem] font-medium', children: group }),
                  jsx('span', {
                    className: 'shrink-0 text-[0.6875rem] text-(--ui-text-quaternary)',
                    children: copy('groups.memberCount', members.length)
                  })
                ]
              }),
              needsYou
                ? jsx('span', {
                    className:
                      'shrink-0 rounded-full bg-(--ui-accent,#4f9cf9) px-1.5 text-[0.6rem] font-semibold text-white',
                    title: copy('groups.needsInputTitle'),
                    children: copy('groups.needsYou')
                  })
                : null,
              lastAt
                ? jsx('span', {
                    className: 'shrink-0 text-[0.6875rem] text-(--ui-text-quaternary)',
                    children: relativeTime(lastAt)
                  })
                : null
            ]
          }),
          jsx('div', {
            className: 'min-w-0 truncate text-xs text-(--ui-text-tertiary)',
            children: preview
          })
        ]
      })
    ]
  })
}

function useHydratedAgentRoster(open, roster, activeConnectionId) {
  const [, setVersion] = useState(0)
  const [loading, setLoading] = useState(false)
  const signature = roster.map(agentDescriptionKey).join('\u0000')

  useEffect(() => {
    let cancelled = false

    if (!open || !roster.length) {
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    const missing = roster.some(
      bot => !cachedAgentDescription(agentDescriptionCache, agentDescriptionKey(bot), Date.now())
    )
    setLoading(missing)

    void hydrateAgentDescriptions(roster, activeConnectionId, host, {
      onUpdate: () => {
        if (!cancelled) {
          setVersion(value => value + 1)
        }
      }
    }).finally(() => {
      if (!cancelled) {
        setLoading(false)
        setVersion(value => value + 1)
      }
    })

    return () => {
      cancelled = true
    }
  }, [activeConnectionId, open, roster, signature])

  return { loading, roster: mergeAgentDescriptions(roster) }
}

function SessionAgentsControl(surface) {
  const copy = useAgentText()
  const { data, rosterOwner: liveRosterOwner } = useRoster()
  const memberships = useValue($collaborationMemberships)
  const projectBindings = useValue($collaborationProjectBindings)
  const sessionBindings = useValue($collaborationSessionBindings)
  const allMeta = useValue($botMeta)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const collaborationSurface = resolveCollaborationSurface(surface, projectBindings, sessionBindings)
  const scopeAvailability = collaborationScopeAvailability(collaborationSurface)
  const sessionAvailable = scopeAvailability.session
  const projectAvailable = scopeAvailability.project
  const [scope, setScope] = useState(sessionAvailable ? 'session' : 'project')
  const hasLiveRoster = Array.isArray(data?.profiles)
  const live = hasLiveRoster ? data.profiles : $lastRoster.get()
  const rawRoster = Array.isArray(live) ? live : []
  const rosterOwner = hasLiveRoster ? liveRosterOwner : $lastRosterOwner.get()
  const scopedRosterOwner = collaborationRosterOwnerForSurface(rosterOwner, collaborationSurface)
  const sourceId = scopeAvailability.sourceId
  const hydrated = useHydratedAgentRoster(open, rawRoster, collaborationSourceId())
  const roster = hydrated.roster
  const lead =
    roster.find(bot => isCollaborationLeadRosterBot(bot, collaborationSurface, scopedRosterOwner)) ||
    { name: collaborationSurface.leadProfile }
  const members = collaborationMembersForSurface(memberships, collaborationSurface, sourceId, sessionBindings)
  const candidates = filterAgentCandidates(
    roster.filter(bot => {
      if (!bot?.name || !collaborationMemberForBot(bot, scopedRosterOwner)) {
        return false
      }

      return !isCollaborationLeadRosterBot(bot, collaborationSurface, scopedRosterOwner)
    }),
    allMeta,
    query,
    copy,
    scopedRosterOwner
  )
  const selectedKeys = new Set(
    collaborationMembersInScope(memberships, collaborationSurface, scope, sourceId, sessionBindings).map(
      collaborationMemberKey
    )
  )
  const scopeAvailable = scope === 'session' ? sessionAvailable : projectAvailable
  const scopeMessageKey = collaborationScopeMessageKey(scope, scopeAvailability)
  const leadMeta = botRosterMeta(lead, allMeta, scopedRosterOwner)
  const leadRole = agentRoleText(lead)
  const leadDescription = agentDescriptionText(lead, leadMeta)
  const leadModel = agentModelText(lead)
  const leadCapability = agentCapabilityText(lead, leadMeta, copy)
  const leadStatus = sessionAgentStatusPresentation('lead', surface, copy)
  const leadAccessibleLabel = agentAccessibleLabel(lead, roster, leadMeta)

  useEffect(() => {
    rememberCollaborationProject(surface, { sessionBindings })
    const projectMigration = migrateLegacyCollaborationProjectScope(
      memberships,
      surface,
      surface.leadConnectionId
    )
    const sessionMigration = migrateRuntimeCollaborationSessionScope(
      projectMigration.store,
      surface,
      surface.leadConnectionId,
      sessionBindings
    )

    if (projectMigration.changed || sessionMigration.changed) {
      saveCollaborationMemberships(sessionMigration.store)
    }
    rememberCollaborationSession(surface)
  }, [
    memberships,
    sessionBindings,
    surface.leadConnectionId,
    surface.leadProfile,
    surface.projectKey,
    surface.projectResolutionKnown,
    surface.runtimeSessionId,
    surface.storedSessionId
  ])

  useEffect(() => {
    if (scope === 'session' && !sessionAvailable && projectAvailable) {
      setScope('project')
    } else if (scope === 'project' && !projectAvailable && sessionAvailable) {
      setScope('session')
    }
  }, [projectAvailable, scope, sessionAvailable])

  const toggleMember = (bot, present) => {
    if (
      !scopeAvailable ||
      !setCollaborationMember(collaborationSurface, scope, bot, present, {
        rosterOwner: scopedRosterOwner,
        sessionBindings
      })
    ) {
      return
    }

    const label = displayName(bot, botRosterMeta(bot, allMeta, scopedRosterOwner))
    host.notify?.({ kind: 'success', message: present ? copy('session.added', label) : copy('session.removed', label) })
  }

  return jsxs(DropdownMenu, {
    open,
    onOpenChange: value => {
      setOpen(value)
      if (!value) {
        setQuery('')
      }
    },
    children: [
      jsx(Tip, {
        label: copy('session.trigger', members.length),
        children: jsx(DropdownMenuTrigger, {
          asChild: true,
          children: jsxs(Button, {
            type: 'button',
            variant: 'ghost',
            size: 'xs',
            className: cn(
              'min-w-0 max-w-36 gap-1 px-1.5 text-[0.6875rem]',
              members.length ? 'text-primary' : 'text-(--ui-text-tertiary)'
            ),
            'aria-label': copy('session.trigger', members.length),
            'data-session-agents-trigger': '',
            children: [
              jsx(Codicon, { name: 'organization', className: 'size-3.5 shrink-0' }),
              jsx('span', {
                className: 'hidden min-w-0 truncate @md:inline',
                children: members.length ? `${copy('session.title')} · ${members.length}` : copy('session.title')
              }),
              jsx(Codicon, { name: 'chevron-down', className: 'size-2.5 shrink-0 opacity-60' })
            ]
          })
        })
      }),
      jsxs(DropdownMenuContent, {
        align: 'end',
        side: 'bottom',
        sideOffset: 6,
        className: 'w-[min(24rem,calc(100vw-1rem))] p-0',
        children: [
          jsxs('div', {
            className: 'border-b border-(--ui-stroke-secondary) px-3 py-2.5',
            children: [
              jsx('div', { className: 'text-sm font-semibold text-foreground', children: copy('session.title') }),
              jsx('div', {
                className: 'mt-0.5 text-[0.6875rem] text-(--ui-text-tertiary)',
                children: copy('session.leadHelp')
              })
            ]
          }),
          jsxs('div', {
            className: 'border-b border-(--ui-stroke-secondary) px-3 py-2',
            children: [
              jsxs('div', {
                className: 'flex min-w-0 items-center gap-2',
                'aria-label': `${leadAccessibleLabel} · ${copy('session.lead')} · ${leadStatus.aria}`,
                role: 'group',
                children: [
                  jsx(BotFace, { ...botAppearance(lead.name, leadMeta), name: lead.name, size: 30 }),
                  jsxs('div', {
                    className: 'min-w-0 flex-1',
                    children: [
                      jsxs('div', {
                        className: 'flex min-w-0 items-center gap-1.5',
                        children: [
                          jsx('span', {
                            className: 'truncate text-xs font-medium text-foreground',
                            children: displayName(lead, leadMeta)
                          }),
                          jsx('span', {
                            className: 'shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.5625rem] font-medium text-primary',
                            children: copy('session.lead')
                          }),
                          jsx('span', {
                            className: cn(
                              'shrink-0 rounded-full px-1.5 py-0.5 text-[0.5625rem] font-medium',
                              leadStatus.active
                                ? 'bg-primary/10 text-primary'
                                : 'bg-(--chrome-action-hover) text-(--ui-text-tertiary)'
                            ),
                            children: leadStatus.text
                          }),
                          leadModel
                            ? jsx('span', {
                                className: 'shrink-0 font-mono text-[0.5625rem] text-(--ui-text-quaternary)',
                                children: leadModel
                              })
                            : null
                        ]
                      }),
                      leadRole
                        ? jsx('div', {
                            className: 'truncate text-[0.625rem] text-(--ui-text-secondary)',
                            children: leadRole
                          })
                        : null,
                      leadDescription
                        ? jsx('div', {
                            className: 'truncate text-[0.625rem] text-(--ui-text-secondary)',
                            children: leadDescription
                          })
                        : null,
                      jsx('div', {
                        className: 'truncate text-[0.625rem] text-(--ui-text-tertiary)',
                        children: leadCapability || `@${botHandle(lead.name, lead)}`
                      })
                    ]
                  })
                ]
              })
            ]
          }),
          members.length
            ? jsxs('div', {
                className: 'border-b border-(--ui-stroke-secondary) px-3 py-2',
                children: [
                  jsx('div', {
                    className: 'mb-1 text-[0.625rem] font-semibold uppercase tracking-wide text-(--ui-text-quaternary)',
                    children: copy('session.collaborators')
                  }),
                  ...members.map(member => {
                    const bot = rosterBotForMember(roster, member, scopedRosterOwner) || {
                      name: member.profile,
                      connectionId: member.connectionId,
                      remoteSource: member.connectionId !== 'local'
                    }
                    const meta = botRosterMeta(bot, allMeta, scopedRosterOwner)
                    const label = displayName(bot, meta)
                    const source = agentSourcePresentation(bot, roster)
                    const accessibleLabel = agentAccessibleLabel(bot, roster, meta)
                    const inScope = member.scopes.includes(scope)
                    const memberStatus = sessionAgentStatusPresentation('collaborator', surface, copy)

                    return jsxs(
                      'div',
                      {
                        className: 'flex min-w-0 items-center gap-2 rounded-md py-1',
                        'aria-label': `${accessibleLabel} · ${memberStatus.aria}`,
                        role: 'group',
                        children: [
                          jsx(BotFace, { ...botAppearance(bot.name, meta), name: bot.name, size: 26 }),
                          jsxs('div', {
                            className: 'min-w-0 flex-1',
                            children: [
                              jsxs('div', {
                                className: 'flex min-w-0 items-center gap-1',
                                children: [
                                  jsx('span', { className: 'truncate text-xs text-foreground', children: label }),
                                  source.visible
                                    ? jsx('span', {
                                        className:
                                          'max-w-32 shrink-0 truncate rounded bg-(--chrome-action-hover) px-1 py-0.5 font-mono text-[0.5625rem] text-(--ui-text-tertiary)',
                                        title: source.source,
                                        children: source.accessible
                                      })
                                    : null,
                                  ...member.scopes.map(value =>
                                    jsx(
                                      'span',
                                      {
                                        className:
                                          'shrink-0 rounded bg-(--chrome-action-hover) px-1 py-0.5 text-[0.5625rem] text-(--ui-text-tertiary)',
                                        children:
                                          value === 'session' ? copy('session.scopeSession') : copy('session.scopeProject')
                                      },
                                      value
                                    )
                                  )
                                ]
                              }),
                              jsx(Tip, {
                                label: copy('session.workHint', botHandle(bot.name, bot)),
                                children: jsx('div', {
                                  className: 'truncate text-[0.625rem] text-(--ui-text-tertiary)',
                                  children: source.visible
                                    ? `${source.source} · ${memberStatus.text}`
                                    : memberStatus.text
                                })
                              })
                            ]
                          }),
                          jsx(Button, {
                            type: 'button',
                            size: 'icon',
                            variant: 'ghost',
                            disabled: !scopeAvailable,
                            'aria-label': inScope
                              ? copy('session.remove', accessibleLabel)
                              : copy('session.invite', accessibleLabel),
                            onClick: event => {
                              event.preventDefault()
                              event.stopPropagation()
                              toggleMember(bot, !inScope)
                            },
                            children: jsx(Codicon, { name: inScope ? 'remove' : 'add', size: '0.8rem' })
                          })
                        ]
                      },
                      collaborationMemberKey(member)
                    )
                  })
                ]
              })
            : null,
          jsxs('div', {
            className: 'grid gap-2 px-3 py-2.5',
            children: [
              jsxs('div', {
                className: 'flex items-center gap-2',
                role: 'group',
                'aria-label': copy('session.scope'),
                children: [
                  jsx('span', {
                    className: 'shrink-0 text-[0.625rem] font-medium text-(--ui-text-tertiary)',
                    children: copy('session.scope')
                  }),
                  jsx(Button, {
                    type: 'button',
                    size: 'xs',
                    variant: scope === 'session' ? 'secondary' : 'ghost',
                    disabled: !sessionAvailable,
                    'aria-pressed': scope === 'session',
                    onClick: () => setScope('session'),
                    children: copy('session.scopeSession')
                  }),
                  jsx(Button, {
                    type: 'button',
                    size: 'xs',
                    variant: scope === 'project' ? 'secondary' : 'ghost',
                    disabled: !projectAvailable,
                    'aria-pressed': scope === 'project',
                    onClick: () => setScope('project'),
                    children: copy('session.scopeProject')
                  })
                ]
              }),
              scopeMessageKey
                ? jsx('div', {
                    className: 'text-[0.625rem] text-(--ui-warning,#d99b2b)',
                    children: copy(scopeMessageKey)
                  })
                : null,
              DropdownMenuSearch
                ? jsx(DropdownMenuSearch, {
                    'aria-label': copy('session.search'),
                    className: 'w-full',
                    placeholder: copy('session.search'),
                    value: query,
                    onValueChange: setQuery
                  })
                : jsx(SearchField, {
                    'aria-label': copy('session.search'),
                    containerClassName: 'w-full',
                    inputClassName: 'w-full',
                    placeholder: copy('session.search'),
                    value: query,
                    onChange: setQuery
                  })
            ]
          }),
          hydrated.loading
            ? jsx('div', {
                'aria-live': 'polite',
                className: 'sr-only',
                children: copy('common.searching')
              })
            : null,
          jsx(ScrollArea, {
            className: 'max-h-64',
            children: candidates.length
              ? jsx('div', {
                  className: 'grid gap-0.5 px-2 pb-2',
                  children: candidates.map(bot => {
                    const member = collaborationMemberForBot(bot, scopedRosterOwner)
                    const identity = collaborationMemberKey(member)
                    const meta = botRosterMeta(bot, allMeta, scopedRosterOwner)
                    const label = displayName(bot, meta)
                    const source = agentSourcePresentation(bot, roster)
                    const accessibleLabel = agentAccessibleLabel(bot, roster, meta)
                    const role = agentRoleText(bot)
                    const description = agentDescriptionText(bot, meta)
                    const model = agentModelText(bot)
                    const capability = agentCapabilityText(bot, meta, copy)
                    const inScope = selectedKeys.has(identity)
                    const CandidateItem = DropdownMenuCheckboxItem || DropdownMenuItem
                    const selectionProps = DropdownMenuCheckboxItem
                      ? {
                          checked: inScope,
                          onCheckedChange: checked => toggleMember(bot, checked === true),
                          onSelect: event => event.preventDefault()
                        }
                      : {
                          role: 'menuitemcheckbox',
                          'aria-checked': inScope,
                          onSelect: event => {
                            event.preventDefault()
                            toggleMember(bot, !inScope)
                          }
                        }

                    return jsxs(
                      CandidateItem,
                      {
                        ...selectionProps,
                        disabled: !scopeAvailable,
                        className:
                          'flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left outline-hidden focus:bg-(--chrome-action-hover) data-[disabled]:cursor-default data-[disabled]:opacity-55',
                        'aria-label': inScope
                          ? `${accessibleLabel} · ${copy('session.joined')}`
                          : copy('session.invite', accessibleLabel),
                        children: [
                          jsx(BotFace, { ...botAppearance(bot.name, meta), name: bot.name, size: 30 }),
                          jsxs('span', {
                            className: 'min-w-0 flex-1',
                            children: [
                              jsxs('span', {
                                className: 'flex min-w-0 items-center gap-1.5',
                                children: [
                                  jsx('span', { className: 'truncate text-xs font-medium text-foreground', children: label }),
                                  source.visible
                                    ? jsx('span', {
                                        className:
                                          'max-w-32 shrink-0 truncate rounded bg-(--chrome-action-hover) px-1 py-0.5 font-mono text-[0.5625rem] text-(--ui-text-tertiary)',
                                        title: source.source,
                                        children: source.accessible
                                      })
                                    : null,
                                  model
                                    ? jsx('span', {
                                        className: 'shrink-0 font-mono text-[0.5625rem] text-(--ui-text-quaternary)',
                                        children: model
                                      })
                                    : null
                                ]
                              }),
                              role
                                ? jsx('span', {
                                    className: 'block truncate text-[0.625rem] text-(--ui-text-secondary)',
                                    children: role
                                  })
                                : null,
                              description
                                ? jsx('span', {
                                    className: 'block truncate text-[0.625rem] text-(--ui-text-secondary)',
                                    children: description
                                  })
                                : null,
                              jsx('span', {
                                className: 'block truncate text-[0.625rem] text-(--ui-text-tertiary)',
                                children: capability || copy('session.capabilities')
                              })
                            ]
                          }),
                          DropdownMenuCheckboxItem && inScope
                            ? null
                            : jsx(Codicon, {
                                name: inScope ? 'check' : 'add',
                                className: 'shrink-0',
                                size: '0.8rem'
                              })
                        ]
                      },
                      botRosterKey(bot)
                    )
                  })
                })
              : jsx('div', {
                  'aria-live': 'polite',
                  className: 'px-4 py-5 text-center text-xs text-(--ui-text-tertiary)',
                  children: hydrated.loading
                    ? copy('common.searching')
                    : query.trim()
                      ? copy('session.noMatch')
                      : copy('session.noCandidates')
                })
          }),
          jsx('div', {
            className: 'border-t border-(--ui-stroke-secondary) p-2',
            children: jsxs(DropdownMenuItem, {
              className: 'w-full cursor-pointer justify-start gap-2 px-2 py-1.5',
              onSelect: () => {
                setOpen(false)
                host.navigate(AGENT_MANAGEMENT_PATH)
              },
              children: [jsx(Codicon, { name: 'settings-gear' }), copy('session.manage')]
            })
          })
        ]
      })
    ]
  })
}

function AgentsManagementPage() {
  const copy = useAgentText()
  const [tab, setTab] = useState('agents')

  return jsxs('div', {
    className: 'flex h-full min-w-0 flex-col overflow-hidden bg-(--ui-chat-surface-background)',
    'data-agents-management-page': '',
    children: [
      jsxs('header', {
        className: 'border-b border-(--ui-stroke-secondary) px-5 py-4',
        children: [
          jsx('h1', { className: 'text-base font-semibold text-foreground', children: copy('management.title') }),
          jsx('p', {
            className: 'mt-1 max-w-3xl text-xs text-(--ui-text-tertiary)',
            children: copy('management.description')
          }),
          jsxs('div', {
            className: 'mt-3 flex items-center gap-1',
            children: [
              jsx(Button, {
                type: 'button',
                size: 'sm',
                variant: tab === 'agents' ? 'secondary' : 'ghost',
                onClick: () => setTab('agents'),
                children: copy('management.agents')
              }),
              jsx(Button, {
                type: 'button',
                size: 'sm',
                variant: tab === 'routines' ? 'secondary' : 'ghost',
                onClick: () => setTab('routines'),
                children: copy('management.routines')
              })
            ]
          })
        ]
      }),
      jsx('main', {
        className: 'min-h-0 min-w-0 flex-1 overflow-hidden',
        children: tab === 'agents' ? jsx(BotsPane, { management: true }) : jsx(RoutinesPane, {})
      })
    ]
  })
}

function BotsPane({ management = false } = {}) {
  const copy = useAgentText()
  const { data, error, isLoading, refetch, rosterOwner } = useRoster()
  const gatewayState = useValue(host.state.gateway)
  const gatewayUp = gatewayState === 'open'
  const activeProfile = (useValue(host.state.profile) || 'default').trim() || 'default'
  const currentProfileActionOwner = {
    connectionId: String(host.state.connectionId?.get?.() || 'local').trim() || 'local',
    profile: activeProfile
  }
  const [createOpen, setCreateOpen] = useState(false)
  const [groupCreateOpen, setGroupCreateOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [grouping, setGrouping] = useState(null)
  const [query, setQuery] = useState('')
  const newAgentRequest = useValue($newAgentRequest)
  const activityToasts = useValue($activityToasts)
  const sessionsWorkspaceName = useValue($botSessionsWorkspace)
  const groupChatName = useValue($groupChatWorkspace)
  const groupNeedsYou = useValue($groupNeedsYou)
  const groupRooms = useValue($groupChats)

  useEffect(() => {
    if (management && newAgentRequest > 0 && consumeNewAgentRequest()) {
      setCreateOpen(true)
    }
  }, [management, newAgentRequest])

  // The socket opening (boot, SSH reconnect, sleep/wake) is the signal to
  // retry immediately instead of waiting out the poll interval.
  useEffect(() => {
    if (gatewayUp) {
      void refetch()
    }
  }, [gatewayUp, refetch])
  const allMeta = useValue($botMeta)
  // Messaging-app order: most recent activity first, where "activity" is
  // the newest of (bot created, last message in any of its sessions). A
  // freshly created bot tops the list until another bot gets a message.
  // No special slot for the primary bot — it competes on recency too.
  const activityOf = bot => rosterActivity(bot, allMeta, rosterOwner)
  // Pinned bots (right-click → Pin) float to the top as a group; within the
  // pinned group and within the unpinned group, recency still rules. A
  // plain boolean flag in bot-meta (rides ui_meta to every machine).
  const isPinned = bot => rosterPinned(bot, allMeta, rosterOwner)
  // Resilience (@wesleysimplicio, #13): a failed refresh must not erase a
  // roster the user already had — mixed local+cloud gateways and remotes
  // waking from sleep fail transiently. Render the last good snapshot with
  // a notice; the full error card is reserved for "never had a roster".
  const live = Array.isArray(data?.profiles) ? data.profiles : null
  const source = live ?? (error ? $lastRoster.get() : [])
  const roster = sortRosterSnapshot(source, allMeta, rosterOwner)
  const activeSourceRoster = roster.filter(bot => !bot.remoteSource)
  const groupEligibleRoster = groupChatEligibleBots(roster, rosterOwner)
  // Hidden bots (right-click → Hide Bot) drop out of the roster list unless
  // the header eye toggle reveals them. Display-only: every other consumer
  // (mentions, group chats, name-collision checks, merge/avatar/activity
  // sweeps) keeps the FULL roster.
  const showHidden = useValue($showHiddenBots)
  const unreadByName = useValue($botUnread)
  const hiddenBots = roster.filter(bot => isBotHidden(bot, allMeta, rosterOwner))
  const hiddenUnread = hiddenBots.some(bot => !bot.remoteSource && unreadByName[bot.name])
  const visibleRoster = showHidden ? roster : roster.filter(bot => !isBotHidden(bot, allMeta, rosterOwner))
  const filteredRoster = filterBots(visibleRoster, allMeta, query, rosterOwner)
  // Group chats are first-class roster rows (Discord-style): one standalone
  // row per room, competing in the SAME recency ordering as bot rows — a
  // group's activity is its newest room-log line. Pinned bots still lead;
  // groups and unpinned bots interleave by recency below them.
  const needle = query.trim().toLowerCase()
  const scopedLegacyMeta =
    isExactLocalRosterOwner(rosterOwner) && sameRosterOwner($botMetaOwner.get(), rosterOwner) ? allMeta : {}
  const groupRows = groupChatNames(scopedLegacyMeta, groupRooms)
    .filter(name => !needle || name.toLowerCase().includes(needle))
    .map(name => ({
      kind: 'group',
      name,
      members: groupChatMemberBots(name, roster, allMeta),
      activity: groupLastActivity(groupRooms[name])
    }))
  const rosterRows = [
    ...filteredRoster.map(bot => ({ kind: 'bot', bot, pinned: isPinned(bot), activity: activityOf(bot) })),
    ...groupRows
  ].sort((a, b) => {
    const pa = a.pinned ? 1 : 0
    const pb = b.pinned ? 1 : 0

    if (pa !== pb) {
      return pb - pa
    }

    return b.activity - a.activity
  })

  const staleNotice = error && !live && roster.length
    ? copy('roster.stale') + (gatewayUp ? '' : copy('roster.waitingReconnect'))
    : null
  const sessionsWorkspaceBot = roster.find(bot => bot.name === sessionsWorkspaceName)

  if (sessionsWorkspaceBot) {
    return jsx(ProfileSessionsWorkspace, { bot: sessionsWorkspaceBot })
  }

  const groupChatMembers = groupChatName ? groupChatMemberBots(groupChatName, roster, allMeta) : []

  if (groupChatName && groupChatMembers.length) {
    return jsx(GroupChatWorkspace, { group: groupChatName, members: groupChatMembers, rosterOwner })
  }

  return jsxs('div', {
    className: 'flex h-full flex-col',
    children: [
      jsxs('div', {
        className: 'flex items-center justify-between gap-2 px-2.5 pt-2.5 pb-1.5',
        children: [
          jsx('span', {
            className: 'text-[0.6875rem] font-semibold uppercase tracking-wider text-(--ui-text-quaternary)',
            children: copy('roster.title')
          }),
          jsxs('div', {
            className: 'flex items-center gap-0.5',
            children: [
              jsx(Tip, {
                label: activityToasts ? copy('roster.toastsOn') : copy('roster.toastsOff'),
                children: jsx('button', {
                  type: 'button',
                  className:
                    'flex size-6 items-center justify-center rounded-md text-(--ui-text-tertiary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground',
                  onClick: () => setActivityToasts(!activityToasts),
                  children: jsx(Codicon, { name: activityToasts ? 'bell' : 'bell-slash' })
                })
              }),
              // Eye toggle appears only once something is hidden — zero
              // hidden bots means zero extra chrome. It stays visible while
              // hidden rows are revealed, so Unhide is always reachable.
              hiddenBots.length
                ? jsx(Tip, {
                    label: showHidden
                      ? copy('roster.hideHiddenAgain')
                      : copy('roster.showHidden', hiddenBots.length),
                    children: jsxs('button', {
                      type: 'button',
                      'aria-label': showHidden ? copy('roster.hideHidden') : copy('roster.showHiddenAria'),
                      className: cn(
                        'relative flex size-6 items-center justify-center rounded-md transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground',
                        showHidden ? 'text-foreground' : 'text-(--ui-text-tertiary)'
                      ),
                      onClick: () => $showHiddenBots.set(!showHidden),
                      children: [
                        jsx(Codicon, { name: showHidden ? 'eye' : 'eye-closed' }),
                        hiddenUnread && !showHidden
                          ? jsx('span', {
                              className:
                                'absolute right-0.5 top-0.5 size-1.5 rounded-full bg-(--ui-accent,#4f9cf9)',
                              'aria-label': copy('roster.hiddenUnread')
                            })
                          : null
                      ]
                    })
                  })
                : null,
              jsxs(DropdownMenu, {
                children: [
                  jsx(Tip, {
                    label: copy('roster.newMenu'),
                    children: jsx(DropdownMenuTrigger, {
                      asChild: true,
                      children: jsx('button', {
                        type: 'button',
                        'aria-label': copy('roster.newAria'),
                        className:
                          'flex size-6 items-center justify-center rounded-md text-(--ui-text-tertiary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground',
                        children: jsx(Codicon, { name: 'add' })
                      })
                    })
                  }),
                  jsxs(DropdownMenuContent, {
                    align: 'end',
                    children: [
                      jsxs(DropdownMenuItem, {
                        onSelect: () => setCreateOpen(true),
                        children: [jsx(Codicon, { name: 'hubot', className: 'mr-1.5' }), copy('common.newAgent')]
                      }),
                      jsxs(DropdownMenuItem, {
                        disabled: groupEligibleRoster.length < 2,
                        onSelect: () => setGroupCreateOpen(true),
                        children: [jsx(Codicon, { name: 'organization', className: 'mr-1.5' }), copy('common.newGroupChat')]
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      }),
      jsx(ActiveNowStrip, {
        roster: visibleRoster,
        activeProfile,
        gatewayState,
        metaByName: allMeta,
        rosterOwner,
        onOpen: bot => {
          haptic('tap')
          $selectedBot.set(bot.name)

          if (bot.remoteSource) {
            const handle = botHandle(bot.name, bot)
            host.notify?.({
              kind: 'info',
              title: displayName(bot),
              message: copy('remote.stayHere', handle)
            })
            return
          }

          if ($botUnread.get()[bot.name]) {
            const next = { ...$botUnread.get() }
            delete next[bot.name]
            $botUnread.set(next)
          }

          void (async () => {
            let pinnedChat = botRosterMeta(bot, allMeta, rosterOwner)?.chat

            try {
              pinnedChat = await prepareBotSource(bot, pinnedChat)
            } catch (error) {
              host.notifyError?.(error, copy('remote.couldNotReach', bot.connectionLabel || copy('remote.sourceFallback')))

              return
            }

            const openOwner = normalizeRosterOwner(bot.connectionId || rosterOwner?.connectionId, rosterOwner?.profile)

            if (!openOwner || !rosterOwnerStillActive(openOwner)) {
              return
            }

            try {
              const id = await openBotCanonicalChat(bot.name, pinnedChat, bot.last_session, openOwner)

              if (id) {
                return
              }
            } catch {
              // Fall through to the older-gateway draft below.
            }

            if (!rosterOwnerStillActive(openOwner)) {
              return
            }

            if (typeof host.newChat === 'function') {
              host.newChat(bot.name)
            } else {
              host.navigate('/')
            }
          })()
        }
      }),
      roster.length
        ? jsx('div', {
            className: 'px-2.5 pb-1.5',
            children: jsx(SearchField, {
              'aria-label': copy('roster.searchAria'),
              containerClassName: 'w-full',
              inputClassName: 'w-full',
              placeholder: copy('roster.searchPlaceholder'),
              value: query,
              onChange: setQuery
            })
          })
        : null,
      staleNotice
        ? jsx('div', {
            className: 'mx-2.5 mb-1 rounded-md bg-(--chrome-action-hover) px-2 py-1.5 text-[0.6875rem] text-(--ui-text-tertiary)',
            children: staleNotice
          })
        : null,
      isLoading && !roster.length
        ? jsx('div', {
            className: 'flex flex-1 items-center justify-center',
            children: jsx(GlyphSpinner, { spinner: 'breathe', className: 'text-(--ui-text-tertiary)' })
          })
        : error && !roster.length
          ? jsxs('div', {
              className: 'grid gap-2 px-3 py-4 text-xs text-(--ui-text-tertiary)',
              children: [
                jsx('div', {
                  children: gatewayUp
                    ? copy('roster.unavailable', error instanceof Error ? error.message : copy('roster.gatewayError'))
                    : copy('roster.waitingGateway')
                }),
                jsx(Button, {
                  variant: 'secondary',
                  size: 'sm',
                  className: 'justify-self-start',
                  onClick: () => void refetch(),
                  children: copy('common.retryNow')
                })
              ]
            })
          : roster.length === 0
            ? jsx(EmptyState, {
                icon: 'hubot',
                title: copy('roster.none'),
                description: copy('roster.noneHelp')
              })
            : filteredRoster.length === 0 && rosterRows.length === 0
              ? jsx('div', {
                  'aria-live': 'polite',
                  className:
                    'flex flex-1 items-center justify-center px-4 text-center text-xs text-(--ui-text-tertiary)',
                  role: 'status',
                  children: query.trim()
                    ? copy('roster.noMatch', query.trim())
                    : copy('roster.allHidden')
                })
              : jsx(ScrollArea, {
                  className: 'hermes-bots-roster min-h-0 flex-1',
                  children: jsx('div', {
                    className: 'grid w-full min-w-0 gap-0.5 px-1.5 pb-2',
                    // Flat, Discord-style list: bot rows and group rows
                    // interleaved by recency — no section headers.
                    children: rosterRows.map(row =>
                      row.kind === 'group'
                        ? jsx(
                            GroupRow,
                            {
                              group: row.name,
                              members: row.members,
                              needsYou: Boolean(groupNeedsYou[row.name]),
                              onOpen: openGroupChat
                            },
                            `group:${row.name}`
                          )
                        : jsx(
                            BotRow,
                            {
                              bot: row.bot,
                              rosterOwner,
                              onDelete: setDeleting,
                              onEdit: setEditing,
                              onGroup: setGrouping
                            },
                            botRosterKey(row.bot)
                          )
                    )
                  })
                }),
      jsx('div', {
        className: 'border-t border-(--ui-stroke-secondary) p-2',
        children: jsxs(Button, {
          className: 'w-full justify-center gap-1.5',
          variant: 'secondary',
          onClick: () => setCreateOpen(true),
          children: [jsx(Codicon, { name: 'add' }), copy('common.newAgent')]
        })
      }),
      jsx(CreateAgentDialog, {
        open: createOpen,
        onClose: () => {
          setCreateOpen(false)
          void refetch()
        },
        roster: activeSourceRoster
      }),
      jsx(CreateGroupChatDialog, {
        open: groupCreateOpen,
        // Full multi-source roster: group chats can seat bots from other
        // registered connections — their turns route to their own machines.
        roster: groupEligibleRoster,
        rosterOwner,
        onClose: () => setGroupCreateOpen(false),
        onCreated: groupName => openGroupChat(groupName)
      }),
      jsx(EditProfileDialog, {
        bot: agentProfileActionMatchesOwner(editing, currentProfileActionOwner) ? editing : null,
        open: agentProfileActionMatchesOwner(editing, currentProfileActionOwner),
        onClose: () => {
          setEditing(null)
          void refetch()
        }
      }),
      agentProfileActionMatchesOwner(grouping, currentProfileActionOwner)
        ? jsx(GroupDialog, { bot: grouping, onClose: () => setGrouping(null) })
        : null,
      jsx(ConfirmDialog, {
        open: agentProfileActionMatchesOwner(deleting, currentProfileActionOwner),
        title: copy('roster.deleteTitle'),
        description: deleting
          ? jsxs('span', {
              children: [
                copy('roster.deleteDescriptionStart'),
                jsx('span', { className: 'font-medium text-foreground', children: deleting.name }),
                copy('roster.deleteDescriptionMiddle'),
                jsx('span', { className: 'font-mono text-xs', children: deleting.path }),
                copy('roster.deleteDescriptionEnd')
              ]
            })
          : null,
        destructive: true,
        confirmLabel: copy('common.delete'),
        busyLabel: copy('common.deleting'),
        doneLabel: copy('common.deleted'),
        onClose: () => setDeleting(null),
        onConfirm: async () => {
          const liveOwner = {
            connectionId: String(host.state.connectionId?.get?.() || 'local').trim() || 'local',
            profile: String(host.state.profile?.get?.() || 'default').trim() || 'default'
          }

          if (!agentProfileActionMatchesOwner(deleting, liveOwner)) {
            throw new Error(copy('profile.sourceChanged'))
          }

          const name = deleting.name
          await deleteBot(deleting)
          await refetch()
          host.notify({ kind: 'success', message: copy('profile.deleted', name) })
        }
      })
    ]
  })
}

// ── plugin ───────────────────────────────────────────────────────────────────

function registerAgentSurfaces(ctx, namespace) {
  const capabilities = namespace ?? (typeof sdk === 'undefined' ? null : sdk)
  const registered = []

  if (typeof capabilities?.SESSION_AGENTS_AREA === 'string') {
    ctx.register({
      id: 'session-control',
      area: capabilities.SESSION_AGENTS_AREA,
      data: { render: surface => jsx(SessionAgentsControl, surface) }
    })
    registered.push('session-control')
  }

  if (typeof capabilities?.ROUTES_AREA === 'string') {
    ctx.register({
      id: 'management-page',
      area: capabilities.ROUTES_AREA,
      data: { path: AGENT_MANAGEMENT_PATH },
      render: () => jsx(AgentsManagementPage, {})
    })
    registered.push('management-page')
  }

  return registered
}

function createAgentPaletteContributions(options = {}) {
  const text = typeof options.text === 'function' ? options.text : agentText
  const navigate = typeof options.navigate === 'function' ? options.navigate : path => host.navigate(path)
  const queueNew = typeof options.queueNew === 'function' ? options.queueNew : queueNewAgentRequest

  // The management page is optional on older SDKs. Do not publish commands
  // that can only navigate to an unregistered/dead route.
  if (options.routeAvailable === false) {
    return []
  }

  return [
    {
      id: 'manage-agents',
      area: PALETTE_AREA,
      data: {
        id: `${ID}.manage-agents`,
        label: () => text('palette.manage'),
        keywords: ['agents', 'profiles', 'capabilities', 'routines', 'manage'],
        run: () => navigate(AGENT_MANAGEMENT_PATH)
      }
    },
    {
      id: 'new-agent',
      area: PALETTE_AREA,
      data: {
        id: `${ID}.new-agent`,
        label: () => text('palette.newAgent'),
        keywords: ['bot', 'agent', 'profile', 'teammate', 'create'],
        run: () => {
          queueNew()
          navigate(AGENT_MANAGEMENT_PATH)
        }
      }
    }
  ]
}

// Executable, side-effect-free seams for Node behavior tests. Keeping them on
// the default single-file plugin avoids a second runtime module and avoids
// tests that copy, regex, or evaluate slices of production source.
const hermesBotsTesting = Object.freeze({
  AGENT_LOCALES,
  agentCapabilityCatalogRequestCurrent,
  agentCapabilityCatalogScopeKey,
  agentDraftFinalizePlan,
  agentAccessibleLabel,
  agentCapabilityText,
  agentCreationFieldsLocked,
  agentCreateAuthPayload,
  agentSharedAuthCreateResultAccepted,
  agentDraftProtocolInjected,
  agentDeleteClearsLegacyMeta,
  agentEmbeddedCapabilitiesAvailable,
  agentMcpSetupAvailable,
  agentProfileDeleteRoute,
  agentProfileActionMatchesOwner,
  agentProfileActionsAvailable,
  agentDescriptionText,
  agentDescriptionKey,
  agentRoleText,
  agentSourcePresentation,
  agentSourceUnavailableMessage,
  applyAgentDraftAppearance,
  botRosterMeta,
  canonicalCreationKey,
  cachedRosterSnapshot,
  collaborationMemberKey,
  collaborationMemberForBot,
  collaborationMembersInScope,
  collaborationMembersForSurface,
  collaborationProjectBindingKeys,
  collaborationProjectBindingKey,
  collaborationSessionBindingKey,
  collaborationRosterOwnerForSurface,
  collaborationScopeAvailability,
  collaborationScopeKey,
  collaborationScopeMessageKey,
  composeSoul,
  consumeNewAgentRequest,
  captureAgentProfileAction,
  createAgentDraftLifecycle,
  createAgentDraftProvenance,
  createAgentPaletteContributions,
  createMcpRequester,
  createRosterSnapshotCoordinator,
  createRosterOwnerRequester,
  durableGroupChatMembers,
  emptyCollaborationMemberships,
  ensureMessagingProtocol,
  ensureRemoteCanonicalChat,
  filterAgentCandidates,
  groupChatEligibleBots,
  groupChatMemberBots,
  hydrateAgentDescriptions,
  hasMessagingProtocol,
  backfillMessagingProtocol,
  mergeAgentDescriptions,
  mergeCollaborationMemberships,
  mergeCollaborationSessionBindings,
  migrateLegacyCollaborationProjectScope,
  migrateRuntimeCollaborationSessionScope,
  normalizeAgentDescription,
  normalizeAgentConnections,
  normalizeCollaborationMemberships,
  normalizeCollaborationProjectBindings,
  normalizeCollaborationSessionBindings,
  normalizeRosterOwner,
  invokeAgentProfileAction,
  isCollaborationLeadRosterBot,
  isLegacyDelegatedRoutine,
  queueNewAgentRequest,
  registerAgentLocales,
  registerAgentSurfaces,
  rememberCollaborationProject,
  rememberCollaborationSession,
  prepareBotSource,
  persistAvatarForOwner,
  requestAgentDraft,
  requestForBot,
  resolveCollaborationSurface,
  resolveRosterMentions,
  rosterOwnerStillActive,
  rosterBotForMember,
  rosterMentionCompletionsFromCache,
  rosterMentionsFromCache,
  routineCreateTarget,
  routineFilterHint,
  routineInputError,
  routineOwnerKey,
  routinePrompt,
  routineQueryKey,
  selectRoutineJobs,
  runRoutineAction,
  loadRoutines,
  loadAdvancedProfileConfig,
  loadAgentCapabilityCatalog,
  mcpRpc,
  mcpSetupSupported,
  sessionAgentStatusPresentation,
  setCollaborationMember,
  sortRosterSnapshot,
  updateCollaborationMembership,
  updateCollaborationProjectBinding,
  updateCollaborationSessionBinding,
  updateDurableGroupMembership
})

export default {
  __testing: hermesBotsTesting,
  id: ID,
  name: 'Agents',
  description: agentManifestDescription,
  required: true,
  register(ctx) {
    pluginCtx = ctx
    registerAgentLocales(ctx)
    startFaceClock()
    // Disabling the plugin (or a hot reload) must actually stop the clock —
    // before this, the rAF loop + 1Hz document scan ran until app restart.
    if (typeof ctx.onDispose === 'function') {
      ctx.onDispose(stopFaceClock)
    }

    // @-mention autocomplete: typing "@rese…" in ANY composer offers the
    // roster's handles (issue #88060). Reads the roster straight from the
    // query cache — useRoster keeps it ≤5s stale and the popover must answer
    // synchronously per keystroke. Multi-source rosters contribute their
    // precomputed @name-device handles via botHandle. The active profile is
    // excluded (a bot doesn't @ itself); 'default' surfaces as @hermes.
    ctx.register({
      id: 'mention-completions',
      area: COMPOSER_AREAS.atCompletions,
      data: {
        provide: query => {
          const active = (host.state.profile.get() || 'default').trim() || 'default'
          const live = {
            name: active,
            connectionId: String(host.state.connectionId?.get?.() || host.activeConnectionId?.() || 'local')
          }

          return rosterMentionCompletionsFromCache(
            query,
            queryClient,
            host.state.connectionId?.get?.(),
            live,
            $botMeta.get()
          )
        }
      }
    })

    // Keyframes for the pet bob — injected because plugin classes aren't in
    // the app's precompiled CSS. Idempotent across hot reloads.
    if (!document.getElementById('hermes-bots-keyframes')) {
      const style = document.createElement('style')
      style.id = 'hermes-bots-keyframes'
      style.textContent = '@keyframes hermes-bots-bob { from { transform: translateY(0); } to { transform: translateY(-3px); } }'
      document.head.appendChild(style)
    }

    // Hydrate persisted avatars/titles only for the explicit local source.
    // `bot-meta` predates Connections and is keyed by bare profile name, so
    // loading it while A/B/unknown is active would let same-named Agents
    // borrow local metadata. Re-run when a later source transition reaches
    // `local`; older storage remains compatible without becoming global.
    const hydrateLocalBotMeta = () => {
      try {
        Promise.resolve(ctx.storage?.get?.('bot-meta'))
          .then(value => {
            const owner = currentBotMetaOwner()

            if (!isExactLocalRosterOwner(owner) || !value || typeof value !== 'object' || Array.isArray(value)) {
              return
            }

            const live = isExactLocalRosterOwner($botMetaOwner.get()) ? $botMeta.get() : {}
            const next = { ...value }
            for (const name of Object.keys(live)) {
              next[name] = { ...(value[name] || {}), ...live[name] }
            }
            $botMetaOwner.set(owner)
            $botMeta.set(next)
          })
          .catch(() => undefined)
      } catch {
        /* no storage on this shell — defaults stay */
      }
    }

    hydrateLocalBotMeta()
    const unbindBotMetaConnection = host.state.connectionId?.listen?.(hydrateLocalBotMeta)

    if (typeof unbindBotMetaConnection === 'function' && typeof ctx.onDispose === 'function') {
      ctx.onDispose(unbindBotMetaConnection)
    }

    // Bot Mode sessions are always hidden now — the old "hide Bot Chats"
    // pref is gone (its stored key is simply ignored). The reconciliation
    // sweep below hides any rows born visible under the old pref.

    // Hydrate the activity-toast pref (default OFF).
    try {
      Promise.resolve(ctx.storage?.get?.('activity-toasts'))
        .then(value => {
          if (typeof value === 'boolean') {
            $activityToasts.set(value)
          }
        })
        .catch(() => undefined)
    } catch {
      /* no storage — default (silent) stays */
    }

    // Hydrate persisted group-chat room logs (epoch/running are runtime-only
    // and always reset — a loop can't survive a window reload anyway).
    try {
      Promise.resolve(ctx.storage?.get?.('group-chats'))
        .then(value => {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            const rooms = {}

            for (const [name, room] of Object.entries(value)) {
              if (room && Array.isArray(room.log)) {
                rooms[name] = {
                  log: room.log,
                  watermarks: room.watermarks && typeof room.watermarks === 'object' ? room.watermarks : {},
                  sessions: room.sessions && typeof room.sessions === 'object' ? room.sessions : {},
                  stranded: room.stranded && typeof room.stranded === 'object' ? room.stranded : {},
                  members: Array.isArray(room.members) ? room.members : [],
                  epoch: 0,
                  running: false
                }
              }
            }

            $groupChats.set({ ...rooms, ...$groupChats.get() })
          }
        })
        .catch(() => undefined)
    } catch {
      /* no storage — rooms start empty */
    }

    // v31 collaborator membership is additive. It never rewrites legacy
    // profile, session, group-chat, or routine data, and malformed records
    // safely become an empty set.
    try {
      Promise.resolve(ctx.storage?.get?.(COLLABORATION_KEY, emptyCollaborationMemberships()))
        .then(value => {
          const merged = mergeCollaborationMemberships(value, $collaborationMemberships.get())

          if (hasFutureCollaborationSchema(merged)) {
            $collaborationMemberships.set(merged)
          } else {
            saveCollaborationMemberships(merged)
          }
        })
        .catch(() => undefined)
    } catch {
      /* no storage — invitations made in this window remain available */
    }

    try {
      Promise.resolve(ctx.storage?.get?.(COLLABORATION_PROJECT_BINDINGS_KEY, {}))
        .then(value => {
          const stored = normalizeCollaborationProjectBindings(value)
          const live = $collaborationProjectBindings.get()

          saveCollaborationProjectBindings({ ...stored, ...live })
        })
        .catch(() => undefined)
    } catch {
      /* no storage — bindings learned in this window remain available */
    }

    try {
      Promise.resolve(ctx.storage?.get?.(COLLABORATION_SESSION_BINDINGS_KEY, {}))
        .then(value => {
          const merged = mergeCollaborationSessionBindings(value, $collaborationSessionBindings.get())

          saveCollaborationSessionBindings(merged)
        })
        .catch(() => undefined)
    } catch {
      /* no storage — the live runtime/durable bridge remains available */
    }

    // Routines follow the chat you're in: track the live gateway profile.
    // Capture the unbinds: without them a disable → re-enable cycle stacks a
    // duplicate listener per cycle (same survives-disable class as the face
    // clock before its onDispose hook — these kept firing until app restart).
    const unbindProfileListener = host.state.profile.listen(profile => {
      if (profile && typeof profile === 'string') {
        $selectedBot.set(profile)
      }
    })
    const unbindGatewayListener = host.state.gateway.listen(handleSessionsGatewayTransition)

    if (typeof ctx.onDispose === 'function') {
      ctx.onDispose(() => {
        if (typeof unbindProfileListener === 'function') {
          unbindProfileListener()
        }
        if (typeof unbindGatewayListener === 'function') {
          unbindGatewayListener()
        }
      })
    }

    // Reconciliation sweep: hide every Bot Mode session we know about, on
    // load and again on each reconnect (a swap can land on a gateway whose
    // rows were created before the always-hidden policy). Deferred a tick so
    // the meta/room storage hydrates above have landed; idempotent after that.
    // (Feature-guarded: bare vm test harnesses have no setTimeout global.)
    const scheduleHideSweep = () => {
      try {
        setTimeout(() => void hideOwnedBotSessions(), 0)
      } catch {
        void hideOwnedBotSessions()
      }
    }
    host.state.gateway.listen(state => {
      if (state === 'open') {
        scheduleHideSweep()
      }
    })
    scheduleHideSweep()

    // The v31 entry is owned by each chat header, not by a dismissible pane.
    // Feature-detection keeps this single-file plugin importable by older SDKs;
    // the v31 bundled desktop always exposes both contribution areas.
    const registeredAgentSurfaces = registerAgentSurfaces(ctx)

    const paletteContributions = createAgentPaletteContributions({
      routeAvailable: registeredAgentSurfaces.includes('management-page')
    })

    if (typeof ctx.registerMany === 'function') {
      ctx.registerMany(paletteContributions)
    } else {
      for (const contribution of paletteContributions) {
        ctx.register(contribution)
      }
    }

    // @-mention middleware: "@<bot> do the thing" in any chat becomes an
    // explicit handoff instruction the active agent's SOUL.md knows how to
    // execute. Names are validated against the LIVE roster so
    // "user@example.com" or an unknown @ passes through untouched.
    ctx.register({
      id: 'mention-middleware',
      area: COMPOSER_AREAS.middleware,
      data: {
        handler: async draft => {
          const text = draft.text || ''

          // /new inside a bot's canonical forever-chat would fork the
          // relationship into a scratch session — the one thing Bots mode
          // promises never happens. Reroute to /compact (same felt effect:
          // fresh working context, SAME conversation) and say so. Only
          // guards the canonical chat: Sessions-mode scratchpads on the
          // same profile keep full /new freedom.
          const slashNew = /^\/(new|reset)\s*$/.exec(text.trim())

          if (slashNew) {
            const activeBot = $selectedBot.get()
            const owner = currentBotMetaOwner()
            const cached = owner
              ? cachedRosterSnapshot(queryClient, owner.connectionId, owner.profile)
              : null
            const row = cached?.profiles?.find(bot =>
              isActiveRosterBot(bot, { name: activeBot, connectionId: owner?.connectionId })
            )
            const meta = activeBot
              ? botRosterMeta(
                  row || {
                    name: activeBot,
                    connectionId: owner?.connectionId,
                    connectionKind: owner?.connectionId === 'local' ? 'local' : undefined
                  },
                  $botMeta.get(),
                  cached?.rosterOwner || owner
                )
              : null
            const pinnedId = meta?.chat || null
            const currentId = host.activeSessionId?.get?.() ?? null

            if (activeBot && pinnedId && currentId && String(currentId) === String(pinnedId)) {
              host.notify({
                kind: 'info',
                title: agentText('profile.continuousTitle'),
                message: agentText('profile.continuousMessage')
              })

              return { ...draft, text: '/compact' }
            }
          }

          if (!/(^|\s)@[a-z0-9][a-z0-9_-]*/i.test(text)) {
            return draft
          }

          const live = {
            name: (host.state.profile.get() || 'default').trim() || 'default',
            connectionId: String(host.state.connectionId?.get?.() || host.activeConnectionId?.() || 'local')
          }
          const cachedMentions = rosterMentionsFromCache(
            text,
            live,
            queryClient,
            host.state.connectionId?.get?.()
          )
          let mentionedBots = cachedMentions || []

          if (cachedMentions === null) {
            let names = []
            try {
              const res = await host.request('profiles.list', { include_sessions: false })
              names = (res?.profiles ?? []).map(p => p.name)
            } catch {
              return draft
            }

            const prose = text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ')
            const mentioned = []

            for (const match of prose.matchAll(/(^|\s)@([a-z0-9][a-z0-9_-]*)/gi)) {
              let name = match[2].toLowerCase()

              if (name === 'hermes' && !names.includes('hermes') && names.includes('default')) {
                name = 'default'
              }

              if (names.includes(name) && name !== live.name && !mentioned.includes(name)) {
                mentioned.push(name)
              }
            }

            mentionedBots = mentioned.map(name => ({ name }))
          }

          if (!mentionedBots.length) {
            return draft
          }

          const localMentions = mentionedBots.filter(bot => !bot.remoteSource)
          const remoteMentions = mentionedBots.filter(bot => bot.remoteSource)

          const activeOwner = currentBotMetaOwner()
          const activeSnapshot = activeOwner
            ? cachedRosterSnapshot(queryClient, activeOwner.connectionId, activeOwner.profile)
            : null
          const activeRow = activeSnapshot?.profiles?.find(bot => isActiveRosterBot(bot, live))
          const activeMeta = botRosterMeta(
            activeRow || {
              name: live.name,
              connectionId: activeOwner?.connectionId,
              connectionKind: activeOwner?.connectionId === 'local' ? 'local' : undefined
            },
            $botMeta.get(),
            activeSnapshot?.rosterOwner || activeOwner
          )
          const senderName = displayName({ name: live.name, title: activeMeta?.title }, activeMeta)

          if (remoteMentions.length && typeof host.requestProfile === 'function') {
            void deliverRemoteRosterMentions(remoteMentions, text, {
              name: senderName,
              handle: botHandle(live.name)
            })
          }
          let note = ''

          if (localMentions.length) {
            note +=
              '\n\n[@mention handoff — for each mentioned agent (' + localMentions.map(bot => botHandle(bot.name, bot)).join(', ') + '): ' +
              'COMPOSE a message from you (' + senderName + ') to that agent conveying what the user wants — do not forward this text verbatim (avoid double quotes in your composed message). Send it with exactly one terminal call, run with background=true AND notify_on_complete=true (the recipient may take minutes; the user must not be blocked):\n' +
              localMentions.map(bot => '`hermes -p ' + shellQuote(bot.name) + ' chat --in ~ -c "Bot Chat" --create-if-missing -Q -q "Message from 🤖 ' + shellDoubleQuote(senderName) + ' (@' + shellDoubleQuote(botHandle(live.name)) + '): <your composed message>"`').join('\n') +
              '\nAfter dispatching, tell the user the message was sent and END YOUR TURN — do not wait or poll; when the background process completes, its notification carries the reply — relay it then, attributed to that agent. ' +
              'Relay the reply back to the user, attributed to that agent.]'
          }

          if (remoteMentions.length) {
            const labels = remoteMentions.map(bot => `@${botHandle(bot.name, bot)} (${bot.connectionLabel || bot.connectionId})`).join(', ')
            note +=
              '\n\n[@mention — stay on this device. Desktop is delivering to ' + labels +
              ' over Connections in the background. Do not run hermes -p for them and do not switch Gateway. Tell the user they were messaged here; when a reply lands, relay it attributed to that agent.]'
          }

          return { ...draft, text: text + note }
        }      }
    })
  }
}
