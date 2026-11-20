import { Types } from 'mongoose'
import { VehicleTypeModel } from '../../models/vehicle-type.model.js'

export type VehicleTypeRecord = {
  id: string
  organizationId: string
  userId: string
  name: string
  createdAt: string
}

function toRecord(doc: {
  _id: Types.ObjectId
  organizationId: Types.ObjectId
  userId: Types.ObjectId
  name: string
  createdAt?: Date
}): VehicleTypeRecord {
  return {
    id: String(doc._id),
    organizationId: String(doc.organizationId),
    userId: String(doc.userId),
    name: doc.name,
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
  }
}

export async function listVehicleTypesForUser(
  organizationId: string,
  userId: string,
): Promise<VehicleTypeRecord[]> {
  const docs = await VehicleTypeModel.find({
    organizationId: new Types.ObjectId(organizationId),
    userId: new Types.ObjectId(userId),
  })
    .sort({ name: 1 })
    .lean()
    .exec()

  return docs.map((doc) =>
    toRecord({
      _id: doc._id as Types.ObjectId,
      organizationId: doc.organizationId as Types.ObjectId,
      userId: doc.userId as Types.ObjectId,
      name: doc.name,
      createdAt: doc.createdAt as Date | undefined,
    }),
  )
}

/** Upserts a type for the user. Returns the stored display name. */
export async function upsertVehicleTypeForUser(input: {
  organizationId: string
  userId: string
  name: string
}): Promise<VehicleTypeRecord> {
  const name = input.name.trim()
  const normalizedName = name.toLowerCase()

  const doc = await VehicleTypeModel.findOneAndUpdate(
    {
      organizationId: new Types.ObjectId(input.organizationId),
      userId: new Types.ObjectId(input.userId),
      normalizedName,
    },
    {
      $setOnInsert: {
        organizationId: new Types.ObjectId(input.organizationId),
        userId: new Types.ObjectId(input.userId),
        name,
        normalizedName,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
    .lean()
    .exec()

  if (!doc) {
    throw new Error('Failed to upsert vehicle type')
  }

  return toRecord({
    _id: doc._id as Types.ObjectId,
    organizationId: doc.organizationId as Types.ObjectId,
    userId: doc.userId as Types.ObjectId,
    name: doc.name,
    createdAt: doc.createdAt as Date | undefined,
  })
}
