import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function auth(req,res,next){
  const token=req.cookies?.accessToken||req.headers.authorization?.replace('Bearer ','');
  if(!token)return next(new AppError('Unauthorized',401,'UNAUTHORIZED'));
  try{
    const payload=jwt.verify(token,env.JWT_ACCESS_SECRET);
    req.user=payload;
    next();
  }catch(e){
    return next(new AppError('Unauthorized',401,'UNAUTHORIZED'));
  }
}
