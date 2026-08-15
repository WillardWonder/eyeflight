#!/usr/bin/env python3
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os, webbrowser, threading
from pathlib import Path

HERE = Path(__file__).resolve().parent
os.chdir(HERE)
HOST, PORT = "127.0.0.1", 8000
URL = f"http://{HOST}:{PORT}/"

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

print(f"Eye Flight local preview: {URL}")
threading.Timer(0.6, lambda: webbrowser.open(URL)).start()
ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
