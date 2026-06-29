#!/usr/bin/env python3
import json
import os
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 8766

def load_env_key():
    for name in (".env.local", ".env"):
        path = ROOT / name
        if not path.is_file():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            if raw.startswith("OPENAI_API_KEY="):
                return raw.split("=", 1)[1].strip().strip('"').strip("'")
    return os.environ.get("OPENAI_API_KEY", "")

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()

    def blocked(self):
        clean = self.path.split("?", 1)[0]
        return clean.startswith("/.env") or clean.startswith("/.git") or clean.startswith("/.codex") or clean.startswith("/.agents")

    def do_GET(self):
        if self.blocked():
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self):
        if self.blocked():
            self.send_error(404)
            return
        super().do_HEAD()

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/api/chat/completions":
            self.send_error(404)
            return
        key = load_env_key()
        if not key:
            self.json_response(503, {"error": {"message": "OPENAI_API_KEY is not configured"}})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            body = json.dumps({
                "model": payload.get("model", "gpt-4o-mini"),
                "messages": payload.get("messages", []),
                "temperature": payload.get("temperature", 0.4),
            }).encode("utf-8")
            request = urllib.request.Request(
                "https://api.openai.com/v1/chat/completions",
                data=body,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=90) as response:
                self.send_response(response.status)
                self.send_header("Content-Type", "application/json")
                data = response.read()
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as error:
            self.json_response(error.code, json.loads(error.read() or b'{}'))
        except Exception as error:
            self.json_response(502, {"error": {"message": str(error)}})

    def json_response(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        if not self.path.startswith("/api/"):
            return
        super().log_message(fmt, *args)

if __name__ == "__main__":
    os.chdir(ROOT)
    print(f"Personal AI OS running at http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
