"""Browser acceptance test for the PWA update lifecycle across MULTIPLE tabs.

skipWaiting() is a GLOBAL action: it activates the new worker for every client of the
origin, so `controllerchange` fires in every open NUQTA tab. An update applied in one tab
must therefore never reload another tab out from under the user.

This test serves the real production build with GitHub-Pages-style caching
(`Cache-Control: max-age=600` + a content ETag), opens TWO tabs in one browser context, and
checks that a tab holding unsaved in-memory work is never reloaded:

  1. Both tabs load version A and are controlled by the worker.
  2. The "working" tab records an in-memory sentinel (window.__work) that a reload would
     discard, and counts its own loads and controller changes.
  3. Version B is deployed.
  4. The working tab is simulated as hidden (its visibilityState is overridden and a
     visibilitychange is dispatched). Hiding a tab must NOT apply the update: no
     controller change and no reload may follow.
  5. The other tab applies the update through the real UI (the "Apply update" banner).
  6. Assertions:
       - the working tab NEVER reloaded and its sentinel survived, even though it observed
         the global controller change,
       - the applying tab reloaded exactly once onto version B,
       - obsolete caches were reclaimed only after the reload (deferred cleanup),
       - no reload loop anywhere.

Usage:
  npm run build
  python3 scripts/e2e/update-multitab.py
Requires: pip install playwright && playwright install chromium
"""
import hashlib
import http.server
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
PORT = int(os.environ.get("UPDATE_MULTITAB_PORT", "4184"))
ROOT = tempfile.mkdtemp(prefix="nuqta-multitab-")

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
    """Mimic a new commit landing: new hashed bundle, new document, bumped worker version.

    Build B also DROPS an asset that build A shipped (an anatomy plate), so the plate exists
    only in build A's precache. That is what lets us prove a tab still on A can keep loading
    its own build's assets — offline — after another tab has moved to B and run cleanup.
    """
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

    # Build B no longer ships this plate. A tab still on A must still be able to load it
    # from A's retained cache, even offline, after B's worker has run cleanup.
    dropped_asset = "anatomy/masks/hamstrings_back.webp"
    dropped_path = os.path.join(ROOT, dropped_asset)
    if os.path.isfile(dropped_path):
        os.remove(dropped_path)
    return old_js, new_js, dropped_asset


def wait_for_controller(page, tries=30):
    # Poll with evaluate() (a function) — the app CSP has no 'unsafe-eval', so evaluating a
    # string expression would be blocked by the page's own policy.
    for _ in range(tries):
        if page.evaluate("!!navigator.serviceWorker.controller"):
            return True
        page.wait_for_timeout(500)
    return False


if not os.path.isdir(DIST):
    print(json.dumps({"failures": [f"build output not found at {DIST}; run npm run build first"]}, indent=1))
    print("UPDATE MULTITAB FAIL")
    sys.exit(1)

