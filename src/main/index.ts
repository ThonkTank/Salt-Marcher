import { app } from 'electron'
import {
  runSessionGenerationSmoke,
  startApplication,
  stopApplication,
  waitForCoreReady
} from './application-lifecycle/application.js'

const smokeTest = process.argv.includes('--smoke-test')

void startApplication()
  .then(() => {
    if (smokeTest)
      void waitForCoreReady()
        .then(() =>
          process.argv.includes('--session-generation-smoke')
            ? runSessionGenerationSmoke()
            : undefined
        )
        .then(() => app.quit())
        .catch((error: unknown) => {
          console.error('SaltMarcher core failed smoke readiness', error)
          app.exit(1)
        })
  })
  .catch((error: unknown) => {
    console.error('SaltMarcher failed to start', error)
    app.exit(1)
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

let shuttingDown = false
app.on('before-quit', (event) => {
  if (shuttingDown) return
  event.preventDefault()
  shuttingDown = true
  void stopApplication().finally(() => app.quit())
})
