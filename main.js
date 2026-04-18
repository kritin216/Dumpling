const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, session } = require('electron')
const path   = require('path')
const fs     = require('fs')
const http   = require('http')
const { exec, spawn } = require('child_process')

// ════════════════════════════════════════
// DATABASE
// ════════════════════════════════════════
const DATA_DIR = path.join(__dirname, 'data')
const DB_PATH  = path.join(DATA_DIR, 'dumpling-data.json')

function loadDB() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
  } catch (e) {}
  return { user: null, onboardingComplete: false, conversations: [], cameraEvents: [], habits: [] }
}

function saveDB(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
}

function buildContext(db) {
  if (!db.user) return ''
  const u = db.user
  let c = `User: ${u.name}.`
  if (u.jobRole)    c += ` Job: ${u.jobRole}.`
  if (u.challenges) c += ` Challenges: ${u.challenges}.`
  return c
}

// ════════════════════════════════════════
// MODEL HTTP SERVER
//
// WHY: face-api.js uses fetch() internally to load
// model files. Electron's renderer fetch() cannot
// load file:// URLs, and protocol.handle() is
// unreliable across Electron versions.
//
// FIX: Start a tiny localhost HTTP server that reads
// model files from disk. fetch('http://127.0.0.1:PORT')
// works in every Electron version without exception.
// Port 0 = OS assigns a free port automatically.
// ════════════════════════════════════════
let modelPort = 0

function startModelServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      // path.basename prevents any directory traversal
      const name = path.basename(decodeURIComponent(req.url.split('?')[0]))
      const fp   = path.join(__dirname, 'models', name)
      try {
        const data = fs.readFileSync(fp)
        res.writeHead(200, {
          'Content-Type': fp.endsWith('.json') ? 'application/json' : 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400'
        })
        res.end(data)
      } catch {
        res.writeHead(404)
        res.end('Not found: ' + name)
      }
    })

    srv.listen(0, '127.0.0.1', () => {
      modelPort = srv.address().port
      console.log('✓ Model server → http://127.0.0.1:' + modelPort)
      resolve()
    })
    srv.on('error', e => { console.error('Model server error:', e.message); resolve() })
  })
}

// ════════════════════════════════════════
// WINDOWS
// ════════════════════════════════════════
let dash = null, buddy = null, tray = null

function createWindows() {
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(true))

  dash = new BrowserWindow({
    width: 640, height: 820,
    title: 'Dumpling Buddy',
    backgroundColor: '#f5f0eb',
    webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false }
  })
  dash.loadFile('dashboard.html')
  dash.on('close', e => { e.preventDefault(); dash.hide() })

  buddy = new BrowserWindow({
    width: 220, height: 280,
    transparent: true, frame: false,
    alwaysOnTop: true, skipTaskbar: true,
    hasShadow: false, resizable: false, movable: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false }
  })
  buddy.loadFile('buddy.html')
  buddy.on('close', e => { e.preventDefault(); buddy.hide() })

  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  buddy.setPosition(width - 240, height - 300)
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: '🥟 Show Dumpling',  click: () => { buddy.show(); buddy.focus() } },
    { label: '👋 Hide Dumpling',  click: () => buddy.hide() },
    { label: '📊 Open Dashboard', click: () => { dash.show(); dash.focus() } },
    { type: 'separator' },
    { label: '🫁 Quiet Mode', click: () => { dash.show(); dash.webContents.send('trigger-quiet-mode') } },
    { type: 'separator' },
    { label: '✖  Quit', click: () => { tray?.destroy(); app.exit(0) } }
  ])
}

function createTray() {
  const iconData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAqklEQVRYhe3WwQqAIAxA0e3/P7sLQqRu7jW3oMMehIJEUFHRRURERERERERERMT/AiKyiquqqvM3DsAAAAAAAAAAAAAAAAAAAAAcBMREdFxHOd5llICAAAAAAAAAAAAAAAAAAAAAGAbEQEAAAAAAAAAAAAAAAAAAAAAAAAAYBsRAQAAAAAAAAAAAAAAAAAAAADgGxEBAAAAAAAAAAAAAAAAAAAAAN+ICAAAAAAAAAAAAAAA4AMiIiIiIiIiIuIBsAMpGAAAAABJRU5ErkJggg=='
  const img = nativeImage.createFromDataURL(iconData).resize({ width: 16, height: 16 })
  tray = new Tray(img)
  tray.setToolTip('Dumpling Buddy')
  tray.setContextMenu(buildTrayMenu())
  tray.on('double-click', () => { dash.show(); dash.focus() })
  tray.on('right-click',  () => tray.setContextMenu(buildTrayMenu()))
}

async function warmOllama() {
  try {
    await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'tinyllama',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
        options: { num_predict: 1 }
      }),
      signal: AbortSignal.timeout(60000)
    })
    console.log('✓ Ollama ready')
  } catch (e) { console.log('Ollama warm failed:', e.message) }
}

// ════════════════════════════════════════
// STARTUP
// startModelServer MUST finish before windows
// open — dash calls ipcRenderer.invoke('get-model-port')
// inside its init() and needs a port immediately.
// ════════════════════════════════════════
app.whenReady().then(async () => {
  await startModelServer()
  createWindows()
  createTray()
  setTimeout(warmOllama, 3000)
})

app.on('window-all-closed', e => e.preventDefault())

