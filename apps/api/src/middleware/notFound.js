import { AppError } from '../utils/AppError.js';

export function notFound(req, res, next) {
  next(new AppError('Not found', 404, 'NOT_FOUND'));
}
