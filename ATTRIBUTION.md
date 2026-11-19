# Third-party artwork attribution

## Exercise illustrations — Open Exercise Art

The exercise illustrations in `public/exercise-art/` are vendored, unmodified, from
**Open Exercise Art** by Alex Mollard:

- Source: https://github.com/AlexMollard/Open-Exercise-Art
- Artwork licence: **CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/)
- Files used: 69 SVGs, referenced by `src/components/workout/illustration/exerciseArt.ts`
- Integrity: every vendored file was verified against the upstream `catalogue.json`
  SHA-256 digest at vendoring time.

Required credit, shown in the exercise library footer:

> Exercise illustrations: Open Exercise Art / Alex Mollard, CC BY-SA 4.0.

**Why this set.** It is a single authored character drawn across the whole movement
catalogue, so the library reads as one consistent figure rather than 72 unrelated
sketches. Only the artwork (CC BY-SA 4.0) is vendored — not the project's GPL-3.0
code — so the app's own licence is unaffected.

**Modifications.** The SVGs are shipped byte-for-byte. They are not recoloured: each
file paints with `currentColor` and is applied as a CSS mask, with the visible ink
coming from the surrounding theme token. That is a rendering choice in our CSS, not a
change to the artwork. If you redistribute modified artwork, CC BY-SA 4.0 requires
that your version carry the same licence.

## Removed artwork

An earlier revision used illustrations from Gymvisual (Aliaksandr Makatserchyk). Those
are commercial, all-rights-reserved works and were removed because they cannot be
redistributed without a paid licence. The same revision's Z-Anatomy écorché reference
(`public/anatomy/`) was also removed, replaced by the shared illustration set above.
