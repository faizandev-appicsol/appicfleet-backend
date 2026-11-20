import { Router } from 'express'
import { PERMISSIONS } from '../constants/permissions.js'
import {
  availabilityHandler,
  calendarHandler,
  cancelBookingHandler,
  confirmBookingHandler,
  convertBookingHandler,
  createBookingHandler,
  expireHoldsHandler,
  getBookingHandler,
  historyHandler,
  holdBookingHandler,
  intakeHandler,
  listBookingsHandler,
  releaseBookingHandler,
  updateBookingHandler,
} from '../controllers/bookings/booking.controller.js'
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validation.middleware.js'
import {
  availabilityQuerySchema,
  bookingIdParamsSchema,
  calendarQuerySchema,
  cancelBookingBodySchema,
  createBookingBodySchema,
  holdBookingBodySchema,
  intakeBookingBodySchema,
  listBookingsQuerySchema,
  updateBookingBodySchema,
} from '../validations/booking.validation.js'

export const bookingRouter = Router()

bookingRouter.use(authenticate)

bookingRouter.get(
  '/availability',
  requirePermission(PERMISSIONS.BOOKING_VIEW),
  validate({ query: availabilityQuerySchema }),
  availabilityHandler,
)
bookingRouter.get(
  '/calendar',
  requirePermission(PERMISSIONS.BOOKING_VIEW_CALENDAR),
  validate({ query: calendarQuerySchema }),
  calendarHandler,
)
bookingRouter.post(
  '/holds/expire',
  requirePermission(PERMISSIONS.BOOKING_RELEASE),
  expireHoldsHandler,
)
bookingRouter.post(
  '/intake',
  requirePermission(PERMISSIONS.BOOKING_CREATE),
  validate({ body: intakeBookingBodySchema }),
  intakeHandler,
)
bookingRouter.get(
  '/',
  requirePermission(PERMISSIONS.BOOKING_VIEW),
  validate({ query: listBookingsQuerySchema }),
  listBookingsHandler,
)
bookingRouter.post(
  '/',
  requirePermission(PERMISSIONS.BOOKING_CREATE),
  validate({ body: createBookingBodySchema }),
  createBookingHandler,
)
bookingRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.BOOKING_VIEW),
  validate({ params: bookingIdParamsSchema }),
  getBookingHandler,
)
bookingRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.BOOKING_UPDATE),
  validate({ body: updateBookingBodySchema, params: bookingIdParamsSchema }),
  updateBookingHandler,
)
bookingRouter.post(
  '/:id/hold',
  requirePermission(PERMISSIONS.BOOKING_MANAGE_HOLDS),
  validate({ body: holdBookingBodySchema, params: bookingIdParamsSchema }),
  holdBookingHandler,
)
bookingRouter.post(
  '/:id/confirm',
  requirePermission(PERMISSIONS.BOOKING_CONFIRM),
  validate({ params: bookingIdParamsSchema }),
  confirmBookingHandler,
)
bookingRouter.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.BOOKING_CANCEL),
  validate({ body: cancelBookingBodySchema, params: bookingIdParamsSchema }),
  cancelBookingHandler,
)
bookingRouter.post(
  '/:id/release',
  requirePermission(PERMISSIONS.BOOKING_RELEASE),
  validate({ params: bookingIdParamsSchema }),
  releaseBookingHandler,
)
bookingRouter.post(
  '/:id/convert',
  requirePermission(PERMISSIONS.BOOKING_CONVERT),
  validate({ params: bookingIdParamsSchema }),
  convertBookingHandler,
)
bookingRouter.get(
  '/:id/history',
  requirePermission(PERMISSIONS.BOOKING_VIEW),
  validate({ params: bookingIdParamsSchema }),
  historyHandler,
)
