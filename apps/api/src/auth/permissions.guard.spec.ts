import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { PermissionsGuard } from './permissions.guard';

function ctx(user: unknown, required?: string[]) {
  const reflector = { getAllAndOverride: () => required } as unknown as Reflector;
  const guard = new PermissionsGuard(reflector);
  const context = {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
  return () => guard.canActivate(context as never);
}

describe('PermissionsGuard', () => {
  it('allows when no permission is required', () => {
    expect(ctx({ permissions: [] }, undefined)()).toBe(true);
  });
  it('allows when the user has every required permission', () => {
    expect(ctx({ permissions: ['a', 'b'] }, ['a', 'b'])()).toBe(true);
  });
  it('rejects when any permission is missing', () => {
    expect(ctx({ permissions: ['a'] }, ['a', 'b'])).toThrow(ForbiddenException);
  });
});
