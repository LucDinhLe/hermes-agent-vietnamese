import assert from 'node:assert/strict'
import { test } from 'vitest'

import { archMatches, classifyHeader, findUnpackedDirs, peArch } from '../scripts/audit-bundle-arch.mjs'

// ─── header builders: the smallest buffers each format needs ───────────────

function elfHeader(machine) {
  const buf = Buffer.alloc(64)
  buf.write('\x7fELF', 0, 'latin1')
  buf.writeUInt16LE(machine, 18)
  return buf
}

function machoThin(cputype, { swapped = false } = {}) {
  const buf = Buffer.alloc(64)
  if (swapped) {
    buf.writeUInt32BE(0xcffaedfe, 0) // magic as stored little-endian on disk
    buf.writeUInt32LE(cputype, 4)
  } else {
    buf.writeUInt32BE(0xfeedfacf, 0)
    buf.writeUInt32BE(cputype, 4)
  }
  return buf
}

function machoFat(cputypes) {
  const buf = Buffer.alloc(8 + cputypes.length * 20)
  buf.writeUInt32BE(0xcafebabe, 0)
  buf.writeUInt32BE(cputypes.length, 4)
  cputypes.forEach((t, i) => buf.writeUInt32BE(t, 8 + i * 20))
  return buf
}

function mzStub(peOffset) {
  const buf = Buffer.alloc(0x40)
  buf.write('MZ', 0, 'latin1')
  buf.writeUInt32LE(peOffset, 0x3c)
  return buf
}

// ─── classifyHeader ─────────────────────────────────────────────────

test('classifyHeader names the arch for each executable format', () => {
  assert.deepEqual(classifyHeader(elfHeader(0x3e)).arches, ['x64'])
  assert.deepEqual(classifyHeader(elfHeader(0xb7)).arches, ['arm64'])
  assert.deepEqual(classifyHeader(machoThin(0x0100000c)).arches, ['arm64'])
  assert.deepEqual(classifyHeader(machoThin(0x01000007, { swapped: true })).arches, ['x64'])
  assert.deepEqual(classifyHeader(machoFat([0x01000007, 0x0100000c])).arches, ['x64', 'arm64'])
})

test('classifyHeader defers PE to the offset named in the MZ stub', () => {
  const sniffed = classifyHeader(mzStub(0x180))
  assert.equal(sniffed.format, 'pe')
  assert.equal(sniffed.peHeaderOffset, 0x180)
  // The machine code itself resolves through peArch.
  assert.equal(peArch(0x8664), 'x64')
  assert.equal(peArch(0xaa64), 'arm64')
  assert.equal(peArch(0xa641), 'arm64ec')
  assert.match(peArch(0xbeef), /unknown/)
})

test('classifyHeader skips non-binaries, tiny files, and Java class files', () => {
  assert.equal(classifyHeader(Buffer.from('#!/bin/sh\necho hi\n')), null)
  assert.equal(classifyHeader(Buffer.from('MZ')), null) // too short to carry a PE offset
  assert.equal(classifyHeader(Buffer.alloc(0)), null)
  // Java .class: same magic as a fat Mach-O, giant "slice count" (version).
  const javaClass = Buffer.alloc(16)
  javaClass.writeUInt32BE(0xcafebabe, 0)
  javaClass.writeUInt32BE(65, 4)
  assert.equal(classifyHeader(javaClass), null)
})

// ─── archMatches ─────────────────────────────────────────────────

test('archMatches: exact match, universal slices, arm64ec, and rejections', () => {
  assert.ok(archMatches(['arm64'], 'arm64'))
  assert.ok(archMatches(['x64', 'arm64'], 'arm64')) // universal binary covers the target
  assert.ok(archMatches(['arm64ec'], 'arm64')) // arm64-ABI by definition
  assert.ok(!archMatches(['x64'], 'arm64')) // the shipped-x64-shim bug this audit exists for
  assert.ok(!archMatches(['arm64ec'], 'x64')) // arm64ec does not run on x64 hosts
  assert.ok(!archMatches(['unknown(0xbeef)'], 'x64')) // unclassifiable ships nowhere
})

// ─── findUnpackedDirs ─────────────────────────────────────────────────

test('findUnpackedDirs matches electron-builder output shapes only', () => {
  const dirs = findUnpackedDirs([
    'win-unpacked', 'win-arm64-unpacked', 'linux-unpacked', 'linux-arm64-unpacked',
    'mac', 'mac-arm64',
    'builder-debug.yml', 'Hermes-0.20.0.exe', 'latest.yml', '.icon-ico'
  ])
  assert.deepEqual(dirs, [
    'win-unpacked', 'win-arm64-unpacked', 'linux-unpacked', 'linux-arm64-unpacked',
    'mac', 'mac-arm64'
  ])
})
