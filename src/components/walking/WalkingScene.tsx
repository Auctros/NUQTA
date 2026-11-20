import React from 'react';

/**
 * Original walking scene, drawn by hand for NUQTA.
 *
 * Structure is deliberately layered so parallax and the walk cycle are pure CSS:
 *   sky → clouds → ridge → trees → meadow → path → flowers → character → foreground grass.
 * Each depth band is its own <g> and is offset by a CSS custom property, so no animation
 * library is needed.
 *
 * The character is assembled from separately-transformable groups (thigh/shin/foot per leg,
 * upper arm/forearm per arm, torso, head) so each limb rotates around its own joint. Only
 * the parts that must move are grouped; the rest stays flat, which keeps the silhouette
 * readable as an illustration rather than a puppet of rectangles.
 */

interface SceneProps {
  /** True while the walk is running — the CSS animation is applied via this class. */
  walking: boolean;
  className?: string;
  /** Decorative by default; the surrounding section provides the accessible name. */
  ariaHidden?: boolean;
}

const P = {
  sun: 'var(--walk-sun)',
  ridgeFar: 'var(--walk-ridge-far)',
  ridgeNear: 'var(--walk-ridge-near)',
  canopy: 'var(--walk-canopy)',
  canopyDeep: 'var(--walk-canopy-deep)',
  trunk: 'var(--walk-trunk)',
  meadow: 'var(--walk-meadow)',
  meadowDeep: 'var(--walk-meadow-deep)',
  path: 'var(--walk-path)',
  pathEdge: 'var(--walk-path-edge)',
  petal: 'var(--walk-petal)',
  petalAlt: 'var(--walk-petal-alt)',
  stem: 'var(--walk-stem)',
  cloud: 'var(--walk-cloud)',
  bird: 'var(--walk-bird)',
  skin: 'var(--walk-skin)',
  hair: 'var(--walk-hair)',
  shirt: 'var(--walk-shirt)',
  shirtShade: 'var(--walk-shirt-shade)',
  trousers: 'var(--walk-trousers)',
  shoe: 'var(--walk-shoe)',
  scarf: 'var(--walk-scarf)'
};

const FLOWERS = [
  { x: 62, y: 356, s: 1, alt: false, d: '0s' },
  { x: 148, y: 372, s: 0.85, alt: true, d: '-1.1s' },
  { x: 236, y: 352, s: 1.1, alt: false, d: '-2.2s' },
  { x: 604, y: 366, s: 0.95, alt: true, d: '-0.6s' },
  { x: 690, y: 352, s: 1.05, alt: false, d: '-1.7s' },
  { x: 762, y: 372, s: 0.9, alt: true, d: '-2.6s' }
];

