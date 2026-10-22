import { AppError } from '../utils/AppError.js';

export function validate(schema){
  return (req,res,next)=>{
    try{
      req.body=schema.body?schema.body.parse(req.body):req.body;
      req.query=schema.query?schema.query.parse(req.query):req.query;
      req.params=schema.params?schema.params.parse(req.params):req.params;
      next();
    }catch(e){
      return next(new AppError('Validation failed',422,'VALIDATION_ERROR',e.errors));
    }
  };
}
