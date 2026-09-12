import { configureReleaseUiQualification } from './release/ui-qualification.js'
import { registerQuitBarrier } from './application-lifecycle/quit-barrier.js'
import { app } from 'electron'
import {
  runSessionGenerationSmoke,
  reportInstalledRuntimeVerification,
  startApplication,
  stopApplication,
  waitForCoreReady,
  waitForCoreTermination
} from './application-lifecycle/application.js'

const smokeTest = process.argv.includes('--smoke-test')

void Promise.resolve()
  .then(() => {
    configureReleaseUiQualification()
    return process.argv.includes('--release-profile-inspection')
      ? import('./release/inspection-entry.js').then(
          ({ runReleaseInspection }) => runReleaseInspection()
        )
      : process.argv.includes('--release-maintenance')
        ? import('./release/maintenance-entry.js').then(
            ({ runMaintenanceEntry }) => runMaintenanceEntry()
          )
        : startApplication()
  })
  .then(() => {
    if (smokeTest)
      void waitForCoreReady()
        .then(() =>
          process.argv.includes('--session-generation-smoke')
            ? runSessionGenerationSmoke()
            : undefined
        )
        .then(() =>
          process.argv.includes('--installed-runtime-verification')
            ? reportInstalledRuntimeVerification()
            : undefined
        )
        .then(() => app.quit())
        .catch((error: unknown) => {
          failAfterShutdown('SaltMarcher core failed smoke readiness', error)
        })
  })
  .catch((error: unknown) => {
    failAfterShutdown('SaltMarcher failed to start', error)
  })

function failAfterShutdown(message: string, error: unknown): void {
  console.error(message, error)
  void stopApplication().then(
    () => app.exit(1),
    (shutdownError: unknown) => {
      console.error(
        'SaltMarcher retains its profile lock until the data process exits',
        shutdownError
      )
      void waitForCoreTermination()
        .then(() => stopApplication())
        .then(() => app.exit(1))
        .catch((error) =>
          console.error('SaltMarcher could not finish shutdown', error)
        )
    }
  )
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

registerQuitBarrier(app, stopApplication, (error) => {
  console.error('SaltMarcher could not finish closing its data process', error)
})
