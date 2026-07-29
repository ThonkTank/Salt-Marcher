import { app } from 'electron'
import {
  startApplication,
  stopApplication
} from './application-lifecycle/application.js'

const smokeTest = process.argv.includes('--smoke-test')

void startApplication().then(() => {
  if (smokeTest) setTimeout(() => app.quit(), 500)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => stopApplication())
