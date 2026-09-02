import { describe, expect, it } from 'vitest'

import { runtimeMetadataRoot } from './runtime-metadata-root'

describe('running runtime provenance', () => {
  it('uses the verified packaged runtime even when the legacy update root is a Git checkout', () => {
    expect(runtimeMetadataRoot(true, { status: 'ready', targetRoot: 'candidate-root' }, 'old-git-root')).toBe(
      'candidate-root'
    )
  })

  it('never claims the legacy runtime is running while the packaged candidate is unready', () => {
    expect(
      runtimeMetadataRoot(true, { status: 'needs-bootstrap', targetRoot: 'candidate-root' }, 'old-git-root')
    ).toBeNull()
    expect(runtimeMetadataRoot(true, null, 'old-git-root')).toBeNull()
  })

  it('retains the existing source-root behavior for non-bundled development', () => {
    expect(runtimeMetadataRoot(false, null, 'source-root')).toBe('source-root')
  })
})
