import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EcorcheFigure } from '../src/components/workout/illustration/EcorcheFigure';
import { MUSCLE_IDS } from '../src/components/workout/MuscleMap';
import { EXERCISE_CATALOG } from '../src/lib/exerciseCatalog';

/**
 * The anatomical écorché reference composites a photographic base plate with per-muscle
 * silhouette plates. These tests pin the contract the CSS depends on: every muscle the
 * catalogue can name has a rendered plate, and the component only emits a mask layer for
 * a muscle that actually has art (an unbacked mask would paint an empty, invisible layer).
 */

const manifest = JSON.parse(readFileSync(join(process.cwd(), 'public/anatomy/manifest.json'), 'utf8')) as {
  width: number;
  height: number;
  base: string[];
  masks: Record<string, string[]>;
};

const plated = (id: string) => Object.prototype.hasOwnProperty.call(manifest.masks, id);

describe('anatomical écorché assets', () => {
  it('ships a front and back base plate', () => {
    expect(manifest.base).toEqual(expect.arrayContaining(['front', 'back']));
    expect(manifest.width).toBeGreaterThan(0);
    expect(manifest.height).toBeGreaterThan(0);
  });

  it('has a silhouette plate for every muscle id the app can highlight', () => {
    const missing = MUSCLE_IDS.filter((id) => !plated(id));
    expect(missing).toEqual([]);
  });

  it('every catalogue exercise names at least one muscle that has a rendered plate', () => {
    const unbacked = EXERCISE_CATALOG.filter((e) => !e.primary.some((m) => plated(m))).map((e) => e.nameEn);
    expect(unbacked).toEqual([]);
  });
});

describe('EcorcheFigure', () => {
  it('renders both body plates and paints each trained muscle on the side it is visible', () => {
    const { container } = render(<EcorcheFigure primary={['chest']} secondary={['triceps']} isAr={false} />);
    expect(container.querySelectorAll('.ec-plate-base').length).toBe(2);
    // chest is superficial anteriorly, triceps posteriorly — one layer each, not two.
    expect(container.querySelectorAll('.ec-muscle-primary').length).toBe(1);
    expect(container.querySelectorAll('.ec-muscle-secondary').length).toBe(1);
  });

  it('points each mask layer at its own plate (per view, per muscle)', () => {
    const { container } = render(<EcorcheFigure primary={['lats', 'quads']} secondary={[]} isAr={false} />);
    const masks = [...container.querySelectorAll<HTMLElement>('.ec-muscle-primary')].map((el) =>
      el.style.getPropertyValue('mask-image') || el.style.getPropertyValue('-webkit-mask-image')
    );
    expect(masks.some((m) => m.includes('lats_back.webp'))).toBe(true);
    expect(masks.some((m) => m.includes('quads_front.webp'))).toBe(true);
  });

  it('never paints a muscle on a side where it is not superficial', () => {
    // The lats sit behind the ribs; drawing them on the anterior view would mislead.
    const { container } = render(<EcorcheFigure primary={['lats']} secondary={[]} isAr={false} />);
    const all = [...container.querySelectorAll<HTMLElement>('.ec-muscle')].map((el) =>
      el.style.getPropertyValue('mask-image') || el.style.getPropertyValue('-webkit-mask-image')
    );
    expect(all.some((m) => m.includes('lats_back.webp'))).toBe(true);
    expect(all.some((m) => m.includes('lats_front.webp'))).toBe(false);
  });

  it('shows a caption naming the muscles and credits the model in both languages', () => {
    render(<EcorcheFigure primary={['chest', 'front_delts']} secondary={['triceps']} isAr={false} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Chest');
    expect(screen.getByText(/Z-Anatomy/)).toBeTruthy();
  });

  it('does not render a layer for a muscle with no art', () => {
    // 'not_a_muscle' has no plate; it must be dropped rather than emitted as an empty mask.
    const { container } = render(
      <EcorcheFigure primary={['chest', 'not_a_muscle' as never]} secondary={[]} isAr={false} />
    );
    expect(container.querySelectorAll('.ec-muscle-primary').length).toBe(1); // chest (anterior) only
  });

  it('orders the presented side first when facing is set', () => {
    const { container } = render(<EcorcheFigure primary={['lats']} secondary={[]} isAr={false} facing="back" />);
    const firstCaption = container.querySelector('.ec-plate-caption')?.textContent;
    expect(firstCaption).toBe('Back');
  });
});
