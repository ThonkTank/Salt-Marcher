import { app } from 'electron'
import {
  startApplication,
  stopApplication
} from './application-lifecycle/application.js'

const smokeTest = process.argv.includes('--smoke-test')

void startApplication()
  .then(() => {
    if (smokeTest) setTimeout(() => app.exit(0), 500)
  })
  .catch((error: unknown) => {
    console.error('SaltMarcher failed to start', error)
    app.exit(1)
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => stopApplication())