shutil.copytree(DIST, ROOT, dirs_exist_ok=True)
server = Server(("127.0.0.1", PORT), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{PORT}/"

loads = {"working": 0, "applying": 0}
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(timezone_id="Africa/Cairo", locale="en-US", service_workers="allow")
    working = ctx.new_page()
    applying = ctx.new_page()

    for page, name in ((working, "working"), (applying, "applying")):
        page.on("load", lambda _p, n=name: loads.__setitem__(n, loads[n] + 1))
        page.on("pageerror", lambda e: errors.append("PAGEERROR " + str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    # 1. Both tabs load version A and are controlled by the worker.
    working.goto(URL, wait_until="networkidle")
    applying.goto(URL, wait_until="networkidle")
    result["working_controlled"] = wait_for_controller(working)
    result["applying_controlled"] = wait_for_controller(applying)
    if not (result["working_controlled"] and result["applying_controlled"]):
        failures.append("a tab was not controlled by the service worker")

    working.wait_for_timeout(1500)
    applying.wait_for_timeout(1500)
    result["loads_after_first_visit"] = dict(loads)
    if loads["working"] != 1 or loads["applying"] != 1:
        failures.append(f"the first install reloaded a tab ({loads}); it must not reload")

    # 2. The working tab holds in-memory work that a reload would discard, and counts its
    #    own loads and controller changes.
    working.evaluate(
        """() => {
            window.__work = 'draft-42';
            window.__ctrlChanges = 0;
            navigator.serviceWorker.addEventListener('controllerchange', () => { window.__ctrlChanges++; });
        }"""
    )
    result["working_build_before"] = working.evaluate(
        "document.querySelector('meta[name=nuqta-build]') ? document.querySelector('meta[name=nuqta-build]').content : null"
    )

    # 3. A new deployment goes live while both tabs stay open.
    old_js, new_js, dropped_asset = deploy_version_b()
    result["deployed_js"] = new_js
    result["dropped_asset"] = dropped_asset

    # Trigger detection in both tabs (the real manager also polls on its own).
    for page in (working, applying):
        page.evaluate("() => navigator.serviceWorker.getRegistration().then(r => r.update())")

    # The plate is precached by A's worker (it is in A's manifest), so it is already in A's
    # cache; assert it is reachable while still online before the offline check below.
    result["old_asset_online_status"] = working.evaluate(
        """async (url) => {
            const res = await fetch(url);
            return res.status;
        }""",
        "/" + dropped_asset,
    )
    if result["old_asset_online_status"] != 200:
        failures.append(
            f"the build-A plate was not reachable online before the offline check (status {result['old_asset_online_status']})"
        )

    # Wait until the new worker is installed and waiting.
    def has_waiting(page, tries=30):
        for _ in range(tries):
            if page.evaluate("() => navigator.serviceWorker.getRegistration().then(r => !!(r && r.waiting))"):
                return True
            page.wait_for_timeout(500)
        return False

    result["waiting_worker_present"] = has_waiting(applying)
    if not result["waiting_worker_present"]:
        failures.append("the new worker never reached the waiting state")

    # 4. Simulate the working tab going hidden. Hiding a tab must never apply an update.
    hidden_ok = working.evaluate(
        """() => {
            try {
                Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
            } catch (e) { return false; }
            document.dispatchEvent(new Event('visibilitychange'));
            return document.visibilityState === 'hidden';
        }"""
    )
    result["hidden_simulated"] = hidden_ok
    working.wait_for_timeout(1500)
    result["working_ctrl_changes_after_hide"] = working.evaluate("window.__ctrlChanges")
    result["loads_after_hide"] = dict(loads)
    if not hidden_ok:
        failures.append("could not simulate the hidden state (visibilityState override failed)")
    if working.evaluate("window.__ctrlChanges") != 0:
        failures.append("hiding a tab triggered a controller change (it must not apply the update)")
    if loads["working"] != 1:
        failures.append("hiding a tab reloaded the working tab")

    # 5. The other tab applies the update through the real UI.
    try:
        applying.wait_for_selector("button:has-text('Apply update')", timeout=8000)
        result["apply_button_present"] = True
        applying.click("button:has-text('Apply update')")
    except Exception:
        result["apply_button_present"] = False
        failures.append("the update banner never appeared in the applying tab")

    # 6. The applying tab reloads onto version B; the working tab does not reload.
    # The reload may come from controllerchange or the 4s fallback, so poll for it.
    for _ in range(30):
        if loads["applying"] >= 2 and applying.evaluate(
            "document.querySelector('meta[name=nuqta-build]') ? document.querySelector('meta[name=nuqta-build]').content : null"
        ) == "B":
            break
        applying.wait_for_timeout(500)
    applying.wait_for_timeout(1500)
    result["applying_build_after"] = applying.evaluate(
        "document.querySelector('meta[name=nuqta-build]') ? document.querySelector('meta[name=nuqta-build]').content : null"
    )
    result["loads_final"] = dict(loads)
    # If the working tab had been reloaded, these globals would be gone; read defensively
    # so the test reports a clear failure instead of crashing on a null.
    result["working_ctrl_changes_final"] = working.evaluate("window.__ctrlChanges ?? null")
    result["working_work_survived"] = working.evaluate("window.__work === 'draft-42'")
    result["working_build_after"] = working.evaluate(
        "document.querySelector('meta[name=nuqta-build]') ? document.querySelector('meta[name=nuqta-build]').content : null"
    )

    if result["applying_build_after"] != "B":
        failures.append("the applying tab did not reload onto the new deployment")
    if loads["applying"] != 2:
        failures.append(f"the applying tab reloaded {loads['applying']} times; expected exactly one update reload")
    if loads["working"] != 1:
        failures.append(
            f"the working tab reloaded {loads['working']} times; another tab's update must never reload it"
        )
    if not result["working_work_survived"]:
        failures.append("the working tab LOST its unsaved in-memory work")
    # Version A carries no nuqta-build meta, so "still on A" means the meta is absent.
    if result["working_build_after"] is not None:
        failures.append("the working tab silently changed build without a reload")
    if result["working_ctrl_changes_final"] is None:
        failures.append("the working tab was reloaded (its globals were wiped)")
    elif result["working_ctrl_changes_final"] < 1:
        failures.append("the working tab never observed the global controller change (test did not exercise the path)")

    # Caches: the current version AND the previous version must survive cleanup. A reloaded
    # tab is not proof that every other tab has migrated, so the previous cache is retained
    # for the tab still running build A.
    result["caches_final"] = applying.evaluate("caches.keys()")
    shell = sorted(k for k in result["caches_final"] if k.startswith("nuqta-shell-"))
    result["shell_caches"] = shell
    if len(shell) != 2:
        failures.append(f"expected current + previous shell caches after cleanup, got {shell}")

    # 7. Go offline and request, from the tab still on A, an asset that build A shipped but
    #    build B dropped. It must come from A's retained cache: this is the whole point of
    #    not deleting the previous version just because one tab reloaded.
    working.evaluate(
        "() => navigator.serviceWorker.getRegistration().then(r => r && r.active && r.active.postMessage({ type: 'nuqta-claim-cleanup' }))"
    )
    working.wait_for_timeout(1000)

    ctx.set_offline(True)
    result["offline_after_cleanup"] = True
    asset_path = "/" + dropped_asset
    result["old_asset_url"] = asset_path
    result["old_asset_status"] = working.evaluate(
        """async (url) => {
            try {
                const res = await fetch(url, { cache: 'no-store' });
                return res.status;
            } catch (e) { return 'error: ' + e.message; }
        }""",
        asset_path,
    )
    if result["old_asset_status"] != 200:
        failures.append(
            f"a build-A asset ({asset_path}) no longer loaded from the old tab after cleanup + offline (status {result['old_asset_status']})"
        )
    ctx.set_offline(False)

    # No reload loop anywhere.
    applying.wait_for_timeout(2000)
    result["loads_stable"] = dict(loads)
    if loads != result["loads_final"]:
        failures.append("a tab reloaded again on its own (reload loop)")

    if errors:
        failures.append(f"console/page errors: {errors[:3]}")
    result["errors"] = errors
    ctx.close()
    browser.close()

server.shutdown()
shutil.rmtree(ROOT, ignore_errors=True)

result["failures"] = failures
print(json.dumps(result, indent=1))
ok = not failures
print("UPDATE MULTITAB", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
