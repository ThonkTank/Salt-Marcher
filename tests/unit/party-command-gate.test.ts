import { expect, it } from 'vitest'
import {
  PartyCommandGate,
  partyCommandGate
} from '../../src/renderer/features/party/party-command-gate.js'
it('blocks later mutations until the exact uncertain original has a definite result', async () => {
  const gate = new PartyCommandGate()
  const events: string[] = []
  let available = false
  const original = () => {
    events.push('status-original')
    if (!available) return Promise.reject(new Error('offline'))
    return Promise.resolve({ committed: true })
  }
  await expect(
    gate.run(() => {
      events.push('write-original')
      return Promise.reject(new Error('lost response'))
    }, original)
  ).rejects.toThrow('lost response')
  await expect(
    gate.run(
      () => {
        events.push('write-next')
        return Promise.resolve(true)
      },
      () => Promise.resolve(null)
    )
  ).rejects.toThrow('offline')
  expect(events).toEqual(['write-original', 'status-original'])
  available = true
  await gate.run(
    () => {
      events.push('write-next')
      return Promise.resolve(true)
    },
    () => Promise.resolve(null)
  )
  expect(events).toEqual([
    'write-original',
    'status-original',
    'status-original',
    'write-next'
  ])
})
it('shares the gate across views of the same host and campaign only', () => {
  const host = {}
  expect(partyCommandGate(host, 'a')).toBe(partyCommandGate(host, 'a'))
  expect(partyCommandGate(host, 'a')).not.toBe(partyCommandGate(host, 'b'))
  expect(partyCommandGate(host, 'a')).not.toBe(partyCommandGate({}, 'a'))
})
