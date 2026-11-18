"""Reproducible UI audit of the production build: every navigable view + responsive layout.

Backs the release-readiness claims with a committed, runnable check instead of a one-off
manual pass. It drives the real sidebar navigation and asserts:

  1. All 15 navigable destinations render real content with zero console/page errors.
  2. No horizontal overflow at 1440 / 1280 / 768 / 390 px.
  3. At 390 px the off-canvas sidebar opens, a destination navigates AND closes it.
  4. Opening a modal from the bottom of a long page does not move the page, the overlay
     covers exactly the viewport, and closing restores the scroll position.
  5. In RTL (ar-EG) every destination renders without overflow or console errors.

Usage:
  npm run build && npx vite preview --port 4173 &
  python3 scripts/e2e/views.py
Requires: pip install playwright && playwright install chromium
"""
from playwright.sync_api import sync_playwright
import json
import os
import sys

URL = os.environ.get("OFFLINE_URL", "http://localhost:4173/")

# English aria-labels of the 15 destinations reachable from the sidebar.
VIEWS = [
    "Overview", "Tasks", "Habits", "Goals", "Focus", "Calendar",
    "Quran Studio", "Reading Vault", "Home Workout", "Art Studio",
    "Archive & History", "Money", "Health", "Journal", "Insights",
]
WIDTHS = [1440, 1280, 768, 390]

result = {}
failures = []


