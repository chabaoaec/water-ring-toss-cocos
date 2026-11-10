#!/usr/bin/env python3
"""Start this extracted demo directory, with a separate port and no browser cache."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser

ROOT = Path(__file__).resolve().parent
VERSION = "v5.2"
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("X-Pocket-Tide-Version", VERSION)
        super().end_headers()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pocket Tide Demo v5.2")
    parser.add_argument("--port", type=int, default=8088)
    parser.add_argument("--no-open", action="store_true")
    args = parser.parse_args()
    if not (ROOT / "index.html").is_file():
        parser.exit(1, "Missing index.html; extract the complete ZIP first.\n")
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), partial(Handler, directory=str(ROOT)))
    except OSError as exc:
        parser.exit(1, f"Cannot start {VERSION}: port {args.port} unavailable ({exc}). Stop the previous server or choose --port 8089.\n")
    url = f"http://127.0.0.1:{args.port}/?build={VERSION}"
    print(f"Pocket Tide DEMO {VERSION}\nServing: {ROOT}\nOpen: {url}\nStop: Ctrl+C", flush=True)
    if not args.no_open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