// ════════════════════════════════════════
// IPC — routing
// ════════════════════════════════════════
ipcMain.on('show-buddy',         () => buddy?.show())
ipcMain.on('hide-buddy',         () => buddy?.hide())
ipcMain.on('show-dashboard',     () => { dash?.show(); dash?.focus() })
ipcMain.on('buddy-set-state',    (e, s) => buddy?.webContents.send('set-state', s))
ipcMain.on('buddy-speak-bubble', (e, t) => buddy?.webContents.send('show-bubble', t))
ipcMain.on('trigger-quiet-mode', ()    => dash?.webContents.send('trigger-quiet-mode'))

// Dashboard fetches port on startup
ipcMain.handle('get-model-port', () => modelPort)

// ════════════════════════════════════════
// TTS — Windows SAPI via wscript.exe + VBScript
//
// WHY NOT POWERSHELL: PowerShell scripts run through
// cmd.exe's argument parser which mangles quotes,
// apostrophes and special chars. ExecutionPolicy can
// also silently block scripts.
//
// FIX: Write a one-line .vbs file and run it with
// wscript.exe directly (spawn, not exec — no shell).
// wscript is always present on Windows, has no
// execution policy, and handles the string cleanly.
// Uses Windows default voice — always available.
// ════════════════════════════════════════
let ttsProc = null

ipcMain.on('speak', (e, text) => {
  stopTTS()

  const safe = String(text)
    .replace(/"/g, ' ')           // double quotes break VBScript string literals
    .replace(/[\r\n\t]/g, ' ')    // no newlines inside the VBScript string
    .replace(/[^\x20-\x7E]/g, ' ')// strip emojis / non-ASCII
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 500)

  if (!safe) return

  const tmpFile = path.join(app.getPath('temp'), 'dumpling_tts.vbs')

  try {
    // One-liner VBScript — double-quoted string, no escaping needed
    fs.writeFileSync(tmpFile, `CreateObject("SAPI.SpVoice").Speak "${safe}"`, 'utf8')
  } catch (err) {
    console.error('TTS file write failed:', err.message)
    return
  }

  ttsProc = spawn('wscript.exe', ['/nologo', tmpFile], {
    windowsHide: true,
    stdio: 'ignore',
    detached: false
  })
  ttsProc.on('error', err => console.warn('TTS error:', err.message))
  ttsProc.on('exit',  ()  => { ttsProc = null })
})

ipcMain.on('stop-speak', () => stopTTS())

function stopTTS() {
  if (ttsProc) {
    try { exec('taskkill /F /T /PID ' + ttsProc.pid + ' 2>nul') } catch {}
    ttsProc = null
  }
}

// ════════════════════════════════════════
// OLLAMA — /api/chat uses tinyllama's chat
// template properly (system / user / assistant).
// System prompt is intentionally very short
// because a 1B model ignores long instructions.
// ════════════════════════════════════════
ipcMain.handle('ask-ollama', async (e, { prompt, useContext, systemOverride }) => {
  try {
    const db  = loadDB()
    const ctx = useContext ? buildContext(db) : ''

    const system = systemOverride
      ? systemOverride
      : 'You are Dumpling, a kind helper for an autistic adult at work. ' +
        'Reply in 1-2 short plain English sentences. No jargon.' +
        (ctx ? ' ' + ctx : '')

    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'tinyllama',
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: prompt }
        ],
        stream: true,
        options: {
          temperature:    0.4,
          num_predict:    130,
          top_k:          20,
          top_p:          0.85,
          repeat_penalty: 1.2,
          stop: ['</s>', '<|user|>', '<|system|>', '\nUser:', '\nHuman:']
        }
      }),
      signal: AbortSignal.timeout(120000)
    })

    if (!res.ok) throw new Error('HTTP ' + res.status)

    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let out = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const line of decoder.decode(value, { stream: true }).split('\n')) {
        const t = line.trim(); if (!t) continue
        try {
          const obj = JSON.parse(t)
          if (obj.message?.content) out += obj.message.content
          if (obj.done) break
        } catch {}
      }
    }

    // Strip template tokens that tinyllama sometimes leaks
    out = out
      .replace(/<\|[^|]*\|>/g, '')
      .replace(/^(Dumpling|Assistant|AI)\s*:\s*/i, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return { ok: true, text: out || '(no response)' }

  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError')
      return { ok: false, text: '⏳ Timed out. Make sure ollama serve is running, then try again.' }
    return { ok: false, text: '❌ ' + err.message + '\n\nOpen cmd and run: ollama serve' }
  }
})

// ════════════════════════════════════════
// DATABASE IPC
// ════════════════════════════════════════
ipcMain.handle('db-load', () => loadDB())
ipcMain.handle('db-save', (e, data) => { saveDB(data); return true })

ipcMain.handle('db-save-message', (e, { role, content }) => {
  const db = loadDB()
  db.conversations = db.conversations || []
  db.conversations.push({ role, content, timestamp: Date.now() })
  if (db.conversations.length > 500) db.conversations = db.conversations.slice(-500)
  saveDB(db)
  return true
})

ipcMain.handle('db-save-camera-event', (e, event) => {
  const db = loadDB()
  db.cameraEvents = db.cameraEvents || []
  db.cameraEvents.push({ ...event, timestamp: Date.now() })
  if (db.cameraEvents.length > 1000) db.cameraEvents = db.cameraEvents.slice(-1000)
  saveDB(db)
  if (['panic', 'stress_high', 'habit_detected'].includes(event.type)) {
    dash?.webContents.send('camera-alert', event)
    buddy?.webContents.send('camera-alert', event)
  }
  return true
})