import React from 'react';
import { MuscleId } from '../../../lib/exerciseTypes';
import { muscleLabel } from '../../../lib/exerciseCatalog';

/**
 * The authentic anatomical écorché reference.
 *
 * The body itself is a rendered photograph of a real, medically-modelled muscular
 * system (Z-Anatomy, CC-BY-SA 4.0 — see ATTRIBUTION below), shipped as two WebP
 * plates (anterior and posterior). Each trained muscle group has a matching
 * silhouette plate; the figure paints those silhouettes over the body in the studio
 * accent, so the highlight sits exactly on the real muscle rather than a schematic.
 *
 * Because every mask is rendered from the same camera as its base plate, the layers
 * line up pixel-for-pixel and can be composited in the browser with CSS masks — no
 * 3D runtime, no network, and it works offline like the rest of the app.
 */

export interface EcorcheFigureProps {
  primary: MuscleId[];
  secondary: MuscleId[];
  isAr: boolean;
  /** Which side to present first. Both sides are always shown. */
  facing?: 'front' | 'back';
  className?: string;
}

/** Muscle ids that have a rendered silhouette plate (see public/anatomy/manifest.json). */
const PLATED: ReadonlySet<string> = new Set<MuscleId>([
  'chest',
  'front_delts',
  'rear_delts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'hip_flexors',
  'quads',
  'calves',
  'traps',
  'upper_back',
  'lats',
  'lower_back',
  'glutes',
  'hamstrings'
]);

/**
 * Which muscles read as superficial from each side. A plate only paints a muscle it can
 * actually see: highlighting the lats on the anterior view (where they sit behind the
 * ribs) would teach the wrong thing, so they are drawn on the back plate only.
 */
const FRONT_VISIBLE: ReadonlySet<string> = new Set<MuscleId>([
  'chest',
  'front_delts',
  'biceps',
  'forearms',
  'abs',
  'obliques',
  'hip_flexors',
  'quads',
  'calves',
  'traps'
]);
const BACK_VISIBLE: ReadonlySet<string> = new Set<MuscleId>([
  'traps',
  'rear_delts',
  'triceps',
  'forearms',
  'lats',
  'upper_back',
  'lower_back',
  'glutes',
  'hamstrings',
  'calves',
  'obliques'
]);

const asset = (path: string): string => `${import.meta.env.BASE_URL}anatomy/${path}`;

const Plate: React.FC<{
  view: 'front' | 'back';
  primary: Set<string>;
  secondary: Set<string>;
  label: string;
}> = ({ view, primary, secondary, label }) => {
  const visible = view === 'front' ? FRONT_VISIBLE : BACK_VISIBLE;
  const layers = (ids: Set<string>, kind: 'primary' | 'secondary') =>
    [...ids]
      .filter((id) => PLATED.has(id) && visible.has(id))
      .map((id) => (
        <span
          key={`${kind}-${id}`}
          className={`ec-muscle ec-muscle-${kind}`}
          style={{
            maskImage: `url(${asset(`masks/${id}_${view}.webp`)})`,
            WebkitMaskImage: `url(${asset(`masks/${id}_${view}.webp`)})`
          }}
        />
      ));
  return (
    <figure className="ec-plate">
      <div className="ec-plate-stack">
        <img className="ec-plate-base" src={asset(`base_${view}.webp`)} alt="" aria-hidden="true" draggable={false} />
        {layers(secondary, 'secondary')}
        {layers(primary, 'primary')}
      </div>
      <figcaption className="ec-plate-caption">{label}</figcaption>
    </figure>
  );
};

export const EcorcheFigure: React.FC<EcorcheFigureProps> = ({ primary, secondary, isAr, facing = 'front', className }) => {
  const primarySet = new Set<string>(primary);
  const secondarySet = new Set<string>(secondary.filter((m) => !primarySet.has(m)));
  const order: ('front' | 'back')[] = facing === 'back' ? ['back', 'front'] : ['front', 'back'];

  const named = [...primarySet, ...secondarySet]
    .filter((m) => PLATED.has(m))
    .map((m) => muscleLabel(m as MuscleId, isAr));

  const caption = isAr
    ? `مرجع تشريحي: العضلات العاملة في هذا التمرين — ${named.join('، ')}`
    : `Anatomical reference: the muscles this exercise works — ${named.join(', ')}`;

  return (
    <div className={`ec-figure ${className || ''}`} role="img" aria-label={caption}>
      <div className="ec-plates">
        {order.map((view) => (
          <Plate
            key={view}
            view={view}
            primary={primarySet}
            secondary={secondarySet}
            label={view === 'front' ? (isAr ? 'أمامي' : 'Front') : isAr ? 'خلفي' : 'Back'}
          />
        ))}
      </div>
      <ul className="ec-legend">
        <li>
          <span className="ec-swatch ec-swatch-primary" aria-hidden="true" />
          {isAr ? 'عضلات أساسية' : 'Primary'}
        </li>
        <li>
          <span className="ec-swatch ec-swatch-secondary" aria-hidden="true" />
          {isAr ? 'عضلات مساعدة' : 'Secondary'}
        </li>
        <li className="ec-credit">
          {isAr ? 'النموذج التشريحي: Z-Anatomy (CC BY-SA 4.0)' : 'Anatomy model: Z-Anatomy (CC BY-SA 4.0)'}
        </li>
      </ul>
    </div>
  );
};
