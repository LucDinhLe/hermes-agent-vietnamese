# Hermes Connector for Chrome and Edge

This is the official unpacked Manifest V3 companion for Hermes Vietnamese v26.
It reads cookies only for the active website after an explicit click and
optional host-permission grant. It sends them to Hermes over a one-time
`127.0.0.1` pairing flow.

The extension does not read passwords, autofill, bookmarks, history,
localStorage or other browser profiles. Incognito use is disabled. Cookie values
are never written to extension storage or logs.

Install the exact directory bundled with Hermes using **Load unpacked** in
`chrome://extensions` or `edge://extensions`. Verify the extension ID is
`jabfgpkkfcoiiegikmdccooedjoooflm` and compare the SHA-256 shown in Hermes.
