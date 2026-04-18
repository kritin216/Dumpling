# 🥟 Dumpling Buddy

> An offline-first AI-powered desktop accessibility companion designed for autistic adults in the workplace.

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Offline](https://img.shields.io/badge/AI-100%25%20Offline-green)
![Built With](https://img.shields.io/badge/built%20with-Electron%20%2B%20Ollama-orange)

---

## What it does

Dumpling is a floating desktop character that lives on your screen and actively supports you through your workday:

| Feature | Description |
|---|---|
| 📷 Emotion Detection | Live webcam analysis detects stress, panic, and habits using face-api.js |
| 🫁 Quiet Mode | 4-7-8 breathing anchor — triggers automatically on panic detection |
| 🔍 Corporate Decoder | Translates vague workplace messages into plain tasks |
| 🛡 Pushback Builder | Generates 3 professional boundary-setting responses |
| 💬 AI Chat | Warm, patient AI companion powered by local LLM |
| ⏰ Reminders | Water, break, and posture reminders with voice alerts |
| 🔊 Text-to-Speech | Fully offline Windows SAPI voice synthesis |

**Everything runs on your machine. No data leaves your device. Ever.**

---

## Tech Stack

- **Electron** — Desktop shell, transparent overlay window
- **face-api.js** — Local face and expression detection (no cloud API)
- **Ollama + TinyLlama** — Fully offline local LLM inference
- **Windows SAPI** — Offline text-to-speech via PowerShell
- **Node.js / plain JSON** — Local database, no external DB needed

---

## Prerequisites

- Windows 10 or later
- Node.js (LTS) — nodejs.org
- Ollama — ollama.com

---

## Setup

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/dumpling-buddy.git
cd dumpling-buddy

# 2. Install dependencies
npm install

# 3. Download face detection models (needs internet once)
node setup-models.js

# 4. Pull the AI model (needs internet once)
ollama pull tinyllama

# 5. Start Ollama (keep this running in a separate terminal)
ollama serve

# 6. Launch the app
npm start
```

---

## Project Structure

dumpling-buddy/
├── main.js              # Electron main process, IPC, TTS, Ollama
├── dashboard.html       # Main control panel UI
├── buddy.html           # Transparent floating character window
├── setup-models.js      # Downloads face-api.js model files
├── models/              # face-api.js weights (auto-downloaded)
├── animations/          # Character GIF states (idle, happy, etc.)
│   ├── idle.gif
│   ├── happy.gif
│   ├── talking.gif
│   ├── thinking.gif
│   ├── quiet.gif
│   └── sleeping.gif
└── data/                # Local user data (gitignored)

---

## Animation States

| File | Triggered when |
|---|---|
| `idle.gif` | Default / waiting |
| `happy.gif` | Clicked, or user is happy |
| `talking.gif` | Speaking via TTS |
| `thinking.gif` | AI generating a response |
| `quiet.gif` | Quiet Mode / panic detected |
| `sleeping.gif` | No activity for 60 seconds |

---

## Co-developed by

[Kritin Bindlish] 
[Riddhima Chawla]
— with AI assistance from Claude (Anthropic)

---

## License

MIT
