/**
 * Public surface of the Stage 2 sync foundation.
 *
 * Importing this module has no side effects: nothing connects until `startSync` is
 * called, so local-first behaviour is unchanged in an unconfigured build.
 */

export * from './protocol';
export * from './deviceIdentity';
export * from './outbox';
export * from './changeCapture';
export * from './applyRemote';
export * from './cursor';
export * from './syncGate';
export * from './client';
export * from './lifecycle';
