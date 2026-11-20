import { Schema, model } from 'mongoose'
import {
  CUSTOMER_DOCUMENT_STATUSES,
  CUSTOMER_STATUSES,
  CUSTOMER_TYPES,
} from '../constants/customers.js'
import type { ICustomer } from '../interfaces/customer.interface.js'

const addressSchema = new Schema(
  {
    line1: { type: String, required: true, trim: true, maxlength: 200 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    country: { type: String, required: true, trim: true, maxlength: 60 },
  },
  { _id: false },
)

const individualSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    middleName: { type: String, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    dateOfBirth: { type: Date },
    nationality: { type: String, trim: true, maxlength: 60 },
  },
  { _id: false },
)

const corporateSchema = new Schema(
  {
    legalName: { type: String, required: true, trim: true, maxlength: 160 },
    tradeName: { type: String, trim: true, maxlength: 160 },
    registrationNumber: { type: String, trim: true, uppercase: true, maxlength: 60 },
    taxNumber: { type: String, trim: true, uppercase: true, maxlength: 60 },
  },
  { _id: false },
)

const customerSchema = new Schema<ICustomer>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    legalEntityId: { type: Schema.Types.ObjectId, ref: 'LegalEntity', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    customerNumber: { type: String, required: true, trim: true, maxlength: 32 },
    type: { type: String, required: true, enum: Object.values(CUSTOMER_TYPES) },
    status: {
      type: String,
      required: true,
      enum: Object.values(CUSTOMER_STATUSES),
      default: CUSTOMER_STATUSES.ACTIVE,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 200 },
    email: { type: String, trim: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 40 },
    alternatePhone: { type: String, trim: true, maxlength: 40 },
    address: { type: addressSchema },
    notes: { type: String, trim: true, maxlength: 2000 },
    individual: { type: individualSchema },
    corporate: { type: corporateSchema },
    normalizedEmail: { type: String, maxlength: 200 },
    normalizedPhone: { type: String, maxlength: 40 },
    documentStatus: {
      type: String,
      required: true,
      enum: Object.values(CUSTOMER_DOCUMENT_STATUSES),
      default: CUSTOMER_DOCUMENT_STATUSES.NONE,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'customers' },
)

customerSchema.index({ organizationId: 1, customerNumber: 1 }, { unique: true })
customerSchema.index({ organizationId: 1, normalizedEmail: 1 })
customerSchema.index({ organizationId: 1, normalizedPhone: 1 })
customerSchema.index({ organizationId: 1, branchId: 1, status: 1 })
customerSchema.index({ organizationId: 1, type: 1 })

export const Customer = model<ICustomer>('Customer', customerSchema)
