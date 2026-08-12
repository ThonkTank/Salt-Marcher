import { describe, expect, it } from 'vitest'
import {
  fingerprint,
  fingerprintExcluding
} from '../../src/core/fingerprint.js'
import { canonicalJson } from '../../src/shared/canonical-json.js'

describe('canonical semantic fingerprints', () => {
  it('sorts object keys recursively while retaining semantic array order', () => {
    expect(
      canonicalJson({ z: 1, nested: { b: 2, a: 1 }, list: ['b', 'a'] })
    ).toBe('{"list":["b","a"],"nested":{"a":1,"b":2},"z":1}')
    expect(
      fingerprint({ z: 1, nested: { b: 2, a: 1 }, list: ['b', 'a'] })
    ).toBe(fingerprint({ list: ['b', 'a'], nested: { a: 1, b: 2 }, z: 1 }))
    expect(fingerprint({ list: ['a', 'b'] })).not.toBe(
      fingerprint({ list: ['b', 'a'] })
    )
  })

  it('uses JSON-compatible undefined semantics', () => {
    expect(canonicalJson({ kept: 1, omitted: undefined })).toBe('{"kept":1}')
    expect(canonicalJson([1, undefined, 3])).toBe('[1,null,3]')
  })

  it('excludes only declared workflow fields from command identity', () => {
    const request = {
      commandId: 'workflow-a',
      operationId: 'operation-a',
      payload: { b: 2, a: 1 }
    }
    expect(fingerprintExcluding(request, ['commandId'])).toBe(
      fingerprintExcluding({ ...request, commandId: 'workflow-b' }, [
        'commandId'
      ])
    )
    expect(fingerprintExcluding(request, ['commandId'])).not.toBe(
      fingerprintExcluding({ ...request, operationId: 'operation-b' }, [
        'commandId'
      ])
    )
  })
})
