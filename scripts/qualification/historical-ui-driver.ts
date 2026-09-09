import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { z } from 'zod'
import { browserRuntimePath } from '../../src/main/local-profile/application-profile.js'

export async function waitFor<T>(
  read: () => T | Promise<T>,
  accept: (value: T) => boolean,
  label: string
): Promise<T> {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    const value = await read()
    if (accept(value)) return value
    await delay(200)
  }
  throw new Error(`Timed out: ${label}`)
}

export function isolatedProcesses(home: string): number[] {
  return readdirSync('/proc')
    .filter((name) => /^\d+$/.test(name))
    .flatMap((name) => {
      try {
        return readFileSync(`/proc/${name}/environ`, 'utf8')
          .split('\0')
          .includes(`XDG_DATA_HOME=${home}`)
          ? [Number(name)]
          : []
      } catch {
        return []
      }
    })
}

export class HistoricalUiDriver {
  private serial = 0
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void
      reject: (error: Error) => void
      timer: ReturnType<typeof setTimeout>
    }
  >()
  private constructor(private socket: WebSocket) {
    socket.addEventListener('message', (event) => {
      const packet = z
        .object({
          id: z.number().optional(),
          result: z.unknown().optional(),
          error: z.object({ message: z.string() }).optional()
        })
        .parse(JSON.parse(String(event.data)))
      if (packet.id === undefined) return
      const handler = this.pending.get(packet.id)
      if (!handler) return
      this.pending.delete(packet.id)
      clearTimeout(handler.timer)
      if (packet.error) handler.reject(new Error(packet.error.message))
      else handler.resolve(packet.result)
    })
    socket.addEventListener('close', () => {
      for (const handler of this.pending.values()) {
        clearTimeout(handler.timer)
        handler.reject(new Error('CDP closed'))
      }
      this.pending.clear()
    })
  }
  static async connect(home: string): Promise<HistoricalUiDriver> {
    const path = join(
      browserRuntimePath(join(home, 'salt-marcher/profile')),
      'DevToolsActivePort'
    )
    const url = await waitFor(
      async () => {
        if (!existsSync(path)) return null
        const port = Number(readFileSync(path, 'utf8').split('\n')[0])
        if (!Number.isInteger(port) || port < 1) return null
        try {
          const pages = z
            .array(
              z.object({
                type: z.string(),
                webSocketDebuggerUrl: z.string().optional()
              })
            )
            .parse(
              await (
                await fetch(`http://127.0.0.1:${port}/json/list`, {
                  signal: AbortSignal.timeout(1000)
                })
              ).json()
            )
          return (
            pages.find((page) => page.type === 'page')?.webSocketDebuggerUrl ??
            null
          )
        } catch {
          return null
        }
      },
      (value) => value !== null,
      'renderer debugging endpoint'
    )
    assert(url)
    const socket = new WebSocket(url)
    const driver = new HistoricalUiDriver(socket)
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.close()
        reject(new Error('CDP connection timed out'))
      }, 15_000)
      socket.addEventListener(
        'open',
        () => {
          clearTimeout(timer)
          resolve()
        },
        { once: true }
      )
      socket.addEventListener(
        'error',
        () => {
          clearTimeout(timer)
          reject(new Error('CDP connection failed'))
        },
        { once: true }
      )
    })
    return driver
  }
  command(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<unknown> {
    const id = ++this.serial
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`CDP timeout: ${method}`))
      }, 15_000)
      this.pending.set(id, { resolve, reject, timer })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }
  async inspect(expression: string): Promise<unknown> {
    const result = z
      .object({
        result: z.object({ value: z.unknown().optional() }),
        exceptionDetails: z.unknown().optional()
      })
      .parse(
        await this.command('Runtime.evaluate', {
          expression,
          returnByValue: true
        })
      )
    assert.equal(result.exceptionDetails, undefined, 'DOM inspection failed')
    return result.result.value
  }
  async click(label: string, scope = 'body', prefix = false): Promise<void> {
    const box = await waitFor(
      async () => {
        return z
          .object({ x: z.number(), y: z.number() })
          .nullable()
          .parse(
            await this.inspect(
              `(() => { const nodes = [...(document.querySelector(${JSON.stringify(scope)})?.querySelectorAll('button') ?? [])]; const matches = nodes.filter(b => !b.disabled && (${prefix ? 'b.textContent.trim().startsWith' : 'b.textContent.trim() ==='}${prefix ? '(' : ' '}${JSON.stringify(label)}${prefix ? ')' : ''}) && b.getBoundingClientRect().width); if(matches.length !== 1) return null; const r = matches[0].getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`
            )
          )
      },
      (value) => value !== null,
      `unique enabled button ${scope}: ${label}`
    )
    assert(box)
    await this.command('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...box,
      button: 'left',
      clickCount: 1
    })
    await this.command('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...box,
      button: 'left',
      clickCount: 1
    })
  }
  async fill(selector: string, value: string): Promise<void> {
    const box = await waitFor(
      async () =>
        z
          .object({ x: z.number(), y: z.number() })
          .nullable()
          .parse(
            await this.inspect(
              `(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e || e.disabled) return null; const r=e.getBoundingClientRect(); return r.width ? {x:r.x+r.width/2,y:r.y+r.height/2} : null; })()`
            )
          ),
      (box) => box !== null,
      `input ${selector}`
    )
    assert(box)
    await this.command('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...box,
      button: 'left',
      clickCount: 1
    })
    await this.command('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...box,
      button: 'left',
      clickCount: 1
    })
    await this.command('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'a',
      code: 'KeyA',
      modifiers: 2,
      windowsVirtualKeyCode: 65
    })
    await this.command('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'a',
      code: 'KeyA',
      modifiers: 2,
      windowsVirtualKeyCode: 65
    })
    await this.command('Input.insertText', { text: value })
  }
  async text(): Promise<string> {
    return z.string().parse(await this.inspect('document.body.innerText'))
  }
  async expectText(text: string): Promise<void> {
    await waitFor(
      () => this.text(),
      (value) => value.includes(text),
      `visible text ${text}`
    )
  }
  async closeApplication(home: string): Promise<void> {
    try {
      await this.command('Browser.close')
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'CDP closed')
        throw error
    }
    await waitFor(
      () => isolatedProcesses(home),
      (pids) => pids.length === 0,
      'all isolated application processes exited'
    )
    this.socket.close()
  }
  disconnect(): void {
    this.socket.close()
  }
}
