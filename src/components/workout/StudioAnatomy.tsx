import React from 'react';
import { MuscleId } from '../../lib/exerciseTypes';
import { EcorcheFigure } from './illustration/EcorcheFigure';

/**
 * The anatomical écorché presented as the opening panel of the Workout Studio.
 *
 * It reuses the same reference as the exercise detail sheet (photographic plates +
 * per-muscle CSS masks), but shown first so the trained musculature is visible the
 * moment the studio opens rather than buried inside a per-exercise sheet.
 */

/** Shown before any routine exists so the reference is never an empty body. */
export const DEFAULT_FULL_BODY: { primary: MuscleId[]; secondary: MuscleId[] } = {
  primary: ['chest', 'lats', 'quads', 'glutes', 'abs'],
  secondary: ['front_delts', 'triceps', 'biceps', 'hamstrings', 'calves']
};

export interface StudioAnatomyProps {
  primary: MuscleId[];
  secondary: MuscleId[];
  isAr: boolean;
  facing?: 'front' | 'back';
}

export const StudioAnatomy: React.FC<StudioAnatomyProps> = ({ primary, secondary, isAr, facing = 'front' }) => (
  <div className="studio-anatomy">
    <EcorcheFigure primary={primary} secondary={secondary} isAr={isAr} facing={facing} />
  </div>
);
