#!/usr/bin/env python3
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 8766

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
        self.json_response(410, {"error": {"message": "Legacy AI proxy is disabled. Start the Node service and use the authenticated /api/ai/* gateway."}})

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
