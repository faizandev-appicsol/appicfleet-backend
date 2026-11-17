import type { RequestHandler } from 'express'
import { AppError } from '../exceptions/AppError.js'
import { ERROR_CODES } from '../exceptions/errorCodes.js'

export const notFoundMiddleware: RequestHandler = (req, _res, next) => {
  next(new AppError(`Route ${req.method} ${req.path} was not found.`, 404, ERROR_CODES.NOT_FOUND))
}
