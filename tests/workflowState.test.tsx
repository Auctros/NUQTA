import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import {
  clearWorkflowScope,
  isString,
  oneOf,
  readWorkflowValue,
  usePersistedWorkflowState,
  writeWorkflowValue
} from '../src/lib/usePersistedWorkflowState';

/**
 * Filters and search boxes are a working position, not a destination. They must
 * survive a reload without polluting history or the user's dataset.
 */

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('readWorkflowValue', () => {
  it('returns the stored value when it validates', () => {
    writeWorkflowValue('tasks', 'status', 'open');
    expect(readWorkflowValue('tasks', 'status', 'all', isString)).toBe('open');
  });

  it('falls back when the stored value fails validation', () => {
    writeWorkflowValue('tasks', 'status', 'a-filter-that-was-removed');
    const valid = oneOf(['all', 'open', 'done'] as const);
    expect(readWorkflowValue('tasks', 'status', 'all', valid)).toBe('all');
  });

  it('falls back when nothing is stored', () => {
    expect(readWorkflowValue('tasks', 'query', '', isString)).toBe('');
  });

  it('survives a corrupt entry', () => {
    localStorage.setItem('nuqta.ui.workflow.tasks', '{{{not json');
    expect(readWorkflowValue('tasks', 'query', 'default', isString)).toBe('default');
  });

  it('survives an array where an object was expected', () => {
    localStorage.setItem('nuqta.ui.workflow.tasks', '[1,2,3]');
    expect(readWorkflowValue('tasks', 'query', 'default', isString)).toBe('default');
  });

  it('keeps scopes independent', () => {
    writeWorkflowValue('tasks', 'query', 'report');
    writeWorkflowValue('goals', 'query', 'fitness');
    expect(readWorkflowValue('tasks', 'query', '', isString)).toBe('report');
    expect(readWorkflowValue('goals', 'query', '', isString)).toBe('fitness');
  });

  it('does not disturb other keys in the same scope', () => {
    writeWorkflowValue('tasks', 'query', 'a');
    writeWorkflowValue('tasks', 'status', 'open');
    writeWorkflowValue('tasks', 'query', 'b');
    expect(readWorkflowValue('tasks', 'status', 'all', isString)).toBe('open');
  });
});

describe('clearWorkflowScope', () => {
  it('removes the whole scope and leaves others alone', () => {
    writeWorkflowValue('tasks', 'query', 'x');
    writeWorkflowValue('goals', 'query', 'y');
    clearWorkflowScope('tasks');
    expect(readWorkflowValue('tasks', 'query', '', isString)).toBe('');
    expect(readWorkflowValue('goals', 'query', '', isString)).toBe('y');
  });
});

describe('namespace hygiene', () => {
  it('never writes a nuqta_ key', () => {
    writeWorkflowValue('tasks', 'query', 'x');
    // A `nuqta_` prefix would make the storage engine treat a filter as user data.
    expect(Object.keys(localStorage).filter((k) => k.startsWith('nuqta_'))).toEqual([]);
    expect(localStorage.getItem('nuqta.ui.workflow.tasks')).toBeTruthy();
  });
});

describe('usePersistedWorkflowState', () => {
  function Search({ scope = 'tasks' }: { scope?: string }) {
    const [query, setQuery] = usePersistedWorkflowState(scope, 'query', '', isString, { debounceMs: 50 });
    return (
      <input
        aria-label="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    );
  }

  it('hydrates from storage on first render', () => {
    writeWorkflowValue('tasks', 'query', 'carry-over');
    render(<Search />);
    expect((screen.getByLabelText('search') as HTMLInputElement).value).toBe('carry-over');
  });

  it('starts empty when nothing is stored', () => {
    render(<Search />);
    expect((screen.getByLabelText('search') as HTMLInputElement).value).toBe('');
  });

  it('writes the value back after the debounce', () => {
    vi.useFakeTimers();
    render(<Search />);
    fireEvent.change(screen.getByLabelText('search'), { target: { value: 'invoice' } });

    // Still pending: a keystroke must not hit storage immediately.
    expect(readWorkflowValue('tasks', 'query', '', isString)).toBe('');
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(readWorkflowValue('tasks', 'query', '', isString)).toBe('invoice');
  });

  it('flushes the last edit when the view unmounts', () => {
    vi.useFakeTimers();
    const { unmount } = render(<Search />);
    fireEvent.change(screen.getByLabelText('search'), { target: { value: 'half-typed' } });
    unmount();
    expect(readWorkflowValue('tasks', 'query', '', isString)).toBe('half-typed');
  });

  it('restores the value after a remount, like a reload', () => {
    vi.useFakeTimers();
    const first = render(<Search />);
    fireEvent.change(screen.getByLabelText('search'), { target: { value: 'kept' } });
    first.unmount();

    render(<Search />);
    expect((screen.getByLabelText('search') as HTMLInputElement).value).toBe('kept');
  });

  it('does not leak between scopes', () => {
    writeWorkflowValue('goals', 'query', 'goal-text');
    render(<Search scope="tasks" />);
    expect((screen.getByLabelText('search') as HTMLInputElement).value).toBe('');
  });
});
