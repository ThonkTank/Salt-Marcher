import { utilityProcess } from 'electron'
import { z } from 'zod'
import { outputPath } from '../application-lifecycle/runtime-paths.js'
export function maintenanceWorker(input: {
  root: string
  version: string
  operation: 'list' | 'prepare' | 'activate' | 'commit' | 'rollback' | 'restore'
  source?: string
  id?: string
}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const worker = utilityProcess.fork(
      outputPath('main', 'maintenance.js'),
      [],
      { serviceName: 'SaltMarcher Wartung' }
    )
    let finished = false
    worker.once('spawn', () => worker.postMessage(input))
    worker.once('message', (raw: unknown) => {
      finished = true
      worker.kill()
      const result = z
        .discriminatedUnion('ok', [
          z.object({ ok: z.literal(true), result: z.unknown() }),
          z.object({ ok: z.literal(false), message: z.string() })
        ])
        .safeParse(raw)
      if (!result.success) reject(new Error('Ungültige Antwort der Wartung.'))
      else if (result.data.ok) resolve(result.data.result)
      else reject(new Error(result.data.message))
    })
    worker.once('exit', () => {
      if (!finished)
        reject(
          new Error(
            'Wartung wurde unterbrochen. Der bisherige Datenstand bleibt erhalten.'
          )
        )
    })
  })
}
