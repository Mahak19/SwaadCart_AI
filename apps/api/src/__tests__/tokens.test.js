import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signAccess, signRefresh } from '../utils/tokens.js';

const user = { _id: 'u1', email: 'test@example.com', householdId: 'h1' };

describe('auth tokens', () => {
  it('signAccess embeds user id, email and household id', () => {
    const decoded = jwt.decode(signAccess(user));
    expect(decoded.id).toBe('u1');
    expect(decoded.email).toBe('test@example.com');
    expect(decoded.householdId).toBe('h1');
  });

  it('signAccess expires in 15 minutes', () => {
    const decoded = jwt.decode(signAccess(user));
    expect(decoded.exp - decoded.iat).toBe(15 * 60);
  });

  it('signRefresh carries only the user id and lasts 7 days', () => {
    const decoded = jwt.decode(signRefresh(user));
    expect(decoded.id).toBe('u1');
    expect(decoded.exp - decoded.iat).toBe(7 * 24 * 60 * 60);
  });
});
