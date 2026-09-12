import { expect, it } from 'vitest'
import {
  PartyCommandGate,
  partyCommandGate
} from '../../src/renderer/features/party/party-command-gate.js'
it('blocks later mutations until the exact uncertain original has a definite result', async () => {
  const gate = new PartyCommandGate()
  const events: string[] = []
  let available = false
  const original = async () => {
    events.push('status-original')
    if (!available) throw new Error('offline')
    return { committed: true }
  }
  await expect(
    gate.run(async () => {
      events.push('write-original')
      throw new Error('lost response')
    }, original)
  ).rejects.toThrow('lost response')
  await expect(
    gate.run(
      async () => {
        events.push('write-next')
        return true
      },
      async () => null
    )
  ).rejects.toThrow('offline')
  expect(events).toEqual(['write-original', 'status-original'])
  available = true
  await gate.run(
    async () => {
      events.push('write-next')
      return true
    },
    async () => null
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
