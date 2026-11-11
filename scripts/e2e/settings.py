"""Browser test of Settings: bad backup rejected (nothing written), valid backup restored,
wipe clears localStorage AND IndexedDB. Same usage/requirements as smoke.py."""
from playwright.sync_api import sync_playwright
import json, sys
URL="http://localhost:4173/"
out={}
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(timezone_id="Africa/Cairo", locale="en-US", accept_downloads=True)
    page=ctx.new_page(); errs=[]
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("dialog", lambda d: d.accept())
    page.goto(URL, wait_until="networkidle"); page.wait_for_timeout(500)
    page.get_by_text("Settings", exact=False).first.click(); page.wait_for_timeout(500)
    out["file_input"]=page.locator("input[type=file]").count()
    # 1) bad file is rejected, nothing written
    page.locator("input[type=file]").first.set_input_files({"name":"bad.json","mimeType":"application/json","buffer":b'{"tasks":{}}'})
    page.wait_for_timeout(500)
    out["after_bad_import_keys"]=page.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('nuqta_'))")
    out["status_text_has_msg"]=("not" in page.inner_text("body").lower()) or ("لم" in page.inner_text("body"))
    # 2) valid legacy-free v2 file restores
    good=json.dumps({"app":"nuqta","version":2,"exportedAt":"x","data":{"tasks":[{"id":"t1","title":"Imported task","status":"todo","priority":"P2"}],"habits":[],"goals":[]}}).encode()
    with page.expect_navigation(timeout=8000):
        page.locator("input[type=file]").first.set_input_files({"name":"good.json","mimeType":"application/json","buffer":good})
    page.wait_for_timeout(800)
    out["tasks_after_restore"]=page.evaluate("JSON.parse(localStorage.getItem('nuqta_tasks_v1')||'[]').map(t=>t.id)")
    # 3) wipe clears localStorage AND IndexedDB
    page.get_by_text("Settings", exact=False).first.click(); page.wait_for_timeout(400)
    wipe=page.get_by_role("button").filter(has_text="Delete").or_(page.get_by_role("button").filter(has_text="Wipe")).or_(page.get_by_role("button").filter(has_text="مسح"))
    out["wipe_buttons"]=wipe.count()
    if wipe.count():
        with page.expect_navigation(timeout=8000): wipe.first.click()
        page.wait_for_timeout(800)
        out["ls_after_wipe"]=page.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('nuqta_'))")
        out["idb_rows_after_wipe"]=page.evaluate("""new Promise(res=>{const r=indexedDB.open('nuqta_local_db');r.onsuccess=()=>{const db=r.result;let n=0;const names=[...db.objectStoreNames];if(!names.length)return res(0);let left=names.length;names.forEach(s=>{const c=db.transaction(s).objectStore(s).count();c.onsuccess=()=>{n+=c.result;if(--left===0)res(n)}})};r.onerror=()=>res('err')})""")
    out["page_errors"]=errs
    b.close()
print(json.dumps(out,indent=1))
ok=(out["after_bad_import_keys"]==[] and out["tasks_after_restore"]==["t1"] and out.get("ls_after_wipe")==[] and out.get("idb_rows_after_wipe")==0 and not errs)
print("E2E2","PASS" if ok else "FAIL"); sys.exit(0 if ok else 1)
