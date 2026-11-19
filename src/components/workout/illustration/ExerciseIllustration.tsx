import React from 'react';
import { getExerciseArt, artUrl } from './exerciseArt';

/**
 * Renders one exercise illustration from the shared Open Exercise Art set.
 *
 * Every exercise draws the same authored character, so the library reads as one
 * consistent figure across all 72 movements instead of 72 unrelated sketches.
 *
 * The vendored SVG is line art filled with `currentColor`, which has no meaning
 * inside an `<img>` (it resolves to black and disappears in the dark theme). So the
 * drawing is used as a CSS mask and the visible ink comes from the element's own
 * background — the studio accent. One file therefore renders correctly in both
 * themes and inside any studio's accent scope, and every figure is tinted
 * identically, which is what keeps the set visually consistent.
 */

export interface ExerciseIllustrationProps {
  illustrationKey?: string;
  isAr: boolean;
  /** Accessible name of the exercise. */
  name: string;
  className?: string;
  /**
   * Renders without an accessible name. Use when a visible caption already names
   * the figure, so assistive tech is not given two identically-named images.
   */
  decorative?: boolean;
}

const Fallback: React.FC<{ name: string; className?: string }> = ({ name, className }) => (
  <span className={`ex-art-fallback ${className || ''}`} role="img" aria-label={name}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M6.5 6.5v11M3.5 9v5M17.5 6.5v11M20.5 9v5M6.5 12h11" strokeLinecap="round" />
    </svg>
  </span>
);

export const ExerciseIllustration: React.FC<ExerciseIllustrationProps> = ({
  illustrationKey,
  isAr,
  name,
  className = '',
  decorative
}) => {
  const art = getExerciseArt(illustrationKey);
  if (!art) return <Fallback name={name} className={className} />;

  const url = `url(${artUrl(art.art)})`;
  return (
    <span
      className={`ex-art ${className}`}
      role={decorative ? 'presentation' : 'img'}
      aria-label={decorative ? undefined : name}
      aria-description={decorative ? undefined : isAr ? art.altAr : art.altEn}
      aria-hidden={decorative || undefined}
      data-art={art.art}
      style={{ maskImage: url, WebkitMaskImage: url }}
    />
  );
};
