import { describe, expect, it } from 'vitest'
import { validateHistoricalTestIsolation } from '../../scripts/qualification/historical-test-isolation.js'

const isolated = {
  hostBootId: '11111111-1111-1111-1111-111111111111',
  guestBootId: '22222222-2222-2222-2222-222222222222',
  cgroup: '/user.slice/app.slice/salt-marcher-qualification-example.service',
  memoryMax: '8589934592',
  pidsMax: '256',
  bus: 'unix:path=/tmp/dbus-example,guid=abc'
}

describe('historical qualification launch boundary', () => {
  it('accepts bounded service with private session bus', () => {
    expect(() => validateHistoricalTestIsolation(isolated)).not.toThrow()
  })
  it.each([
    { hostBootId: '' },
    { guestBootId: '11111111-1111-1111-1111-111111111111' },
    { cgroup: '/user.slice/app.slice/app-chatgpt.scope' },
    { memoryMax: 'max' },
    { memoryMax: '8589934593' },
    { memoryMax: '0' },
    { pidsMax: 'max' },
    { pidsMax: '257' },
    { pidsMax: '0' },
    { bus: undefined },
    { bus: 'unix:path=/run/user/1000/bus' },
    { bus: 'unix:path=/tmp/dbus-test;unix:path=/run/user/1000/bus' }
  ])('rejects unsafe launch properties %j', (override) => {
    expect(() =>
      validateHistoricalTestIsolation({ ...isolated, ...override })
    ).toThrow()
  })
})
