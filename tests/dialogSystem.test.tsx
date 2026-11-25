import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import {
  dialogs,
  feedback,
  getActiveDialog,
  getToasts,
  settleDialog
} from '../src/components/ui/dialogController';
import { DialogHost } from '../src/components/ui/DialogHost';
import { useNuqtaStore } from '../src/store/nuqtaStore';

const setLanguage = (language: 'ar' | 'en') =>
  useNuqtaStore.setState((state) => ({ profile: { ...state.profile, language } }));

beforeEach(() => {
  // Drop anything a previous test left queued so each test starts empty.
  let active = getActiveDialog();
  while (active) {
    settleDialog(active.id, undefined);
    active = getActiveDialog();
  }
  feedback.clear();
  setLanguage('en');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('dialogController queue', () => {
  it('resolves confirm(true) when the primary action is pressed', async () => {
    render(<DialogHost />);
    let answer: boolean | undefined;
    act(() => {
      void dialogs.confirm({ title: 'Delete this item?' }).then((value) => {
        answer = value;
      });
    });

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Delete this item?');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(answer).toBe(true));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('resolves confirm(false) when cancelled', async () => {
    render(<DialogHost />);
    let answer: boolean | undefined;
    act(() => {
      void dialogs.confirm({ title: 'Delete this item?' }).then((value) => {
        answer = value;
      });
    });

    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(answer).toBe(false));
  });

  it('treats Escape as cancel', async () => {
    render(<DialogHost />);
    let answer: boolean | undefined;
    act(() => {
      void dialogs.confirm({ title: 'Delete this item?' }).then((value) => {
        answer = value;
      });
    });

    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(answer).toBe(false));
  });

  it('ignores Escape when the dialog is not dismissible', async () => {
    render(<DialogHost />);
    let answer: boolean | undefined;
    act(() => {
      void dialogs.confirm({ title: 'Locked', dismissible: false }).then((value) => {
        answer = value;
      });
    });

    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(answer).toBeUndefined();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('resolves alert with no cancel button', async () => {
    render(<DialogHost />);
    let done = false;
    act(() => {
      void dialogs.alert({ title: 'Something failed' }).then(() => {
        done = true;
      });
    });

    await screen.findByRole('dialog');
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(done).toBe(true));
  });

  it('returns the typed value from prompt, and null when cancelled', async () => {
    render(<DialogHost />);
    let value: string | null | undefined;
    act(() => {
      void dialogs.prompt({ title: 'Rename', initialValue: 'Old' }).then((result) => {
        value = result;
      });
    });

    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'New name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(value).toBe('New name'));

    act(() => {
      void dialogs.prompt({ title: 'Rename again' }).then((result) => {
        value = result;
      });
    });
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(value).toBeNull());
  });

  it('keeps the dialog open and shows the message when prompt validation fails', async () => {
    render(<DialogHost />);
    let settled = false;
    act(() => {
      void dialogs.prompt({
        title: 'Rename',
        initialValue: '   ',
        validate: (v) => (v.trim() ? null : 'A name is required')
      }).then(() => {
        settled = true;
      });
    });

    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('A name is required');
    expect(settled).toBe(false);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('queues dialogs and shows them one at a time', async () => {
    render(<DialogHost />);
    const order: string[] = [];
    act(() => {
      void dialogs.confirm({ title: 'First' }).then(() => order.push('first'));
      void dialogs.confirm({ title: 'Second' }).then(() => order.push('second'));
    });

    await screen.findByRole('dialog');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog').textContent).toContain('First');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.getByRole('dialog').textContent).toContain('Second'));

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(order).toEqual(['first', 'second']));
  });

  it('localizes the default buttons to Arabic', async () => {
    setLanguage('ar');
    render(<DialogHost />);
    act(() => {
      void dialogs.confirm({ title: 'حذف العنصر؟' });
    });

    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: 'إلغاء' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'تأكيد' })).toBeTruthy();
    // The dialog is inside the shell, so it inherits the app's direction.
    act(() => settleDialog(getActiveDialog()!.id, false));
  });

  it('settling an unknown id is a no-op (no double-resolve crashes)', async () => {
    render(<DialogHost />);
    act(() => {
      void dialogs.confirm({ title: 'Once' });
    });
    const id = (await screen.findByRole('dialog')) && getActiveDialog()!.id;
    act(() => {
      settleDialog('not-a-real-id', true);
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    act(() => settleDialog(id, true));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('feedback toasts', () => {
  it('renders a success toast and dismisses it after the duration', async () => {
    vi.useFakeTimers();
    render(<DialogHost />);

    act(() => {
      feedback.success('Saved');
    });
    expect(screen.getByRole('status').textContent).toContain('Saved');

    act(() => {
      vi.advanceTimersByTime(3600);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('uses assertive live regions for errors', async () => {
    render(<DialogHost />);
    act(() => {
      feedback.error('Could not save');
    });
    const alert = await screen.findByRole('alert');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
    expect(alert.textContent).toContain('Could not save');
  });

  it('caps the stack so toasts never cover the interface', () => {
    render(<DialogHost />);
    act(() => {
      feedback.success('one');
      feedback.success('two');
      feedback.success('three');
      feedback.success('four');
    });
    expect(getToasts()).toHaveLength(3);
    expect(getToasts().map((t) => t.message)).toEqual(['two', 'three', 'four']);
  });

  it('can be dismissed manually', async () => {
    render(<DialogHost />);
    act(() => {
      feedback.info('Dismiss me');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });
});

describe('the page cannot scroll behind an open dialog', () => {
  it('locks body scroll while open and restores it on close', async () => {
    render(<DialogHost />);
    expect(document.body.style.overflow).toBe('');

    act(() => {
      void dialogs.confirm({ title: 'Lock the page?' });
    });
    await screen.findByRole('dialog');
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.body.style.overflow).toBe('');
  });
});
