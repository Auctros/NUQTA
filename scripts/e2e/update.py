"""Browser acceptance test for the PWA update lifecycle.

Reproduces the exact regression users hit: a new deployment did not show up because the
service worker's navigation fetch trusted the HTTP cache (GitHub Pages marks index.html
`max-age=600`), so a reload kept returning the OLD document and the OLD hashed bundle.

The test serves the real production build with GitHub-Pages-style caching
(`Cache-Control: max-age=600` + a content ETag), then:

  1. Loads version A and waits for the service worker to control the page. The first-ever
     install must NOT reload the page (a reload there would be a self-inflicted loop).
  2. "Deploys" version B by swapping index.html to reference a new bundle (and bumping the
     worker's CACHE_VERSION), exactly like a new commit going live.
  3. Performs ONE ordinary reload — no hard refresh, no cache clearing.
  4. Asserts the page is now version B, that the reload happened exactly once (no loop),
     and that the new worker was detected (its versioned cache appears).

Usage:
  npm run build
  python3 scripts/e2e/update.py
Requires: pip install playwright && playwright install chromium
"""
import http.server
import hashlib
import json
import mimetypes
import os
import re
import shutil
import socketserver
import sys
import tempfile
import threading

from playwright.sync_api import sync_playwright

DIST = os.environ.get("UPDATE_DIST", "dist")
PORT = int(os.environ.get("UPDATE_PORT", "4183"))
ROOT = tempfile.mkdtemp(prefix="nuqta-update-")

mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("image/svg+xml", ".svg")

result = {}
failures = []


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def _file_for(self, path):
        fp = os.path.join(ROOT, path.split("?")[0].lstrip("/"))
        if os.path.isdir(fp):
            fp = os.path.join(fp, "index.html")
        return fp if os.path.isfile(fp) else None

    def do_GET(self):  # noqa: N802
        fp = self._file_for(self.path)
        if not fp:
            self.send_error(404)
            return
        with open(fp, "rb") as fh:
            data = fh.read()
        etag = '"' + hashlib.md5(data).hexdigest() + '"'
        # GitHub Pages: static assets are edge-cached for ten minutes.
        headers = [("ETag", etag), ("Cache-Control", "max-age=600")]
        if self.headers.get("If-None-Match") == etag:
            self.send_response(304)
            for k, v in headers:
                self.send_header(k, v)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type", self.guess_type(fp))
        self.send_header("Content-Length", str(len(data)))
        for k, v in headers:
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def deploy_version_b():
    """Mimic a new commit landing: new hashed bundle, new document, bumped worker version."""
    index = os.path.join(ROOT, "index.html")
    html = open(index, encoding="utf-8").read()
    match = re.search(r"assets/index-[^\"']+\.js", html)
    if not match:
        raise RuntimeError("could not find the hashed bundle in index.html")
    old_js = match.group(0)
    new_js = "assets/index-BUILD-B.js"
    shutil.copyfile(os.path.join(ROOT, old_js), os.path.join(ROOT, new_js))
    html = html.replace(old_js, new_js)
    html = html.replace("</head>", '<meta name="nuqta-build" content="B"></head>', 1)
    open(index, "w", encoding="utf-8").write(html)

    sw_path = os.path.join(ROOT, "sw.js")
    sw = open(sw_path, encoding="utf-8").read()
    sw = re.sub(
        r"CACHE_VERSION\s*=\s*(\d+)",
        lambda m: f"CACHE_VERSION = {int(m.group(1)) + 1}",
        sw,
        count=1,
    )
    open(sw_path, "w", encoding="utf-8").write(sw)
    return old_js, new_js


if not os.path.isdir(DIST):
    print(json.dumps({"failures": [f"build output not found at {DIST}; run npm run build first"]}, indent=1))
    print("UPDATE FAIL")
    sys.exit(1)

