import assert from 'node:assert/strict'
import test from 'node:test'
import { excludedWindowsPythonTemplates, isExcludedWindowsPythonTemplate } from './windows-python-distribution.mjs'

test('exclude exactly the four unneeded ARM64 launcher templates observed missing after NSIS', () => {
  assert.equal(excludedWindowsPythonTemplates.length, 4)
  for (const name of excludedWindowsPythonTemplates) assert.equal(isExcludedWindowsPythonTemplate(name), true)
})

test('keep x64 launchers, the interpreter and real runtime libraries', () => {
  for (const name of ['python.exe', 'python312.dll', 'Lib/site-packages/pip/_vendor/distlib/t64.exe',
    'Lib/site-packages/pip/_vendor/distlib/w64.exe', 'Lib/site-packages/setuptools/cli-64.exe',
    'Lib/site-packages/setuptools/gui-64.exe', 'Lib/site-packages/numpy/_core/_multiarray_umath.cp312-win_amd64.pyd']) {
    assert.equal(isExcludedWindowsPythonTemplate(name), false, name)
  }
})
