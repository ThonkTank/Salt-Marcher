const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync } = require('node:fs')

const argument = (name) => {
  const index = process.argv.indexOf(name)
  const value = process.argv[index + 1]
  if (index < 0 || !value) throw new Error(`${name} is required`)
  return value
}

app.commandLine.appendSwitch('disable-gpu')
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    width: 1440,
    height: 1000,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  try {
    await window.loadFile(argument('--html'))
    await window.webContents.insertCSS(
      readFileSync(argument('--tokens'), 'utf8')
    )
    await window.webContents.executeJavaScript(
      'document.fonts.ready.then(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))'
    )
    const image = await window.webContents.capturePage()
    writeFileSync(argument('--output'), image.toPNG())
  } finally {
    window.destroy()
    app.quit()
  }
})