export const WalkingScene: React.FC<SceneProps> = ({ walking, className = '', ariaHidden = true }) => (
  <svg
    className={`walk-scene ${walking ? 'is-walking' : 'is-idle'} ${className}`}
    viewBox="0 0 800 420"
    role={ariaHidden ? 'presentation' : 'img'}
    aria-hidden={ariaHidden ? 'true' : undefined}
    preserveAspectRatio="xMidYMax slice"
  >
    <defs>
      <linearGradient id="walk-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--walk-sky-top)" />
        <stop offset="100%" stopColor="var(--walk-sky-bottom)" />
      </linearGradient>
      <linearGradient id="walk-ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={P.meadow} />
        <stop offset="100%" stopColor={P.meadowDeep} />
      </linearGradient>
      <radialGradient id="walk-sun-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={P.sun} stopOpacity="0.5" />
        <stop offset="70%" stopColor={P.sun} stopOpacity="0.12" />
        <stop offset="100%" stopColor={P.sun} stopOpacity="0" />
      </radialGradient>
    </defs>

    <rect x="0" y="0" width="800" height="420" fill="url(#walk-sky)" />
    <circle cx="648" cy="86" r="88" fill="url(#walk-sun-glow)" />
    <circle className="walk-sun" cx="648" cy="86" r="29" fill={P.sun} opacity="0.9" />

    {/* clouds — slowest depth */}
    <g className="walk-band walk-band--clouds">
      <g className="walk-cloud walk-cloud--a">
        <ellipse cx="150" cy="82" rx="52" ry="20" fill={P.cloud} opacity="0.85" />
        <ellipse cx="186" cy="72" rx="34" ry="17" fill={P.cloud} opacity="0.9" />
        <ellipse cx="118" cy="74" rx="26" ry="13" fill={P.cloud} opacity="0.75" />
      </g>
      <g className="walk-cloud walk-cloud--b">
        <ellipse cx="470" cy="54" rx="42" ry="15" fill={P.cloud} opacity="0.7" />
        <ellipse cx="498" cy="46" rx="26" ry="12" fill={P.cloud} opacity="0.75" />
      </g>
    </g>

    {/* distant ridge */}
    <g className="walk-band walk-band--ridge">
      <path
        d="M0 236 L74 200 L132 218 L196 178 L262 212 L330 186 L392 214 L470 180 L540 210 L610 184 L690 214 L760 192 L800 208 L800 262 L0 262 Z"
        fill={P.ridgeFar}
        opacity="0.55"
      />
      <path
        d="M0 258 L64 232 L128 250 L200 224 L272 248 L352 226 L430 250 L512 228 L590 250 L668 230 L744 252 L800 238 L800 286 L0 286 Z"
        fill={P.ridgeNear}
        opacity="0.7"
      />
    </g>

    {/* birds */}
    <g fill="none" stroke={P.bird} strokeWidth="2" strokeLinecap="round" opacity="0.45">
      <path className="walk-bird walk-bird--a" d="M330 96 q8 -7 16 0 q8 -7 16 0" />
      <path className="walk-bird walk-bird--b" d="M392 74 q6 -5 12 0 q6 -5 12 0" />
      <path className="walk-bird walk-bird--c" d="M272 120 q6 -5 12 0 q6 -5 12 0" />
    </g>

    {/* mid-ground trees */}
    <g className="walk-band walk-band--trees">
      <g className="walk-tree walk-tree--left">
        <path d="M96 292 q-4 -34 2 -54" stroke={P.trunk} strokeWidth="7" fill="none" strokeLinecap="round" />
        <ellipse cx="98" cy="212" rx="46" ry="38" fill={P.canopyDeep} />
        <ellipse cx="78" cy="200" rx="30" ry="26" fill={P.canopy} />
        <ellipse cx="118" cy="204" rx="26" ry="22" fill={P.canopy} opacity="0.85" />
        <ellipse cx="98" cy="188" rx="24" ry="20" fill={P.canopy} opacity="0.7" />
      </g>
      <g className="walk-tree walk-tree--right">
        <path d="M706 296 q5 -38 -2 -60" stroke={P.trunk} strokeWidth="8" fill="none" strokeLinecap="round" />
        <ellipse cx="704" cy="204" rx="54" ry="44" fill={P.canopyDeep} />
        <ellipse cx="680" cy="190" rx="34" ry="29" fill={P.canopy} />
        <ellipse cx="730" cy="196" rx="30" ry="25" fill={P.canopy} opacity="0.85" />
        <ellipse cx="706" cy="176" rx="27" ry="22" fill={P.canopy} opacity="0.65" />
      </g>
      <g className="walk-tree walk-tree--far">
        <path d="M232 288 q-3 -26 1 -40" stroke={P.trunk} strokeWidth="5" fill="none" strokeLinecap="round" />
        <ellipse cx="233" cy="232" rx="30" ry="25" fill={P.canopyDeep} opacity="0.75" />
        <ellipse cx="222" cy="224" rx="20" ry="17" fill={P.canopy} opacity="0.6" />
      </g>
    </g>

    {/* meadow + path */}
    <path d="M0 286 Q200 268 400 280 Q600 292 800 274 L800 420 L0 420 Z" fill="url(#walk-ground)" />
    <path d="M-40 420 Q120 352 300 342 Q520 330 840 372 L840 420 Z" fill={P.path} opacity="0.85" />
    <path d="M-40 420 Q120 352 300 342 Q520 330 840 372" fill="none" stroke={P.pathEdge} strokeWidth="3" opacity="0.5" />

    {/* flowers — independent sway */}
    <g>
      {FLOWERS.map((f, i) => (
        <g key={i} className="walk-flower" style={{ ['--flower-delay' as string]: f.d }} transform={`translate(${f.x} ${f.y}) scale(${f.s})`}>
          <path d="M0 0 q2 -12 0 -20" stroke={P.stem} strokeWidth="2" fill="none" strokeLinecap="round" />
          <g transform="translate(0 -22)">
            {[0, 72, 144, 216, 288].map((deg) => (
              <ellipse
                key={deg}
                cx="0"
                cy="-4.6"
                rx="3.1"
                ry="4.9"
                fill={f.alt ? P.petalAlt : P.petal}
                transform={`rotate(${deg})`}
              />
            ))}
            <circle r="2.1" fill={P.petalAlt} />
          </g>
        </g>
      ))}
    </g>

    {/* ---------- the walker ---------- */}
    <g className="walk-character" transform="translate(392 0)">
      <ellipse className="walk-shadow" cx="0" cy="352" rx="30" ry="6.5" fill="var(--walk-shadow)" opacity="0.26" />

      <g className="walk-figure">
        {/* far arm, behind the torso */}
        <g className="walk-arm walk-arm--far">
          <path className="walk-upper-arm" d="M-2 -84 q-9 12 -10 24" stroke={P.shirtShade} strokeWidth="8.5" strokeLinecap="round" fill="none" />
          <g className="walk-forearm-group">
            <path className="walk-forearm" d="M-12 -60 q-4 14 -1 26" stroke={P.skin} strokeWidth="7" strokeLinecap="round" fill="none" />
          </g>
        </g>

        {/* far leg */}
        <g className="walk-leg walk-leg--far">
          <path className="walk-thigh" d="M-1 -56 q-6 16 -3 30" stroke={P.trousers} strokeWidth="11" strokeLinecap="round" fill="none" opacity="0.8" />
          <g className="walk-shin-group">
            <path className="walk-shin" d="M-4 -26 q-2 14 1 25" stroke={P.trousers} strokeWidth="9.5" strokeLinecap="round" fill="none" opacity="0.8" />
            <path className="walk-foot" d="M-3 -2 q7 2 12 -1 q3 3 -2 5 q-8 2 -12 -1 Z" fill={P.shoe} opacity="0.8" />
          </g>
        </g>

        {/* torso */}
        <g className="walk-torso">
          <path d="M-11 -96 q11 -7 22 0 q6 20 3 38 q-14 6 -28 0 q-3 -18 3 -38 Z" fill={P.shirt} />
          <path d="M-9 -95 q9 -4 18 0 q2 8 1 14 q-10 4 -20 0 q-1 -6 1 -14 Z" fill={P.shirtShade} opacity="0.45" />
          <path d="M-3.5 -100 q3.5 -3 7 0 l1 6 q-4.5 3 -9 0 Z" fill={P.skin} />
          <path d="M-8 -92 q8 5 16 0 q1 4 -2 6 q-6 4 -12 0 q-3 -2 -2 -6 Z" fill={P.scarf} opacity="0.9" />
        </g>

        {/* head */}
        <g className="walk-head">
          <circle cx="0" cy="-112" r="12.4" fill={P.skin} />
          <path d="M-12.4 -114 q-1 -13 12.4 -13 q13.4 0 12.4 13 q-4 -7 -12.4 -7 q-8.4 0 -12.4 7 Z" fill={P.hair} />
          <path d="M-11.5 -111 q3 -6 6 -7" stroke={P.hair} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </g>

        {/* near leg */}
        <g className="walk-leg walk-leg--near">
          <path className="walk-thigh" d="M1 -56 q6 16 3 30" stroke={P.trousers} strokeWidth="11.5" strokeLinecap="round" fill="none" />
          <g className="walk-shin-group">
            <path className="walk-shin" d="M4 -26 q2 14 -1 25" stroke={P.trousers} strokeWidth="10" strokeLinecap="round" fill="none" />
            <path className="walk-foot" d="M3 -2 q7 2 12 -1 q3 3 -2 5 q-8 2 -12 -1 Z" fill={P.shoe} />
          </g>
        </g>

        {/* near arm */}
        <g className="walk-arm walk-arm--near">
          <path className="walk-upper-arm" d="M2 -84 q9 12 10 24" stroke={P.shirt} strokeWidth="9" strokeLinecap="round" fill="none" />
          <g className="walk-forearm-group">
            <path className="walk-forearm" d="M12 -60 q4 14 1 26" stroke={P.skin} strokeWidth="7.5" strokeLinecap="round" fill="none" />
          </g>
        </g>
      </g>
    </g>

    {/* foreground grass — fastest depth */}
    <g className="walk-band walk-band--foreground">
      <path
        d="M0 404 q30 -22 46 -4 q22 -18 38 2 q26 -20 44 0 q24 -16 40 4 L168 420 L0 420 Z"
        fill={P.meadowDeep}
        opacity="0.95"
      />
      <path
        d="M640 410 q26 -22 44 -4 q20 -18 38 2 q24 -18 42 0 q18 -12 36 2 L800 420 L640 420 Z"
        fill={P.meadowDeep}
        opacity="0.95"
      />
      <g stroke={P.meadowDeep} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.8">
        <path d="M118 418 q2 -12 6 -17 M124 418 q-1 -11 -4 -15 M130 418 q3 -10 8 -14" />
        <path d="M520 414 q2 -11 6 -16 M526 414 q-1 -10 -4 -14 M532 414 q3 -9 7 -13" />
      </g>
    </g>
  </svg>
);

export default WalkingScene;
