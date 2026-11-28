/**
 * SpringCheck — the completion control, and the spring that drives it.
 *
 * The integrator is tested as pure maths; the component is tested through the DOM,
 * because what matters is the accessible state a screen reader and a keyboard user see,
 * not the internal spring value.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import { SpringCheck } from '../src/components/ui/SpringCheck';
import { springParams, springStep } from '../src/lib/useSpringValue';

/** Let the rAF loop run to completion inside a fake-timer frame budget. */
async function settle(ms = 800) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('springStep', () => {
  it('moves towards the target and never overshoots with a critically damped spring', () => {
    const { omega, zeta } = springParams({ visualDuration: 0.2, bounce: 0 });
    let state = { x: 0, v: 0 };
    for (let i = 0; i < 400; i += 1) {
      state = springStep(state, 1, omega, zeta, 1 / 240);
      expect(state.x).toBeLessThanOrEqual(1.0001);
    }
    expect(state.x).toBeGreaterThan(0.99);
  });

  it('settles at the target and stops moving', () => {
    const { omega, zeta } = springParams({ visualDuration: 0.2, bounce: 0.18 });
    let state = { x: 0, v: 0 };
    for (let i = 0; i < 1200; i += 1) state = springStep(state, 1, omega, zeta, 1 / 240);
    expect(Math.abs(state.x - 1)).toBeLessThan(0.001);
    expect(Math.abs(state.v)).toBeLessThan(0.01);
  });

  it('overshoots slightly when bounce is above zero', () => {
    const { omega, zeta } = springParams({ visualDuration: 0.2, bounce: 0.6 });
    let state = { x: 0, v: 0 };
    let peak = 0;
    for (let i = 0; i < 400; i += 1) {
      state = springStep(state, 1, omega, zeta, 1 / 240);
      peak = Math.max(peak, state.x);
    }
    expect(peak).toBeGreaterThan(1);
  });

  it('derives damping from bounce: zero bounce is critically damped', () => {
    expect(springParams({ visualDuration: 0.2, bounce: 0 }).zeta).toBe(1);
    expect(springParams({ visualDuration: 0.2, bounce: 1 }).zeta).toBeCloseTo(0.05, 5);
  });
});

describe('SpringCheck', () => {
  it('exposes checkbox semantics and reports its state to assistive technology', () => {
    const { rerender } = render(<SpringCheck checked={false} onChange={() => {}} ariaLabel="Complete task" />);
    const control = screen.getByRole('checkbox', { name: 'Complete task' });
    expect(control.getAttribute('aria-checked')).toBe('false');

    rerender(<SpringCheck checked onChange={() => {}} ariaLabel="Complete task" />);
    expect(screen.getByRole('checkbox', { name: 'Complete task' }).getAttribute('aria-checked')).toBe('true');
  });

  it('fires onChange with the inverted value exactly once per click', () => {
    const onChange = vi.fn();
    render(<SpringCheck checked={false} onChange={onChange} ariaLabel="Complete task" />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Complete task' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('asks to uncheck when it is already checked', () => {
    const onChange = vi.fn();
    render(<SpringCheck checked onChange={onChange} ariaLabel="Complete task" />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Complete task' }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('is operable from the keyboard, because it is a real button', () => {
    const onChange = vi.fn();
    render(<SpringCheck checked={false} onChange={onChange} ariaLabel="Complete task" />);
    const control = screen.getByRole('checkbox', { name: 'Complete task' });
    expect(control.tagName).toBe('BUTTON');
    expect(control.getAttribute('type')).toBe('button');
    fireEvent.click(control);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('ignores activation when disabled', () => {
    const onChange = vi.fn();
    render(<SpringCheck checked={false} onChange={onChange} disabled ariaLabel="Complete task" />);
    const control = screen.getByRole('checkbox', { name: 'Complete task' });
    expect((control as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(control);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders a label and strikes it through when checked', async () => {
    const { container } = render(<SpringCheck checked label="Write the report" onChange={() => {}} />);
    expect(screen.getByText('Write the report').textContent).toBe('Write the report');
    await settle();
    const rule = container.querySelector('.spring-check__rule') as HTMLElement;
    // The rule is scaled from 0 to 1 as the spring settles, so a checked control ends
    // with it fully drawn rather than merely present in the DOM.
    expect(rule.style.transform).toMatch(/scaleX\(1\)/);
  });

  it('starts a checked control in its settled state, without animating in from empty', () => {
    const { container } = render(<SpringCheck checked onChange={() => {}} ariaLabel="Complete task" />);
    const fill = container.querySelector('.spring-check__fill') as HTMLElement;
    // A task list that opens on already-completed work must not flash empty for a frame.
    expect(fill.style.transform).toBe('scale(1)');
  });

  it('omits the strike when strike is none', () => {
    const { container } = render(<SpringCheck checked label="Plain" strike="none" onChange={() => {}} />);
    expect(container.querySelector('.spring-check__rule')).toBeNull();
  });

  it('renders icon-only when there is no label', () => {
    const { container } = render(<SpringCheck checked={false} onChange={() => {}} ariaLabel="Complete" />);
    expect(container.querySelector('.spring-check--bare')).not.toBeNull();
    expect(container.querySelector('.spring-check__label')).toBeNull();
  });

  it('reverses cleanly when toggled rapidly', async () => {
    const Harness = () => {
      const [checked, setChecked] = useState(false);
      return <SpringCheck checked={checked} onChange={setChecked} ariaLabel="Complete" />;
    };
    render(<Harness />);
    const control = screen.getByRole('checkbox', { name: 'Complete' });
    fireEvent.click(control);
    fireEvent.click(control);
    fireEvent.click(control);
    await settle();
    // Three clicks from unchecked leaves it checked, and the spring must have caught up
    // rather than being stuck mid-flight or double-applying the state.
    expect(control.getAttribute('aria-checked')).toBe('true');
  });

  it('applies the struck-through state instantly under reduced motion', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false
    })) as any;

    const { container } = render(<SpringCheck checked label="Instant" onChange={() => {}} />);
    await settle(50);
    const fill = container.querySelector('.spring-check__fill') as HTMLElement;
    const rule = container.querySelector('.spring-check__rule') as HTMLElement;
    expect(fill.style.transform).toBe('scale(1)');
    expect(rule.style.transform).toMatch(/scaleX\(1\)/);

    window.matchMedia = original;
  });
});
