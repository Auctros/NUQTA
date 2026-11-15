"""Reproducible UI audit of the production build: every navigable view + responsive layout.

Backs the release-readiness claims with a committed, runnable check instead of a one-off
manual pass. It drives the real sidebar navigation and asserts:

  1. All 15 navigable destinations render real content with zero console/page errors.
  2. No horizontal overflow at 1440 / 1280 / 768 / 390 px.
  3. At 390 px the off-canvas sidebar opens, a destination navigates AND closes it.

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

    # 4. Arabic / RTL pass: locale ar-EG must flip the shell to RTL and every
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
