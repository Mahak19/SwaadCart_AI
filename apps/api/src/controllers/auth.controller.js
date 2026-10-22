import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signAccess, setAuthCookies } from '../utils/tokens.js';

export const register = asyncHandler(async (req,res)=>{
  const { name,email,password } = req.body;
  const exists = await User.findOne({ email });
  if(exists) throw new AppError('Email exists',409,'CONFLICT');
  const passwordHash = await bcrypt.hash(password,12);
  const user = await User.create({ name,email,passwordHash });
  setAuthCookies(res, user);
  res.json({ user: { id:user._id,email:user.email,name:user.name,householdId:user.householdId,onboardingComplete:user.onboardingComplete } });
});

export const login = asyncHandler(async (req,res)=>{
  const { email,password } = req.body;
  const user = await User.findOne({ email });
  if(!user) throw new AppError('Invalid credentials',401,'UNAUTHORIZED');
  const ok = await user.comparePassword(password);
  if(!ok) throw new AppError('Invalid credentials',401,'UNAUTHORIZED');
  setAuthCookies(res, user);
  res.json({ user: { id:user._id,email:user.email,name:user.name,householdId:user.householdId,onboardingComplete:user.onboardingComplete } });
});

export const me = asyncHandler(async (req,res)=>{
  const user = await User.findById(req.user.id);
  if(!user) throw new AppError('Unauthorized',401,'UNAUTHORIZED');
  res.json({ user: { id:user._id,email:user.email,name:user.name,householdId:user.householdId,onboardingComplete:user.onboardingComplete } });
});

export const updateMe = asyncHandler(async (req,res)=>{
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if(name.length < 2) throw new AppError('Name must be at least 2 characters',400,'VALIDATION_ERROR');
  const user = await User.findByIdAndUpdate(req.user.id, { name }, { new:true });
  if(!user) throw new AppError('Unauthorized',401,'UNAUTHORIZED');
  res.json({ user: { id:user._id,email:user.email,name:user.name,householdId:user.householdId,onboardingComplete:user.onboardingComplete } });
});

export const logout = asyncHandler(async (req,res)=>{
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ ok:true });
});

export const refresh = asyncHandler(async (req,res)=>{
  const token = req.cookies?.refreshToken;
  if(!token) throw new AppError('No refresh',401,'UNAUTHORIZED');
  try{
    const payload = jwt.verify(token,env.JWT_REFRESH_SECRET);
    const user = await User.findById(payload.id);
    if(!user) throw new AppError('Invalid',401,'UNAUTHORIZED');
    res.cookie('accessToken', signAccess(user), { httpOnly:true, sameSite:'lax', secure:false });
    res.json({ ok:true });
  }catch(e){
    throw new AppError('Invalid refresh',401,'UNAUTHORIZED');
  }
});
