"""Browser smoke test of the production build: no third-party requests, no console errors,
empty first run, service worker registered, offline reload works.
Usage: npm run build && npx vite preview --port 4173 &  then  python3 scripts/e2e/smoke.py
Requires: pip install playwright && playwright install chromium"""
from playwright.sync_api import sync_playwright
import json, sys
URL="http://localhost:4173/"
res={}
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(timezone_id="Africa/Cairo", locale="en-US")
    page=ctx.new_page()
    reqs=[]; errs=[]
    page.on("request", lambda r: reqs.append(r.url))
    page.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
    page.on("pageerror", lambda e: errs.append("PAGEERROR "+str(e)))
    page.goto(URL, wait_until="networkidle"); page.wait_for_timeout(800)
    body=page.inner_text("body")
    res["external_requests"]=[u for u in reqs if not u.startswith(URL) and not u.startswith("data:") and not u.startswith("blob:")]
    res["console_errors"]=errs
    res["has_Tariq"]="Tariq" in body
    res["body_len"]=len(body)
    res["seeded_keys"]=page.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('nuqta_tasks')||k.startsWith('nuqta_habits'))")
    res["sw_registered"]=page.evaluate("navigator.serviceWorker.ready.then(r=>!!r.active)")
    page.wait_for_timeout(1500); page.reload(wait_until="networkidle")  # sw now controls
    ctx.set_offline(True)
    try:
        page.reload(wait_until="domcontentloaded"); page.wait_for_timeout(1200)
        res["offline_reload_len"]=len(page.inner_text("body"))
    except Exception as e:
        res["offline_reload_len"]="FAILED: "+str(e)[:100]
    b.close()
print(json.dumps(res,indent=1))
ok = (not res["external_requests"] and not res["console_errors"] and not res["has_Tariq"] and res["body_len"]>50
      and res["seeded_keys"]==[] and res["sw_registered"] is True and isinstance(res["offline_reload_len"],int) and res["offline_reload_len"]>50)
print("E2E", "PASS" if ok else "FAIL"); sys.exit(0 if ok else 1)
