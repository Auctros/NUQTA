import React from 'react';

/**
 * AmbientBackdrop — Low-overhead layered organic light fields.
 * Uses compositor-only transform/opacity animations over multi-stop radial
 * gradients (no continuous filter/blur repaints) so translucent glass chrome
 * and panels naturally pick up subtle teal, green, indigo, violet, magenta,
 * and restrained warm tones.
 */
export const AmbientBackdrop: React.FC = () => {
  return (
    <div className="ambient-canvas" aria-hidden="true">
      <div className="ambient-pool ambient-pool-teal" />
      <div className="ambient-pool ambient-pool-emerald" />
      <div className="ambient-pool ambient-pool-blue" />
      <div className="ambient-pool ambient-pool-indigo" />
      <div className="ambient-pool ambient-pool-violet" />
      <div className="ambient-pool ambient-pool-magenta" />
      <div className="ambient-pool ambient-pool-warm" />
    </div>
  );
};
