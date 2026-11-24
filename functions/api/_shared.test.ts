import { describe, expect, it } from 'vitest';
import { getTableNames, resolveTablePrefix } from './_shared';

describe('resolveTablePrefix & getTableNames', () => {
  it('returns empty prefix and default table names when unset', () => {
    expect(resolveTablePrefix(undefined)).toBe('');
    expect(resolveTablePrefix('')).toBe('');
    expect(getTableNames({})).toEqual({
      prefix: '',
      transactions: 'transactions',
      activityLogs: 'activity_logs',
      apiRequestLogs: 'api_request_logs',
      adminSessions: 'admin_sessions',
      appSettings: 'app_settings',
    });
  });

  it('prefixes all 5 tables when DB_TABLE_PREFIX is valid', () => {
    expect(resolveTablePrefix('test_')).toBe('test_');
    expect(getTableNames({ DB_TABLE_PREFIX: 'test_' })).toEqual({
      prefix: 'test_',
      transactions: 'test_transactions',
      activityLogs: 'test_activity_logs',
      apiRequestLogs: 'test_api_request_logs',
      adminSessions: 'test_admin_sessions',
      appSettings: 'test_app_settings',
    });
  });

  it('rejects unsafe prefixes to prevent SQL injection', () => {
    expect(resolveTablePrefix('test_; DROP TABLE transactions;--')).toBe('');
    expect(resolveTablePrefix('123_invalid')).toBe('');
    expect(resolveTablePrefix('a-b')).toBe('');
  });
});
