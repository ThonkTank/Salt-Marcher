import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export function validateHistoricalTestIsolation(input: {
  cgroup: string
  memoryMax: string
  pidsMax: string
  bus: string | undefined
  hostBootId: string
  guestBootId: string
}): void {
  const bootId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/
  assert(
    bootId.test(input.hostBootId) &&
      bootId.test(input.guestBootId) &&
      input.hostBootId !== input.guestBootId,
    'Qualification requires a separate kernel with a host boot ID supplied by QEMU'
  )
  assert(
    /^\/.*\/salt-marcher-qualification-[a-zA-Z0-9-]+\.service$/.test(
      input.cgroup
    ),
    'AppImage qualification requires its own salt-marcher-qualification-* service'
  )
  assert(
    /^\d+$/.test(input.memoryMax) &&
      BigInt(input.memoryMax) > 0n &&
      BigInt(input.memoryMax) <= 8n * 1024n ** 3n,
    'Qualification memory.max must be finite and at most 8 GiB'
  )
  assert(
    /^\d+$/.test(input.pidsMax) &&
      BigInt(input.pidsMax) > 0n &&
      BigInt(input.pidsMax) <= 256n,
    'Qualification pids.max must be finite and at most 256'
  )
  assert(
    input.bus && /^unix:(path|abstract)=\/tmp\/dbus-[^;\s]+$/.test(input.bus),
    'Qualification requires a private dbus-run-session bus, not the desktop bus'
  )
}

/** Fail before seeding profiles or executing either historical AppImage. */
export function assertHistoricalTestIsolation(): void {
  const cgroup = readFileSync('/proc/self/cgroup', 'utf8')
    .split('\n')
    .find((line) => line.startsWith('0::'))
    ?.slice(3)
  assert(cgroup && !cgroup.split('/').includes('..'), 'cgroup v2 is required')
  const root = join('/sys/fs/cgroup', cgroup)
  validateHistoricalTestIsolation({
    cgroup,
    memoryMax: readFileSync(join(root, 'memory.max'), 'utf8').trim(),
    pidsMax: readFileSync(join(root, 'pids.max'), 'utf8').trim(),
    bus: process.env['DBUS_SESSION_BUS_ADDRESS'],
    hostBootId: readFileSync(
      '/sys/firmware/qemu_fw_cfg/by_name/opt/salt-marcher/host-boot-id/raw',
      'utf8'
    ).trim(),
    guestBootId: readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim()
  })
}
