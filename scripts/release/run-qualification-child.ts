import { spawn } from 'node:child_process'
import { closeSync, openSync } from 'node:fs'

/** Called only after the parent runner has established separate-kernel isolation. */
export async function runQualificationChild(
  entry: string,
  args: string[],
  logPath: string
) {
  const log = openSync(logPath, 'wx')
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [entry, ...args], {
        detached: true,
        stdio: ['ignore', log, log],
        env: process.env
      })
      let timedOut = false
      const kill = () => {
        if (!child.pid) return
        try {
          process.kill(-child.pid, 'SIGKILL')
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH')
            reject(error instanceof Error ? error : new Error(String(error)))
        }
      }
      const timer = setTimeout(() => {
        timedOut = true
        kill()
      }, 900_000)
      child.once('error', (error) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      })
      child.once('exit', (code, signal) => {
        clearTimeout(timer)
        if (timedOut || code !== 0 || signal !== null) {
          kill()
          reject(
            new Error(
              `Qualification case failed: exit=${code}, signal=${signal}, timeout=${timedOut}; log=${logPath}`
            )
          )
          return
        }
        if (child.pid) {
          try {
            process.kill(-child.pid, 0)
            kill()
            reject(new Error('Qualification case left processes running'))
            return
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
              reject(error instanceof Error ? error : new Error(String(error)))
              return
            }
          }
        }
        resolve()
      })
    })
  } finally {
    closeSync(log)
  }
}
