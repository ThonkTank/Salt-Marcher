import { app } from 'electron'
import { releaseQualificationContext } from '../../shared/maintenance/release-qualification-context.js'
import {
  qualificationFeed,
  qualificationFetch
} from '../../shared/maintenance/qualification-feed.js'

/** Called before app readiness; normal launches never install a feed override or debug port. */
export function configureReleaseUiQualification(): void {
  if (process.env['SALT_MARCHER_RELEASE_UI_QUALIFICATION'] !== 'true') return
  releaseQualificationContext()
  if (process.env['SALT_MARCHER_RELEASE_QUALIFICATION'] === 'true')
    throw new Error('Release UI qualification cannot run the headless updater.')
  const feed = qualificationFeed(process.env['SALT_MARCHER_RELEASE_TEST_FEED'])
  app.commandLine.appendSwitch('remote-debugging-port', '0')
  globalThis.fetch = qualificationFetch(feed, globalThis.fetch)
}
