import { Schema, model } from 'mongoose'
import { CONTACT_ROLES, CONTACT_STATUSES } from '../constants/customers.js'
import type { ICustomerContact } from '../interfaces/customer.interface.js'

const customerContactSchema = new Schema<ICustomerContact>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 40 },
    email: { type: String, trim: true, maxlength: 200 },
    role: {
      type: String,
      required: true,
      enum: Object.values(CONTACT_ROLES),
      default: CONTACT_ROLES.CONTACT,
    },
    licenseNumber: { type: String, trim: true, maxlength: 60 },
    licenseExpiresOn: { type: Date },
    isPrimary: { type: Boolean, required: true, default: false },
    status: {
      type: String,
      required: true,
      enum: Object.values(CONTACT_STATUSES),
      default: CONTACT_STATUSES.ACTIVE,
    },
  },
  { timestamps: true, collection: 'customer_contacts' },
)

customerContactSchema.index({ organizationId: 1, customerId: 1, status: 1 })

export const CustomerContact = model<ICustomerContact>('CustomerContact', customerContactSchema)
