import { app } from 'electron'
import { join } from 'node:path'
import { durableJson } from '../../shared/maintenance/files.js'
import { releaseRoot } from './paths.js'
import { isE2eRuntime } from '../application-lifecycle/e2e-runtime.js'
import type { ReleaseController } from './controller.js'
export function releaseQualificationEnabled(): boolean {
  return (
    isE2eRuntime() &&
    process.env['SALT_MARCHER_RELEASE_QUALIFICATION'] === 'true'
  )
}
export function configureReleaseQualification(): void {
  if (!releaseQualificationEnabled()) return
  const feed = new URL(process.env['SALT_MARCHER_RELEASE_TEST_FEED'] ?? '')
  if (
    feed.protocol !== 'http:' ||
    feed.hostname !== '127.0.0.1' ||
    !process.env['XDG_DATA_HOME']
  )
    throw new Error(
      'Qualification requires isolated storage and a loopback feed'
    )
  const originalFetch = globalThis.fetch
  globalThis.fetch = (input, init) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    )
    if (['github.com', 'api.github.com'].includes(url.hostname))
      return originalFetch(new URL(url.pathname, feed), init)
    return originalFetch(input, init)
  }
}
export async function qualifyRelease(
  controller: ReleaseController,
  completed: boolean,
  seed: () => Promise<void>
): Promise<void> {
  if (!releaseQualificationEnabled()) return
  if (completed) {
    durableJson(join(releaseRoot(), 'qualification-result.json'), {
      ok: true,
      version: app.getVersion()
    })
    app.quit()
    return
  }
  const action =
    process.argv[process.argv.indexOf('--release-qualification') + 1]
  if (action === 'seed') {
    await seed()
    durableJson(join(releaseRoot(), 'qualification-result.json'), {
      ok: true,
      version: app.getVersion()
    })
    app.quit()
  } else if (action === 'setup') await controller.setup()
  else if (action === 'restore') await controller.restore(process.argv.at(-1)!)
  else {
    await controller.check()
    await controller.download()
    await controller.install()
  }
  if (controller.status().phase === 'error') {
    durableJson(join(releaseRoot(), 'qualification-result.json'), {
      ok: false,
      message: controller.status().message
    })
    app.quit()
  }
}
