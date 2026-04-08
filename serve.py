#!/usr/bin/env python3
"""
Tiny HTTP server that injects API keys from .env into index.html on the fly.

Usage:
    python3 serve.py              # serve at http://localhost:8000
    python3 serve.py 8080         # custom port

Searches for .env in this order:
    1. ./refiner-ui/.env
    2. ../.env (GameUIAgent root)
    3. ../backend/.env

Recognized keys (any of):
    GEMINI_API_KEY, GOOGLE_API_KEY  → window.GEMINI_API_KEY
    OPENROUTER_API_KEY, OR_API_KEY  → window.OPENROUTER_API_KEY

The keys are injected as a <script> tag in <head> of index.html. They never
touch disk: nothing is written, no config.js is generated. Just runtime
substitution from RAM.
"""

import base64
import http.server
import json
import os
import re
import socketserver
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
RUNS_DIR = HERE / "runs"
ENV_SEARCH_PATHS = [
    HERE / ".env",
    HERE.parent / ".env",
    HERE.parent / "backend" / ".env",
]

SAFE_NAME = re.compile(r"^[A-Za-z0-9._-]+$")

GEMINI_KEYS = ["GEMINI_API_KEY", "GOOGLE_API_KEY"]
OR_KEYS = ["OPENROUTER_API_KEY", "OR_API_KEY"]


def parse_env(path: Path) -> dict:
    """Minimal .env parser. Handles KEY=value, KEY="value", comments, blank lines."""
    out = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip()
        # strip optional surrounding quotes
        if (v.startswith('"') and v.endswith('"')) or (
            v.startswith("'") and v.endswith("'")
        ):
            v = v[1:-1]
        out[k] = v
    return out


def load_env() -> dict:
    for p in ENV_SEARCH_PATHS:
        if p.exists():
            print(f"[serve] reading {p}")
            return parse_env(p)
    print("[serve] WARNING: no .env found in any of:")
    for p in ENV_SEARCH_PATHS:
        print(f"          {p}")
    return {}


def first_value(env: dict, keys: list) -> str:
    for k in keys:
        if env.get(k):
            return env[k]
    return ""


def build_inject_script(env: dict) -> str:
    payload = {
        "GEMINI_API_KEY": first_value(env, GEMINI_KEYS),
        "OPENROUTER_API_KEY": first_value(env, OR_KEYS),
    }
    # Trim values for log without leaking the full key
    summary = {
        k: (v[:6] + "..." + v[-4:])
        if v and len(v) > 12
        else ("(missing)" if not v else v)
        for k, v in payload.items()
    }
    print(f"[serve] injecting keys: {summary}")
    js = "; ".join(f"window.{k}={json.dumps(v)}" for k, v in payload.items())
    return f"<script>{js}</script>"


def make_handler(env: dict):
    inject = build_inject_script(env)

    class Handler(http.server.SimpleHTTPRequestHandler):
        def _send_json(self, status, payload):
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def do_POST(self):
            path = self.path.split("?", 1)[0]
            if path != "/save":
                self.send_error(404, "POST only supported on /save")
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                raw = self.rfile.read(length)
                payload = json.loads(raw.decode("utf-8"))
                session = payload.get("session", "").strip()
                filename = payload.get("filename", "").strip()
                if not session or not filename:
                    self._send_json(
                        400, {"ok": False, "error": "session and filename required"}
                    )
                    return
                if not SAFE_NAME.match(session) or not SAFE_NAME.match(filename):
                    self._send_json(
                        400, {"ok": False, "error": "invalid session/filename chars"}
                    )
                    return

                session_dir = RUNS_DIR / session
                session_dir.mkdir(parents=True, exist_ok=True)
                target = session_dir / filename

                if "data_base64" in payload:
                    data = base64.b64decode(payload["data_base64"])
                    target.write_bytes(data)
                elif "text" in payload:
                    target.write_text(payload["text"], encoding="utf-8")
                else:
                    self._send_json(
                        400, {"ok": False, "error": "need data_base64 or text"}
                    )
                    return

                rel = target.relative_to(HERE).as_posix()
                size = target.stat().st_size
                print(f"[serve] saved {rel} ({size} bytes)")
                self._send_json(200, {"ok": True, "path": rel, "size": size})
            except Exception as e:
                self._send_json(500, {"ok": False, "error": str(e)})

        def do_GET(self):
            # Strip query string
            path = self.path.split("?", 1)[0]
            if path in ("/", "/index.html"):
                try:
                    html = (HERE / "index.html").read_text(encoding="utf-8")
                except FileNotFoundError:
                    self.send_error(404, "index.html not found")
                    return
                # Inject the script tag right before </head>
                if "</head>" in html:
                    html = html.replace("</head>", inject + "\n</head>", 1)
                else:
                    html = inject + html
                body = html.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()
                self.wfile.write(body)
                return
            # Default static file serving for everything else
            super().do_GET()

        def log_message(self, fmt, *args):
            sys.stderr.write(f"[serve] {self.address_string()} - {fmt % args}\n")

    Handler.directory = str(HERE)
    return Handler


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    env = load_env()

    os.chdir(HERE)
    handler = make_handler(env)
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"[serve] http://localhost:{port}/  (Ctrl+C to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[serve] bye")


if __name__ == "__main__":
    main()
