import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { register, login, me, updateMe, logout, refresh } from '../controllers/auth.controller.js';
import { auth } from '../middleware/auth.js';

const router = Router();

const registerSchema = {
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6)
  })
};
const loginSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6)
  })
};

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', auth, me);
router.patch('/me', auth, updateMe);
router.post('/logout', logout);
router.post('/refresh', refresh);

export default router;
