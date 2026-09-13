import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthGuard } from './auth.guard.js';
import type { AuthInstance } from './auth.instance.js';

function makeContext(headers: Record<string, string> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  it('throws UnauthorizedException when there is no session', async () => {
    const auth = { api: { getSession: vi.fn().mockResolvedValue(null) } };
    const guard = new AuthGuard(auth as unknown as AuthInstance);

    await expect(guard.canActivate(makeContext())).rejects.toThrow(UnauthorizedException);
  });

  it('attaches the session user to the request and allows the request through', async () => {
    const user = { id: 'user-1', email: 'a@example.com', emailVerified: true };
    const auth = { api: { getSession: vi.fn().mockResolvedValue({ user, session: {} }) } };
    const guard = new AuthGuard(auth as unknown as AuthInstance);

    const request: { headers: Record<string, string>; user?: unknown } = { headers: { authorization: 'Bearer token' } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const allowed = await guard.canActivate(context);

    expect(allowed).toBe(true);
    expect(request.user).toEqual(user);
  });
});
