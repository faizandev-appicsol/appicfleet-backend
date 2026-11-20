import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { randomBytes } from 'node:crypto'
import { env } from '../../config/env.js'
import type { StoragePutOptions, StoragePutResult, StorageService } from './storage.types.js'

const STORAGE_KEY_PATTERN = /^[a-f0-9]{64}$/

function assertStorageKey(storageKey: string): void {
  if (!STORAGE_KEY_PATTERN.test(storageKey)) throw new Error('Invalid storage key')
}

/**
 * Private S3 blob storage. Objects are opaque hex keys under an optional prefix.
 * Bytes only leave through `read`, behind an authorized API call — never public URLs.
 */
export class S3StorageService implements StorageService {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly prefix: string

  constructor(options?: {
    region?: string
    bucket?: string
    accessKeyId?: string
    secretAccessKey?: string
    prefix?: string
  }) {
    const region = options?.region ?? env.awsRegion
    const bucket = options?.bucket ?? env.awsS3Bucket
    const accessKeyId = options?.accessKeyId ?? env.awsAccessKeyId
    const secretAccessKey = options?.secretAccessKey ?? env.awsSecretAccessKey

    if (!region || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'S3 storage requires AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY',
      )
    }

    this.bucket = bucket
    this.prefix = (options?.prefix ?? env.awsS3Prefix).replace(/^\/+|\/+$/g, '')
    this.client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })
  }

  private objectKey(storageKey: string): string {
    assertStorageKey(storageKey)
    return this.prefix ? `${this.prefix}/${storageKey}` : storageKey
  }

  async put(bytes: Buffer, options: StoragePutOptions): Promise<StoragePutResult> {
    const storageKey = randomBytes(32).toString('hex')
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(storageKey),
        Body: bytes,
        ContentType: options.mimeType,
        ContentLength: bytes.length,
      }),
    )
    return { storageKey }
  }

  async read(storageKey: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(storageKey),
      }),
    )
    const body = response.Body
    if (!body) throw new Error('S3 object body was empty')
    const bytes = await body.transformToByteArray()
    return Buffer.from(bytes)
  }

  async exists(storageKey: string): Promise<boolean> {
    if (!STORAGE_KEY_PATTERN.test(storageKey)) return false
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.objectKey(storageKey),
        }),
      )
      return true
    } catch {
      return false
    }
  }

  async remove(storageKey: string): Promise<void> {
    if (!STORAGE_KEY_PATTERN.test(storageKey)) return
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(storageKey),
      }),
    )
  }
}
