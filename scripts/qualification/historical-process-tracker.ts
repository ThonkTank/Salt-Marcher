import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

type ProcessIdentity = {
  pid: number
  parent: number
  started: string
  state: string
}

/** Qualification-owned processes survive /proc/environ changes and reparenting. */
export class HistoricalProcessTracker {
  private readonly owned = new Map<number, string>()
  constructor(private readonly proc = '/proc') {}
  private identity(pid: number): ProcessIdentity | null {
    try {
      const stat = readFileSync(join(this.proc, String(pid), 'stat'), 'utf8')
      const fields = stat
        .slice(stat.lastIndexOf(')') + 2)
        .trim()
        .split(/\s+/)
      if (!fields[19] || !/^\d+$/.test(fields[19]))
        throw new Error('Invalid process start identity')
      return {
        pid,
        parent: Number(fields[1]),
        started: fields[19],
        state: fields[0]!
      }
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code === 'ENOENT' ||
        (error as NodeJS.ErrnoException).code === 'ESRCH'
      )
        return null
      throw error
    }
  }
  track(pid: number): void {
    const identity = this.identity(pid)
    if (identity && !['Z', 'X'].includes(identity.state))
      this.owned.set(pid, identity.started)
  }
  scan(home: string): number[] {
    const processes = readdirSync(this.proc)
      .filter((name) => /^\d+$/.test(name))
      .flatMap((name) => {
        const identity = this.identity(Number(name))
        return identity && !['Z', 'X'].includes(identity.state)
          ? [identity]
          : []
      })
    const live = new Map(processes.map((identity) => [identity.pid, identity]))
    for (const [pid, started] of this.owned)
      if (live.get(pid)?.started !== started) this.owned.delete(pid)
    for (const identity of processes) {
      try {
        if (
          readFileSync(join(this.proc, String(identity.pid), 'environ'), 'utf8')
            .split('\0')
            .includes(`XDG_DATA_HOME=${home}`)
        )
          this.owned.set(identity.pid, identity.started)
      } catch (error) {
        if (
          !['ENOENT', 'ESRCH', 'EACCES', 'EPERM'].includes(
            (error as NodeJS.ErrnoException).code ?? ''
          )
        )
          throw error
      }
    }
    let changed = true
    while (changed) {
      changed = false
      for (const identity of processes)
        if (!this.owned.has(identity.pid) && this.owned.has(identity.parent)) {
          this.owned.set(identity.pid, identity.started)
          changed = true
        }
    }
    return [...this.owned.keys()].sort((a, b) => a - b)
  }
}
