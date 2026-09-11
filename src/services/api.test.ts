import { beforeAll, describe, expect, it } from 'vitest';
import type { UserProfile } from '../types';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});

let api: typeof import('./api').api;

beforeAll(async () => {
  ({ api } = await import('./api'));
});

describe('asset management rules', () => {
  it('routes same-department transfers for automatic completion', () => {
    const result = api.calculateTransferCase('dept-cse', 'dept-cse', 'fac-fet', 'univ-1');

    expect(result.caseNumber).toBe(1);
    expect(result.autoApproved).toBe(true);
    expect(result.type).toBe('SAME_DEPARTMENT');
  });

  it('routes cross-faculty transfers for faculty approval', () => {
    const result = api.calculateTransferCase('dept-cse', 'dept-phys', 'fac-fos', 'univ-1');

    expect(result.caseNumber).toBe(3);
    expect(result.autoApproved).toBe(false);
    expect(result.type).toBe('DIFF_FACULTY');
  });

  it('blocks asset creation without manage permission', async () => {
    const standardUser: UserProfile = {
      id: 'test-user',
      username: 'standard',
      full_name: 'Standard User',
      email: 'standard@example.com',
      role_id: 'STANDARD_USER',
      level: 0,
      department_id: null,
      faculty_id: null,
      university_id: null,
      permissions: ['view_inventory'],
    };

    const result = await api.createAsset(standardUser, {
      id: 'TEST-001',
      name: 'Test asset',
      description: 'Test asset',
      category: 'Equipment',
      department_id: 'dept-cse',
      faculty_id: 'fac-fet',
      university_id: 'univ-1',
      location_id: 'loc-lab101',
      condition: 'GOOD',
      status: 'AVAILABLE',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('permission');
  });
});
