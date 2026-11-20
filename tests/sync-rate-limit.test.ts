// @vitest-environment node
/**
 * Auth failure limiter tests.
 *
 * The limiter exists so a caller that can reach the loopback port cannot brute-force
 * forever. The properties that matter are that it throttles failures, never throttles
 * a success, forgets old failures, and cannot grow without bound.
 */

import { describe, it, expect } from 'vitest';
import { createAuthFailureLimiter, rateLimitKey } from '../scripts/sync/rateLimit.mjs';

describe('auth failure limiter', () => {
  it('does not limit before the failure budget is spent', () => {
    const limiter = createAuthFailureLimiter({ maxFailures: 3 });
    limiter.recordFailure('a');
    limiter.recordFailure('a');
    expect(limiter.isLimited('a')).toBe(false);
    limiter.recordFailure('a');
    expect(limiter.isLimited('a')).toBe(true);
  });

  it('never limits a caller whose last attempt succeeded', () => {
    const limiter = createAuthFailureLimiter({ maxFailures: 2 });
    limiter.recordFailure('a');
    limiter.recordFailure('a');
    expect(limiter.isLimited('a')).toBe(true);

    // A successful authentication proves the caller is legitimate, so the budget is
    // cleared — otherwise a shared proxy address could lock out its own users.
    limiter.recordSuccess('a');
    expect(limiter.isLimited('a')).toBe(false);
  });

  it('keeps buckets independent per caller', () => {
    const limiter = createAuthFailureLimiter({ maxFailures: 1 });
    limiter.recordFailure('a');
    expect(limiter.isLimited('a')).toBe(true);
    expect(limiter.isLimited('b')).toBe(false);
  });

  it('forgets failures once the window has passed', () => {
    let currentTime = 1_000;
    const limiter = createAuthFailureLimiter({
      maxFailures: 1,
      windowMs: 500,
      now: () => currentTime
    });

    limiter.recordFailure('a');
    expect(limiter.isLimited('a')).toBe(true);

    currentTime += 501;
    expect(limiter.isLimited('a')).toBe(false);
  });

  it('bounds the number of tracked buckets', () => {
    const limiter = createAuthFailureLimiter({ maxKeys: 5, maxFailures: 1 });
    for (let i = 0; i < 50; i += 1) {
      limiter.recordFailure(`caller-${i}`);
    }
    expect(limiter.size()).toBeLessThanOrEqual(5);
  });

  it('keys on the socket address, not a spoofable forwarded header', () => {
    expect(rateLimitKey({ socket: { remoteAddress: '127.0.0.1' } })).toBe('127.0.0.1');
    expect(
      rateLimitKey({
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'x-forwarded-for': '1.2.3.4' }
      })
    ).toBe('127.0.0.1');
    expect(rateLimitKey({})).toBe('unknown');
  });
});