def has_overflow(page):
    return page.evaluate(
        "document.documentElement.scrollWidth - document.documentElement.clientWidth"
    )


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(timezone_id="Africa/Cairo", locale="en-US")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append("PAGEERROR " + str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(URL, wait_until="networkidle")
    page.wait_for_timeout(600)

    # 1. Every view renders real content with no console errors.
    views = {}
    for label in VIEWS:
        errors.clear()
        btn = page.locator(f'button[data-sidebar-nav="true"][aria-label="{label}"]').first
        if btn.count() == 0:
            views[label] = {"found": False}
            failures.append(f'no sidebar button for view "{label}"')
            continue
        btn.click()
        page.wait_for_timeout(350)
        main_len = page.evaluate(
            "document.querySelector('main') ? document.querySelector('main').innerText.trim().length : -1"
        )
        views[label] = {"main_text_len": main_len, "console_errors": list(errors)}
        if main_len <= 40:
            failures.append(f'view "{label}" rendered little/no content (main_text_len={main_len})')
        if errors:
            failures.append(f'view "{label}" produced console errors: {errors[:2]}')
    result["views"] = views

    # 1b. The window scrollbar must never reflow the layout. The app scrolls on
    #     <html>, so a per-page scrollbar used to change the content width and make
    #     navigation feel like switching apps. Width must stay identical across views.
    page.set_viewport_size({"width": 1280, "height": 900})
    page.wait_for_timeout(300)
    widths = {}
    for label in VIEWS:
        btn = page.locator(f'button[data-sidebar-nav="true"][aria-label="{label}"]').first
        if btn.count() == 0:
            continue
        btn.click()
        page.wait_for_timeout(300)
        widths[label] = page.evaluate(
            "Math.round(document.querySelector('.page-content').getBoundingClientRect().width)"
        )
    result["content_widths"] = widths
    distinct = sorted(set(widths.values()))
    if len(distinct) > 1:
        failures.append(f"content width shifts between views (scrollbar reflow): {widths}")

    # 2. Responsive: no horizontal overflow at any width.
    responsive = {}
    for w in WIDTHS:
        page.set_viewport_size({"width": w, "height": 900})
        page.wait_for_timeout(300)
        overflow = has_overflow(page)
        responsive[str(w)] = {"overflow_px": overflow}
        if overflow > 2:
            failures.append(f"horizontal overflow of {overflow}px at {w}px width")
    result["responsive"] = responsive

    # 3. Mobile navigation at 390 px: open -> navigate -> closes.
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(300)
    sidebar = page.locator("aside.sidebar")
    toggle = page.get_by_role("button", name="Toggle sidebar").first
    mobile = {"sidebar_open_before": "open" in (sidebar.get_attribute("class") or "")}
    toggle.click()
    page.wait_for_timeout(350)
    mobile["sidebar_open_after_toggle"] = "open" in (sidebar.get_attribute("class") or "")
    page.locator('button[data-sidebar-nav="true"][aria-label="Tasks"]').first.click()
    page.wait_for_timeout(400)
    mobile["sidebar_open_after_nav"] = "open" in (sidebar.get_attribute("class") or "")
    mobile["tasks_active"] = page.evaluate(
        "!!document.querySelector('main') && document.querySelector('main').innerText.length > 40"
    )
    mobile["overflow_px"] = has_overflow(page)
    if not mobile["sidebar_open_after_toggle"]:
        failures.append("mobile sidebar did not open when the toggle was tapped")
    if mobile["sidebar_open_after_nav"]:
        failures.append("mobile sidebar did not close after navigating")
    if not mobile["tasks_active"]:
        failures.append("mobile navigation did not reach the Tasks view")
    if mobile["overflow_px"] > 2:
        failures.append(f"horizontal overflow of {mobile['overflow_px']}px at 390px after navigation")
    result["mobile"] = mobile

    # 4. Opening a modal must not move the page. The legacy `.modal-backdrop` and the
    #    kit `Modal` are `position: fixed` inside `.page-content`; if that element is a
    #    containing block (a lingering `transform` from its entry animation) the overlay
    #    sizes to the whole tall page and the browser scrolls to the misplaced dialog.
    #    Open a modal from the bottom of a long page and assert scroll is unchanged and
    #    the backdrop covers exactly the viewport.
    page.set_viewport_size({"width": 1280, "height": 900})
    page.wait_for_timeout(300)
    seed = (
        "()=>{const mk=i=>({id:'t'+i,title:'Task '+i,notes:'',priority:(i%4)+1,isTopThree:false,"
        "status:'todo',scheduledDate:new Date().toISOString().slice(0,10),scheduledTime:'',"
        "estimatedMinutes:30,tags:['x'],energyLevelRequired:'medium',subtasks:[],"
        "createdAt:new Date().toISOString()});"
        "localStorage.setItem('nuqta_tasks_v1',JSON.stringify(Array.from({length:40},(_,i)=>mk(i))));}"
    )
    page.evaluate(seed)
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(600)
    page.locator('button[data-sidebar-nav="true"][aria-label="Tasks"]').first.click()
    page.wait_for_timeout(500)
    page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
    page.wait_for_timeout(400)
    scroll_before = page.evaluate("()=>window.scrollY")
    # Open via a JS click so the harness itself does not scroll the button into view.
    page.evaluate(
        "()=>{const b=[...document.querySelectorAll('button')]"
        ".find(x=>/New Task/.test(x.textContent||'')); if(b) b.click();}"
    )
    page.wait_for_timeout(600)
    modal = page.evaluate(
        "()=>{const bd=document.querySelector('.modal-backdrop');"
        "if(!bd) return {none:true}; const r=bd.getBoundingClientRect();"
        "const md=bd.querySelector('.modal'); const mr=md.getBoundingClientRect();"
        "return {scrollY:window.scrollY, bdY:Math.round(r.y), bdH:Math.round(r.height),"
        "top:Math.round(mr.y), bot:Math.round(mr.bottom), vh:window.innerHeight};}"
    )
    result["modal_scroll"] = {"scroll_before": scroll_before, **modal}
    if modal.get("none"):
        failures.append("opening the task modal did not render a backdrop")
    else:
        if modal["scrollY"] != scroll_before:
            failures.append(
                f"opening a modal moved the page (scrollY {scroll_before} -> {modal['scrollY']})"
            )
        if modal["bdY"] != 0 or modal["bdH"] != modal["vh"]:
            failures.append(
                f"modal backdrop is not viewport-sized (y={modal['bdY']}, h={modal['bdH']}, vh={modal['vh']})"
            )
        if modal["top"] < 0 or modal["bot"] > modal["vh"]:
            failures.append(
                f"modal panel opens outside the viewport (top={modal['top']}, bottom={modal['bot']}, vh={modal['vh']})"
            )
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)
    scroll_after = page.evaluate("()=>window.scrollY")
    result["modal_scroll"]["scroll_after_close"] = scroll_after
    if scroll_after != scroll_before:
        failures.append(
            f"closing a modal did not restore the scroll position ({scroll_before} -> {scroll_after})"
        )

    # 5. Arabic / RTL pass: locale ar-EG must flip the shell to RTL and every
    #    destination must still render without overflow or console errors.
    rtl_ctx = browser.new_context(timezone_id="Africa/Cairo", locale="ar-EG")
    rtl_page = rtl_ctx.new_page()
    rtl_errors = []
    rtl_page.on("pageerror", lambda e: rtl_errors.append("PAGEERROR " + str(e)))
    rtl_page.on("console", lambda m: rtl_errors.append(m.text) if m.type == "error" else None)
    rtl_page.set_viewport_size({"width": 1280, "height": 900})
    rtl_page.goto(URL, wait_until="networkidle")
    rtl_page.wait_for_timeout(600)
    rtl = {
        "dir": rtl_page.evaluate(
            "document.querySelector('.app-shell') ? document.querySelector('.app-shell').getAttribute('dir') : null"
        ),
        "nav_count": rtl_page.locator('button[data-sidebar-nav="true"]').count(),
        "overflows": [],
        "empty_views": []
    }
    if rtl["dir"] != "rtl":
        failures.append(f'RTL shell not applied for ar-EG (app-shell dir={rtl["dir"]!r})')
    for i in range(rtl["nav_count"]):
        rtl_page.locator('button[data-sidebar-nav="true"]').nth(i).click()
        rtl_page.wait_for_timeout(200)
        label = rtl_page.locator('button[data-sidebar-nav="true"]').nth(i).get_attribute("aria-label")
        overflow = rtl_page.evaluate(
            "document.documentElement.scrollWidth - document.documentElement.clientWidth"
        )
        text_len = rtl_page.evaluate("document.querySelector('main').innerText.trim().length")
        if overflow > 2:
            rtl["overflows"].append({"view": label, "px": overflow})
            failures.append(f'RTL overflow of {overflow}px in "{label}"')
        if text_len < 40:
            rtl["empty_views"].append(label)
            failures.append(f'RTL view "{label}" rendered little/no content')
    rtl["errors"] = rtl_errors[:5]
    if rtl_errors:
        failures.append(f"RTL console/page errors: {rtl_errors[:3]}")
    rtl_ctx.close()
    result["rtl"] = rtl

    result["errors"] = errors
    browser.close()

result["failures"] = failures
print(json.dumps(result, indent=1))
ok = not failures
print("VIEWS", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
