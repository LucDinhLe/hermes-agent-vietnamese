// These are ARM64 console-launcher templates, not Python runtime dependencies.
// C1's NSIS extraction omitted them on Windows x64 despite their archive entries.
// Exclude them before sealing the x64 payload, never relax its exact inventory.
export const excludedWindowsPythonTemplates = Object.freeze([
  'Lib/site-packages/pip/_vendor/distlib/t64-arm.exe',
  'Lib/site-packages/pip/_vendor/distlib/w64-arm.exe',
  'Lib/site-packages/setuptools/cli-arm64.exe',
  'Lib/site-packages/setuptools/gui-arm64.exe'
])

export const isExcludedWindowsPythonTemplate = name => excludedWindowsPythonTemplates.includes(name)
