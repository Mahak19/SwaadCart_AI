import { AppError } from '../utils/AppError.js';

export function householdScope(req,res,next){
  if(!req.user?.householdId)return next(new AppError('No household',403,'FORBIDDEN'));
  next();
}