shutil.copytree(DIST, ROOT, dirs_exist_ok=True)
server = Server(("127.0.0.1", PORT), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{PORT}/"

loads = {"n": 0}

with sync_playwright() as p:
    browser = p.chromium.launch()
    profile = tempfile.mkdtemp(prefix="nuqta-update-profile-")
    ctx = browser.new_context(
        timezone_id="Africa/Cairo", locale="en-US", service_workers="allow"
    )
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append("PAGEERROR " + str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("load", lambda: loads.__setitem__("n", loads["n"] + 1))

    # 1. Version A loads and the worker takes control.
    # NOTE: poll with page.evaluate() rather than wait_for_function(string, …): the app's
    # CSP is `script-src 'self'` with no 'unsafe-eval', so evaluating an arbitrary string
    # expression is blocked by the page's own policy. evaluate() of a function is allowed.
    page.goto(URL, wait_until="networkidle")
    controlled = False
    for _ in range(30):
        if page.evaluate("!!navigator.serviceWorker.controller"):
            controlled = True
            break
        page.wait_for_timeout(500)
    result["sw_controls_page"] = controlled
    if not controlled:
        result["sw_state"] = page.evaluate(
            "async () => { const r = await navigator.serviceWorker.getRegistration();"
            " return { has: !!r, active: r && r.active ? r.active.state : null,"
            " ctrl: !!navigator.serviceWorker.controller }; }"
        )
        failures.append("the service worker never took control of the page")

    page.wait_for_timeout(2000)
    result["loads_after_first_visit"] = loads["n"]
    if loads["n"] != 1:
        failures.append(
            f"the first install reloaded the page ({loads['n']} loads); it must not reload"
        )

    result["initial_caches"] = page.evaluate("caches.keys()")
    result["build_before"] = page.evaluate(
        "document.querySelector('meta[name=nuqta-build]') ? document.querySelector('meta[name=nuqta-build]').content : null"
    )

    # 2. A new deployment goes live while the tab stays open.
    old_js, new_js = deploy_version_b()
    result["deployed_js"] = new_js

    # 3. One ordinary reload. No hard refresh, no cache clearing.
    page.reload(wait_until="load")
    page.wait_for_timeout(1500)

    result["build_after"] = page.evaluate(
        "document.querySelector('meta[name=nuqta-build]') ? document.querySelector('meta[name=nuqta-build]').content : null"
    )
    result["scripts_after"] = page.evaluate(
        "[...document.querySelectorAll('script[src]')].map(s => s.getAttribute('src'))"
    )
    result["loads_after_reload"] = loads["n"]

    if result["build_after"] != "B":
        failures.append("a single normal reload did NOT pick up the new deployment (stale HTTP cache)")
    if not any((s or "").endswith("index-BUILD-B.js") for s in result["scripts_after"]):
        failures.append("the reloaded page still references the old bundle")

    # 4. The new worker must be detected, and the reload must not loop.
    # Poll with evaluate() for the same CSP reason as above (no 'unsafe-eval').
    initial = set(result["initial_caches"])
    new_worker_detected = False
    for _ in range(20):
        keys = page.evaluate("caches.keys()")
        if any(k.startswith("nuqta-shell-") and k not in initial for k in keys):
            new_worker_detected = True
            break
        page.wait_for_timeout(500)
    result["new_worker_detected"] = new_worker_detected
    if not new_worker_detected:
        failures.append("the new service worker was never detected after the deploy")

    page.wait_for_timeout(2500)
    result["loads_final"] = loads["n"]
    if loads["n"] != result["loads_after_reload"]:
        failures.append("the page reloaded again on its own (reload loop)")

    result["errors"] = errors
    if errors:
        failures.append(f"console/page errors: {errors[:3]}")
    ctx.close()
    browser.close()

server.shutdown()
shutil.rmtree(ROOT, ignore_errors=True)

result["failures"] = failures
print(json.dumps(result, indent=1))
ok = not failures
print("UPDATE", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
