import { describe, expect, it } from 'vitest';
import { hashToken, newOpaqueToken } from './tokens';

describe('tokens', () => {
  it('generates unique url-safe tokens', () => {
    const a = newOpaqueToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newOpaqueToken()).not.toBe(a);
  });
  it('hashes deterministically and never returns the raw token', () => {
    expect(hashToken('x')).toBe(hashToken('x'));
    expect(hashToken('x')).not.toBe('x');
  });
});
