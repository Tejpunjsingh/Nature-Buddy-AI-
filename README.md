# Nature-Buddy-AI-
# NatureBuddy AI — Find your outside 🌿

An attractive, offline-first outdoor companion built with HTML, CSS, and vanilla JavaScript. It helps people trade a little screen time for real-world nature experiences.

## What's included

- **Outdoor micro-adventure planner** for mindful walks, birdwatching, gardening, nature photography, cloud watching, and a gentle movement break.
- **Discovery library** with category filters and search.
- **Private field notebook** stored in this browser with note deletion and text export.
- **Progress counter** for outdoor moments you mark complete.
- **Offline-first assets** with a service worker that caches the website after the first local launch.
- **Optional local AI** via Ollama. If the model isn't present or the AI can't answer, the built-in planner remains usable.
- **Responsive design** for laptop and phone, keyboard focus styles, and reduced-motion support.

No analytics, account, hosted fonts, images, or remote website assets are required. The bundled frontend is designed not to send notes to a server. When enabled, the text of the selected activity and settings is sent only to the Ollama instance on your own machine for that one plan.

## Run the website locally

Requirements: Python 3 (already included on most recent macOS installations).

1. Extract `naturebuddy-ai.zip`.
2. Open Terminal and enter the extracted project folder. For example:

   ```bash
   cd ~/Downloads/naturebuddy-ai
   ```

3. Start the local website:

   ```bash
   python3 server.py
   ```

4. Open **http://127.0.0.1:8000** in Chrome, Safari, or Firefox.

The server binds to `127.0.0.1` (your own machine only). The main website and built-in activity plans work without an internet connection. Visit the page once while the local server is running to let the service worker cache the app files for later offline launches. Browser site data must remain available for notes and installed offline assets to persist.

## Optional: use an open-weight model locally

Install [Ollama](https://ollama.com/download) and download your preferred compatible model. The default model name in this project is `qwen3.5:0.8b`.

```bash
ollama pull qwen3.5:0.8b
```

Then start Ollama and run `python3 server.py`. NatureBuddy checks Ollama on the local computer and uses the model when it is available. If your model uses a different name, set the environment variable before starting the server. For example:

```bash
NATUREBUDDY_MODEL=your-model-name python3 server.py
```

Ollama usually runs at `http://127.0.0.1:11434`. NatureBuddy's Python server relays a plan request only to the configured local Ollama endpoint; no third-party AI endpoint is used. Internet is needed to install Ollama and download a model the first time. After setup, inference can run offline.

If the model is not installed or running, you will see an offline-friendly status and can still make plans using the local starter guide.

## Use it offline / install it

- Start the local server and open the website once.
- The service worker caches core files for offline use on the same browser/device.
- On supported browsers, use the browser's **Install app** or **Add to Home Screen** option if it appears.
- For fully offline use with AI as well, install the model ahead of time and start Ollama locally.

The website is not hosted online. This package runs locally on the device where it is extracted.

## Local data

- Notes and the completed-session count use browser `localStorage`.
- Use **Export notes** to make a plain-text backup.
- Clearing browser site data will remove the saved notes/session counter and may remove offline cache files.
- The planner doesn't access location, weather, a camera, or a microphone. It doesn't claim to know local conditions.

## Tech stack

- HTML5 + semantic controls
- CSS with responsive breakpoints and no external stylesheets
- Vanilla JavaScript
- Python standard library HTTP server
- Optional local Ollama API
- Web App Manifest + Service Worker

## Hackathon blurb

**NatureBuddy AI — Less scrolling, more noticing.** NatureBuddy is an offline-first outdoor micro-adventure planner with a private field notebook. It gives people simple, accessible ideas for walks, birdwatching, gardening, and noticing the natural world around them. An optional open-weight model runs locally through Ollama, giving users control over the model and keeping prompts off hosted AI services. After setup, the app and local inference can work without internet. The screen is designed to get out of the way once the adventure begins.
