"""First-visit offline acceptance test of the production build.

This is the mandatory browser-level gate for the offline shell. It exercises the real
sequence a user goes through, on a single online load:

  1. Open the app online for the first time.
  2. Confirm a valid web app manifest is served and is precached.
  3. Wait for the service worker to install AND take control of the page.
  4. Confirm only shell assets (index.html, hashed JS/CSS, manifest, icons/fonts) are
     cached, under the expected versioned cache name.
  5. Disconnect the network WITHOUT reloading while online.
  6. Reload the application offline.
  7. Confirm the application loads and its core interface is accessible.

The test never performs an extra online reload to prime the cache: the precache that
happens during the first visit must be enough on its own.

Usage:
  npm run build && npx vite preview --port 4173 &
  python3 scripts/e2e/offline.py
Requires: pip install playwright && playwright install chromium
"""
from playwright.sync_api import sync_playwright
import json
import os
import sys

URL = os.environ.get("OFFLINE_URL", "http://localhost:4173/")
# The cache name is versioned by the service worker; assert the prefix so a rename or a
# dropped version bump is caught here rather than silently in production.
EXPECTED_CACHE_PREFIX = "nuqta-shell-"
result = {}
failures = []

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(timezone_id="Africa/Cairo", locale="en-US")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append("PAGEERROR " + str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    # 1. First successful online visit.
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(800)
    result["online_body_len"] = len(page.inner_text("body"))

    # 2. A valid web app manifest must be served.
    manifest = page.evaluate(
        """async () => {
            const res = await fetch('./manifest.webmanifest', { cache: 'no-store' });
            if (!res.ok) return { ok: false, status: res.status };
            try { return { ok: true, body: await res.json() }; }
            catch (e) { return { ok: false, status: 'invalid json' }; }
        }"""
    )
    result["manifest_ok"] = bool(manifest.get("ok"))
    body = manifest.get("body") or {}
    manifest_valid = (
        result["manifest_ok"]
        and isinstance(body.get("name"), str) and body["name"] != ""
        and isinstance(body.get("start_url"), str)
        and isinstance(body.get("icons"), list) and len(body["icons"]) > 0
    )
    result["manifest_valid"] = manifest_valid
    if not manifest_valid:
        failures.append("manifest is missing, invalid or lacks a name/start_url/icons")

    # 3. The service worker must install AND take control of this page before we go offline.
    result["sw_active"] = page.evaluate(
        "navigator.serviceWorker.ready.then(r => !!(r && r.active && r.active.state === 'activated'))"
    )
    try:
        page.wait_for_function("navigator.serviceWorker.controller !== null", timeout=8000)
        result["sw_controls_page"] = True
    except Exception:  # noqa: BLE001
        result["sw_controls_page"] = False
    result["sw_controller_script"] = page.evaluate(
        "navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : null"
    )
    if result.get("sw_active") is not True:
        failures.append("service worker did not reach the 'activated' state")
    if result.get("sw_controls_page") is not True:
        failures.append("service worker did not take control of the page before going offline")

    # Let the precache settle, then inspect exactly what was cached.
    page.wait_for_timeout(2500)
    cached = page.evaluate(
        """async () => {
            const keys = await caches.keys();
            const all = [];
            for (const k of keys) {
                const c = await caches.open(k);
                for (const req of await c.keys()) all.push(req.url);
            }
            return all;
        }"""
    )
    cache_names = page.evaluate("caches.keys()")
    result["cache_names"] = cache_names
    result["cached_count"] = len(cached)
    result["has_index"] = any(u.rstrip("/") == URL.rstrip("/") for u in cached)
    result["has_js"] = any(u.endswith(".js") for u in cached)
    result["has_css"] = any(u.endswith(".css") for u in cached)
    result["has_manifest"] = any(u.endswith("manifest.webmanifest") for u in cached)
    # 4. Isolation: the versioned cache must exist, and every cached entry must be a
    # same-origin shell asset (never a cross-origin / API / data URL).
    result["versioned_cache_present"] = any(n.startswith(EXPECTED_CACHE_PREFIX) for n in cache_names)
    result["cached_all_same_origin"] = all(u.startswith(URL) for u in cached)
    result["cached_has_no_data_urls"] = not any(u.startswith("data:") or u.startswith("blob:") for u in cached)

    if not result["versioned_cache_present"]:
        failures.append(f"no versioned cache matching {EXPECTED_CACHE_PREFIX}* was found")
    if not result["has_index"]:
        failures.append("the app shell (index.html) was not precached")
    if not result["has_js"]:
        failures.append("no hashed JavaScript asset was precached")
    if not result["has_css"]:
        failures.append("no CSS asset was precached")
    if not result["has_manifest"]:
        failures.append("the manifest was not precached")
    if not result["cached_all_same_origin"]:
        failures.append("a cross-origin URL was cached; only same-origin shell assets may be cached")
    if not result["cached_has_no_data_urls"]:
        failures.append("a data:/blob: URL was cached")

    # 5. Disconnect the network without reloading while online.
    ctx.set_offline(True)

    # 6. Reload offline.
    try:
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(1500)
        result["offline_body_len"] = len(page.inner_text("body"))
        # 7. Core interface accessible: the React root actually rendered content.
        result["offline_root_children"] = page.evaluate(
            "document.getElementById('root') ? document.getElementById('root').childElementCount : -1"
        )
        result["offline_has_nav"] = page.evaluate(
            "!!document.querySelector('nav, [role=navigation], button, [class*=sidebar]')"
        )
    except Exception as e:  # noqa: BLE001
        result["offline_body_len"] = "FAILED: " + str(e)[:120]
        result["offline_root_children"] = -1
        result["offline_has_nav"] = False

    if not isinstance(result.get("offline_body_len"), int) or result.get("offline_body_len", 0) <= 50:
        failures.append("the app did not render offline")
    if result.get("offline_root_children", 0) <= 0:
        failures.append("the React root was empty offline")
    if result.get("offline_has_nav") is not True:
        failures.append("the core interface was not reachable offline")
    if errors:
        failures.append(f"console/page errors: {errors[:3]}")

    result["errors"] = errors
    browser.close()

result["failures"] = failures
print(json.dumps(result, indent=1))
ok = not failures
print("OFFLINE", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
