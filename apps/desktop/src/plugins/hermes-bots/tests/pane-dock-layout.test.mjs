import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// Vietnamese Experimental layout contract:
//  - persistent agents live on a dedicated route and sidebar entry, never in
//    a SESSIONS | BOTS strip that changes the inherited V32 workspace;
//  - the Cronjobs (routines) pane only exists while the Bots pane is on
//    screen — registered/unregistered through the contribution disposer,
//    driven by the feature-detected host.paneVisibility SDK export, with the
//    always-registered fallback kept for older desktops.

const source = readFileSync(new URL('../plugin.js', import.meta.url), 'utf8')

test('persistent agents use a dedicated route and never inject a Bots session tab', () => {
  assert.match(source, /id: 'agents-route',[\s\S]*?path: '\/agents\/manage'/)
  assert.match(source, /id: 'agents-nav',[\s\S]*?label: 'Quản lý Agents'/)
  assert.doesNotMatch(source, /id: 'pane',[\s\S]*?dock: \{ pane: 'sessions'/)
})

test('routines registration is a reusable disposer-returning function', () => {
  assert.match(source, /const registerRoutinesPane = \(\) =>\s*\n\s*ctx\.register\(\{\s*\n\s*id: 'routines'/)
  assert.match(source, /dock: \{ pane: 'workspace', pos: 'right', enforce: true \}/)
})

test('routines pane rides Bots visibility via feature-detected host.paneVisibility', () => {
  assert.match(source, /typeof host\.paneVisibility === 'function'/)
  assert.match(source, /host\.paneVisibility\(`\$\{ID\}:pane`\)/)
  // Transitions register/unregister through the tracked disposer.
  assert.match(source, /unregisterRoutines \?\?= registerRoutinesPane\(\)/)
  assert.match(source, /unregisterRoutines\(\)\s*\n\s*unregisterRoutines = null/)
  // The visibility listener must not survive plugin disable.
  assert.match(source, /ctx\.onDispose\(stopRoutinesSync\)/)
})

test('older desktops without the SDK export keep the always-registered pane', () => {
  assert.match(source, /\} else \{\s*\n\s*registerRoutinesPane\(\)\s*\n\s*\}/)
})
