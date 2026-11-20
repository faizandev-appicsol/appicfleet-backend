import { getRequestMeta } from '../../helpers/requestMeta.js'
import { sendSuccess } from '../../helpers/response.js'
import { requireAccess } from '../../middlewares/auth.middleware.js'
import { getValidated } from '../../middlewares/validation.middleware.js'
import {
  cancelBooking,
  confirmBooking,
  convertBooking,
  createDraft,
  expireHoldsForCaller,
  getBooking,
  getBookingHistory,
  intakeBooking,
  listBookingDirectory,
  listCalendar,
  placeHold,
  releaseHold,
  searchAvailability,
  updateDraft,
} from '../../services/bookings/booking.service.js'
import type { ValidatedRequest } from '../../types/http.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import type {
  AvailabilityQuery,
  CalendarQuery,
  CancelBookingBody,
  CreateBookingBody,
  HoldBookingBody,
  IntakeBookingBody,
  ListBookingsQuery,
  UpdateBookingBody,
} from '../../validations/booking.validation.js'
import type { CustomerIdParams } from '../../validations/customer.validation.js'

export const listBookingsHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, ListBookingsQuery>>(req)
  const page = await listBookingDirectory(requireAccess(req), query)
  sendSuccess(res, 'Bookings loaded successfully.', page)
})

export const calendarHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, CalendarQuery>>(req)
  const calendar = await listCalendar(requireAccess(req), query)
  sendSuccess(res, 'Booking calendar loaded successfully.', calendar)
})

export const availabilityHandler = asyncHandler(async (req, res) => {
  const { query } = getValidated<ValidatedRequest<unknown, AvailabilityQuery>>(req)
  const result = await searchAvailability(requireAccess(req), query)
  sendSuccess(res, 'Available vehicles loaded successfully.', result)
})

export const expireHoldsHandler = asyncHandler(async (req, res) => {
  const result = await expireHoldsForCaller(requireAccess(req))
  sendSuccess(res, 'Expired holds were released.', result)
})

export const intakeHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<IntakeBookingBody>>(req)
  const headerKey = req.get('Idempotency-Key')
  const result = await intakeBooking(requireAccess(req), body, getRequestMeta(req), headerKey)
  sendSuccess(
    res,
    result.duplicate ? 'Duplicate booking request ignored.' : 'Booking intake accepted.',
    result,
    result.duplicate ? 200 : 201,
  )
})

export const createBookingHandler = asyncHandler(async (req, res) => {
  const { body } = getValidated<ValidatedRequest<CreateBookingBody>>(req)
  const booking = await createDraft(requireAccess(req), body, getRequestMeta(req))
  sendSuccess(res, 'Booking created successfully.', booking, 201)
})

export const getBookingHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  const booking = await getBooking(requireAccess(req), params.id)
  sendSuccess(res, 'Booking loaded successfully.', booking)
})

export const updateBookingHandler = asyncHandler(async (req, res) => {
  const { body, params } = getValidated<ValidatedRequest<UpdateBookingBody, unknown, CustomerIdParams>>(req)
  const booking = await updateDraft(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Booking updated successfully.', booking)
})

export const holdBookingHandler = asyncHandler(async (req, res) => {
  const { body, params } = getValidated<ValidatedRequest<HoldBookingBody, unknown, CustomerIdParams>>(req)
  const booking = await placeHold(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Booking hold placed successfully.', booking)
})

export const confirmBookingHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  const booking = await confirmBooking(requireAccess(req), params.id, getRequestMeta(req))
  sendSuccess(res, 'Booking confirmed successfully.', booking)
})

export const cancelBookingHandler = asyncHandler(async (req, res) => {
  const { body, params } = getValidated<ValidatedRequest<CancelBookingBody, unknown, CustomerIdParams>>(req)
  const booking = await cancelBooking(requireAccess(req), params.id, body, getRequestMeta(req))
  sendSuccess(res, 'Booking cancelled successfully.', booking)
})

export const releaseBookingHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  const booking = await releaseHold(requireAccess(req), params.id, getRequestMeta(req))
  sendSuccess(res, 'Booking hold released successfully.', booking)
})

export const convertBookingHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  const booking = await convertBooking(requireAccess(req), params.id, getRequestMeta(req))
  sendSuccess(res, 'Booking marked for contract conversion.', booking)
})

export const historyHandler = asyncHandler(async (req, res) => {
  const { params } = getValidated<ValidatedRequest<unknown, unknown, CustomerIdParams>>(req)
  const events = await getBookingHistory(requireAccess(req), params.id)
  sendSuccess(res, 'Booking history loaded successfully.', events)
})
