"""First-visit offline test of the production build.

Flow (deliberately one online load only):
  1. Open the app online for the first time.
  2. Wait for the service worker to finish installing and caching the shell.
  3. Confirm the required assets (index.html, the hashed JS/CSS, manifest) are cached locally.
  4. Disconnect the network WITHOUT reloading while online.
  5. Reload the application offline.
  6. Confirm the application loads and its core interface is accessible.

The test never performs an extra online reload to prime the cache: the precache that
happens during the first visit must be enough on its own.

Usage:
  npm run build && npx vite preview --port 4173 &
  python3 scripts/e2e/offline.py
Requires: pip install playwright && playwright install chromium
"""
from playwright.sync_api import sync_playwright
import json
import sys

URL = "http://localhost:4173/"
result = {}

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

    # 2. Wait for the service worker to finish installing and caching.
    result["sw_active"] = page.evaluate(
        "navigator.serviceWorker.ready.then(r => !!(r && r.active))"
    )
    # Let the precache settle.
    page.wait_for_timeout(2500)

    # 3. Confirm the required assets are present in the cache.
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
    result["cache_names"] = page.evaluate("caches.keys()")
    result["cached_count"] = len(cached)
    result["has_index"] = any(u.rstrip("/") == URL.rstrip("/") for u in cached)
    result["has_js"] = any(u.endswith(".js") for u in cached)
    result["has_css"] = any(u.endswith(".css") for u in cached)
    result["has_manifest"] = any(u.endswith("manifest.webmanifest") for u in cached)

    # 4. Disconnect the network without reloading while online.
    ctx.set_offline(True)

    # 5. Reload offline.
    try:
        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(1500)
        result["offline_body_len"] = len(page.inner_text("body"))
        # 6. Core interface accessible: the React root actually rendered content.
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

    result["errors"] = errors
    browser.close()

print(json.dumps(result, indent=1))

ok = (
    result.get("sw_active") is True
    and result.get("has_index") is True
    and result.get("has_js") is True
    and result.get("has_css") is True
    and isinstance(result.get("offline_body_len"), int)
    and result["offline_body_len"] > 50
    and result.get("offline_root_children", 0) > 0
    and result.get("offline_has_nav") is True
    and not errors
)
print("OFFLINE", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
