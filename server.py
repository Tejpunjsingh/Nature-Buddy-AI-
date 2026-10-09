#!/usr/bin/env python3
"""Serve NatureBuddy locally and optionally proxy prompts to a local Ollama instance."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from pathlib import Path
import json
import os

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = int(os.environ.get("NATUREBUDDY_PORT", "8000"))
OLLAMA_BASE = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
DEFAULT_MODEL = os.environ.get("NATUREBUDDY_MODEL", "qwen3.5:0.8b")

class NatureBuddyHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/health":
            try:
                req = Request(f"{OLLAMA_BASE}/api/tags", headers={"Accept": "application/json"})
                with urlopen(req, timeout=1.7) as response:
                    data = json.loads(response.read().decode("utf-8"))
                models = [item.get("name", "") for item in data.get("models", [])]
                available = any(name == DEFAULT_MODEL or name.startswith(DEFAULT_MODEL + ":") for name in models)
                self.send_json(200, {"ollama": True, "model_available": available, "model": DEFAULT_MODEL, "models": models})
            except (URLError, HTTPError, TimeoutError, OSError, ValueError):
                self.send_json(200, {"ollama": False, "model_available": False, "model": DEFAULT_MODEL, "models": []})
            return
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/chat":
            self.send_json(404, {"error": "Unknown local endpoint."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 200_000 or length <= 0:
                self.send_json(413, {"error": "Request too large or empty."})
                return
            body = self.rfile.read(length)
            payload = json.loads(body.decode("utf-8"))
            payload["model"] = DEFAULT_MODEL
            payload["stream"] = False
            req = Request(
                f"{OLLAMA_BASE}/api/chat",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                method="POST",
            )
            with urlopen(req, timeout=90) as response:
                result = json.loads(response.read().decode("utf-8"))
            self.send_json(200, result)
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")[:500]
            self.send_json(502, {"error": f"Local Ollama returned an error: {detail}"})
        except (URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as exc:
            self.send_json(503, {"error": f"Local AI unavailable: {exc}"})

    def log_message(self, fmt, *args):
        # Keep the console clean; server binds only to the loopback interface.
        pass

if __name__ == "__main__":
    print("\n🌿 NatureBuddy is ready")
    print(f"   Open: http://{HOST}:{PORT}")
    print("   Local notes stay in your browser. Local AI is optional.")
    print("   Press Ctrl+C to stop.\n")
    try:
        ThreadingHTTPServer((HOST, PORT), NatureBuddyHandler).serve_forever()
    except KeyboardInterrupt:
        print("\nNatureBuddy stopped.")
