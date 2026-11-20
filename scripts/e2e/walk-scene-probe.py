"""Measure the Walking Studio scene geometry in a real browser.

Reports, in SVG viewBox units:
  - the walker's visible bounding box vs. the visible viewport
  - where the feet are relative to the ground baseline
  - the shadow position vs. the feet
  - how far each depth band travels (parallax)

Usage: python3 scripts/e2e/walk-scene-probe.py [url]
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

URL = os.environ.get("WALK_URL", sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173/")

PROBE = r"""
() => {
  const svg = document.querySelector('.walk-scene');
  if (!svg) return { error: 'no .walk-scene' };

  const vb = svg.viewBox.baseVal;
  const stage = svg.closest('.walk-stage') || svg;
  const svgRect = svg.getBoundingClientRect();

  // Map a client rect into viewBox units.
  const sx = vb.width / svgRect.width;
  const sy = vb.height / svgRect.height;
  const toVb = (r) => ({
    left: (r.left - svgRect.left) * sx,
    top: (r.top - svgRect.top) * sy,
    right: (r.right - svgRect.left) * sx,
    bottom: (r.bottom - svgRect.top) * sy,
    w: r.width * sx,
    h: r.height * sy,
  });

  const out = { viewBox: { w: vb.width, h: vb.height }, stage: {}, parts: {} };

  out.stage = toVb(stage.getBoundingClientRect());

  const grab = (sel, key) => {
    const el = svg.querySelector(sel);
    if (!el) { out.parts[key] = null; return; }
    const r = el.getBoundingClientRect();
    out.parts[key] = (r.width || r.height) ? toVb(r) : { empty: true };
  };

  grab('.walk-character', 'character');
  grab('.walk-figure', 'figure');
  grab('.walk-head', 'head');
  grab('.walk-shadow', 'shadow');
  grab('.walk-leg--near .walk-foot', 'footNear');
  grab('.walk-leg--far .walk-foot', 'footFar');
  grab('.walk-leg--near .walk-shin', 'shinNear');
  grab('.walk-arm--near', 'armNear');
  grab('.walk-torso', 'torso');

  // Every visible painted element in the character subtree.
  let union = null;
  svg.querySelectorAll('.walk-character *').forEach((el) => {
    if (el.classList.contains('walk-shadow')) return;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return;
    const v = toVb(r);
    union = union
      ? { left: Math.min(union.left, v.left), top: Math.min(union.top, v.top),
          right: Math.max(union.right, v.right), bottom: Math.max(union.bottom, v.bottom) }
      : { left: v.left, top: v.top, right: v.right, bottom: v.bottom };
  });
  if (union) { union.w = union.right - union.left; union.h = union.bottom - union.top; }
  out.parts.paintedUnion = union;

  // Band travel: sample the transform matrix of each band now.
  out.bands = {};
  svg.querySelectorAll('.walk-band').forEach((b) => {
    const cls = [...b.classList].find((c) => c.startsWith('walk-band--')) || 'band';
    const m = new DOMMatrixReadOnly(getComputedStyle(b).transform === 'none' ? '' : getComputedStyle(b).transform);
    out.bands[cls] = { tx: +m.e.toFixed(2), ty: +m.f.toFixed(2) };
  });

  const cls = svg.getAttribute('class') || '';
  out.state = cls.includes('is-walking') ? 'walking' : 'idle';
  out.overflow = getComputedStyle(svg).overflow;
  out.preserveAspectRatio = svg.getAttribute('preserveAspectRatio');

  return out;
}
"""


def fmt(v):
    if v is None:
        return "null"
    if "empty" in v:
        return "(empty)"
    return (
        f"L={v['left']:7.1f} T={v['top']:7.1f} R={v['right']:7.1f} B={v['bottom']:7.1f} "
        f"w={v['w']:6.1f} h={v['h']:6.1f}"
    )


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        page.goto(URL, wait_until="networkidle")

        # Navigate to the studio (fresh profile lands on Overview).
        nav = page.get_by_role("button", name="Walking Studio")
        if nav.count():
            nav.first.click()
            page.wait_for_timeout(700)

        # Enable the studio if the empty state is showing.
        btn = page.get_by_role("button", name="Enable Walking Studio")
        if btn.count() and btn.first.is_visible():
            btn.first.click()
            page.wait_for_timeout(600)

        page.wait_for_selector(".walk-scene", timeout=15000)
        page.wait_for_timeout(400)

        idle = page.evaluate(PROBE)
        print("=" * 78)
        print("IDLE STATE")
        print("=" * 78)
        print(json.dumps(idle, indent=2))

        # Start walking and sample twice to prove the bands actually travel.
        start = page.get_by_role("button", name="Start walking")
        if start.count():
            start.first.click()
            page.wait_for_timeout(1200)
            a = page.evaluate(PROBE)
            page.wait_for_timeout(2500)
            b = page.evaluate(PROBE)

            print()
            print("=" * 78)
            print("WALKING STATE — band travel between two samples ~2.5s apart")
            print("=" * 78)
            for k in sorted(set(a["bands"]) | set(b["bands"])):
                ta = a["bands"].get(k, {}).get("tx")
                tb = b["bands"].get(k, {}).get("tx")
                d = (tb - ta) if (ta is not None and tb is not None) else None
                print(f"  {k:26s} tx {ta!s:>8} -> {tb!s:>8}   delta={d}")

            print()
            print("WALKING GEOMETRY")
            print("-" * 78)
            print(f"  viewBox           : {b['viewBox']}")
            print(f"  stage (viewBox)   : {fmt(b['stage'])}")
            for key in ("character", "figure", "paintedUnion", "head", "torso",
                        "armNear", "shinNear", "footNear", "footFar", "shadow"):
                print(f"  {key:17s} : {fmt(b['parts'].get(key))}")
            print(f"  overflow          : {b['overflow']}   preserveAspectRatio={b['preserveAspectRatio']}")

            # Verdicts
            u = b["parts"].get("paintedUnion")
            st = b["stage"]
            print()
            print("CHECKS")
            print("-" * 78)
            if u and st:
                inside_top = u["top"] >= -0.5
                inside_bottom = u["bottom"] <= st["bottom"] + 0.5
                inside_left = u["left"] >= -0.5
                inside_right = u["right"] <= st["right"] + 0.5
                print(f"  body fully inside frame : top={inside_top} bottom={inside_bottom} "
                      f"left={inside_left} right={inside_right}")
                print(f"  painted union height    : {u['h']:.1f} vb units")
                print(f"  union top vs stage top  : {u['top']:.1f} (negative = cut off above)")

            print(f"  console errors          : {len(errors)}")
            for e in errors[:5]:
                print(f"    - {e}")

        browser.close()


if __name__ == "__main__":
    main()
