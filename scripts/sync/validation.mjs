import { DEFAULT_MAX_BATCH_SIZE, DEFAULT_MAX_PAYLOAD_SIZE } from './config.mjs';

export const ALLOWED_STORES = new Set([
  'tasks',
  'habits',
  'goals',
  'focus_sessions',
  'health_metrics',
  'expenses',
  'savings_goals',
  'journal_entries',
  'profile',
  'sunday_reviews',
  'history_audit',
]);

export const ALLOWED_OPERATIONS = new Set(['create', 'update', 'delete', 'tombstone']);

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const CONTROL_CHAR_REGEX = /[\u0000-\u001F\u007F]/;

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isValidUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export function isValidStoreName(value) {
  return typeof value === 'string' && ALLOWED_STORES.has(value);
}

export function isValidOperation(value) {
  return typeof value === 'string' && ALLOWED_OPERATIONS.has(value);
}

export function isValidRecordId(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 255 &&
    !CONTROL_CHAR_REGEX.test(value)
  );
}

export function normalizeDeviceMetadata(raw = {}) {
  const pick = (value, fallback, maxLen) => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.replace(CONTROL_CHAR_REGEX, '').trim();
    if (!trimmed) return fallback;
    return trimmed.slice(0, maxLen);
  };

  return {
    deviceName: pick(raw.deviceName ?? raw.device_name, 'Unknown Device', 120),
    platform: pick(raw.platform, 'unknown', 40),
    appVersion: pick(raw.appVersion ?? raw.app_version, '0.1.0', 40),
  };
}

export function parseStrictNonNegativeInt(raw, defaultValue = null) {
  if (raw === null || raw === undefined || raw === '') return defaultValue;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return Number.NaN;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

export function validateChangeItem(
  change,
  expectedDeviceId,
  maxPayloadSize = DEFAULT_MAX_PAYLOAD_SIZE
) {
  const errors = [];
  if (!isPlainObject(change)) {
    return ['change must be an object'];
  }

  if (!isValidUuid(change.device_id)) {
    errors.push('invalid device_id');
  } else if (expectedDeviceId && change.device_id.toLowerCase() !== expectedDeviceId.toLowerCase()) {
    errors.push('device_id mismatch');
  }

  if (!isValidUuid(change.client_change_id)) {
    errors.push('invalid client_change_id');
  }

  if (!isValidStoreName(change.store_name)) {
    errors.push('invalid store_name');
  }

  if (!isValidRecordId(change.record_id)) {
    errors.push('invalid record_id');
  }

  if (!isValidOperation(change.operation)) {
    errors.push('invalid operation');
  }

  if (!isPlainObject(change.payload)) {
    errors.push('invalid payload');
  } else {
    const encoded = JSON.stringify(change.payload);
    if (Buffer.byteLength(encoded, 'utf8') > maxPayloadSize) {
      errors.push('payload exceeds max size');
    }
  }

  if (change.client_timestamp !== undefined && change.client_timestamp !== null) {
    if (
      typeof change.client_timestamp !== 'string' ||
      change.client_timestamp.length > 64 ||
      Number.isNaN(Date.parse(change.client_timestamp))
    ) {
      errors.push('invalid client_timestamp');
    }
  }

  if (change.base_version !== undefined && change.base_version !== null) {
    if (!Number.isSafeInteger(change.base_version) || change.base_version < 0) {
      errors.push('invalid base_version');
    }
  }

  return errors;
}

export function validateSyncMessage(message, maxBatchSize = DEFAULT_MAX_BATCH_SIZE) {
  if (!isPlainObject(message)) {
    return { ok: false, error: 'invalid message format' };
  }

  if (message.clientCursor !== undefined) {
    if (!Number.isSafeInteger(message.clientCursor) || message.clientCursor < 0) {
      return { ok: false, error: 'invalid clientCursor' };
    }
  }

  if (!Array.isArray(message.changes)) {
    return { ok: false, error: 'changes must be an array' };
  }

  if (message.changes.length > maxBatchSize) {
    return { ok: false, error: 'batch too large', maxSize: maxBatchSize };
  }

  return {
    ok: true,
    clientCursor: message.clientCursor,
    changes: message.changes,
  };
}
