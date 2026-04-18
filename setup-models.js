const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, 'models')
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

const FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_expression_model-weights_manifest.json',
  'face_expression_model-shard1'
]

const MIRRORS = [
  'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/',
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/'
]

function downloadFile(fileUrl, dest) {
  return new Promise((resolve, reject) => {
    const tmp = dest + '.tmp'
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp)
    const client = fileUrl.startsWith('https') ? https : http
    const file = fs.createWriteStream(tmp)
    const req = client.get(fileUrl, { timeout: 30000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); try { fs.unlinkSync(tmp) } catch {}
        downloadFile(res.headers.location, dest).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) {
        file.close(); try { fs.unlinkSync(tmp) } catch {}
        reject(new Error('HTTP ' + res.statusCode)); return
      }
      let size = 0
      res.on('data', chunk => { size += chunk.length })
      res.pipe(file)
      file.on('finish', () => {
        file.close(() => {
          if (size < 50) {
            try { fs.unlinkSync(tmp) } catch {}
            reject(new Error('File too small (' + size + ' bytes) — likely an error page'))
            return
          }
          fs.renameSync(tmp, dest)
          resolve()
        })
      })
    })
    req.on('error', err => { file.close(); try { fs.unlinkSync(tmp) } catch {}; reject(err) })
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

async function downloadWithFallback(filename) {
  const dest = path.join(OUT, filename)
  if (fs.existsSync(dest) && fs.statSync(dest).size > 100) {
    if (filename.endsWith('.json')) {
      try { JSON.parse(fs.readFileSync(dest, 'utf8')); console.log('  ✓ Valid: ' + filename); return true } catch {}
      console.log('  ✗ Corrupted JSON, re-downloading: ' + filename)
      fs.unlinkSync(dest)
    } else {
      console.log('  ✓ Have: ' + filename); return true
    }
  }
  for (let i = 0; i < MIRRORS.length; i++) {
    const url = MIRRORS[i] + filename
    try {
      process.stdout.write(`  Downloading ${filename} (mirror ${i + 1})... `)
      await downloadFile(url, dest)
      const stat = fs.statSync(dest)
      if (filename.endsWith('.json')) JSON.parse(fs.readFileSync(dest, 'utf8'))
      console.log('✓ (' + Math.round(stat.size / 1024) + 'KB)')
      return true
    } catch (e) {
      console.log('✗ ' + e.message)
    }
  }
  return false
}

async function main() {
  console.log('=== Dumpling Buddy — Model Setup ===\n')
  console.log('Output folder:', OUT, '\n')
  let ok = 0
  for (const f of FILES) {
    const success = await downloadWithFallback(f)
    if (success) ok++
  }
  console.log('\n' + (ok === FILES.length ? '✅ ALL' : `⚠️  ${ok}/${FILES.length}`) + ' models ready')
  if (ok < FILES.length) { console.log('Some failed. Check internet and re-run.'); process.exit(1) }
  else console.log('\nRun: npm start')
}

main()