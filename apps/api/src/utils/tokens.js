import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccess(user) {
  return jwt.sign(
    { id: user._id, email: user.email, householdId: user.householdId },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
}

export function signRefresh(user) {
  return jwt.sign({ id: user._id }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

export function setAuthCookies(res, user) {
  res.cookie('accessToken', signAccess(user), { httpOnly: true, sameSite: 'lax', secure: false });
  res.cookie('refreshToken', signRefresh(user), { httpOnly: true, sameSite: 'lax', secure: false });
}
