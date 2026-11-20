/**
 * Provider-neutral scanner contract.
 *
 * Business logic depends on this interface, not on a vendor SDK. No hardware adapter is
 * shipped with this module. `MockScannerConnector` exists so tests and development can see
 * the contract fail closed. It is not a production scanner and it never reads a device.
 */

export type ScanRequest = {
  /** Dots per inch the adapter should request. Adapters may ignore it. */
  dpi?: number
}

export type ScanPage = {
  filename: string
  mimeType: string
  content: Buffer
}

export interface ScannerConnector {
  readonly name: string
  connect(): Promise<void>
  scan(request?: ScanRequest): Promise<ScanPage>
  disconnect(): Promise<void>
}

export class ScannerUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScannerUnavailableError'
  }
}

/**
 * Development stand-in. `scan` always fails so a caller cannot treat it as a real device.
 * The customer UI uses the browser camera and file picker instead.
 */
export class MockScannerConnector implements ScannerConnector {
  readonly name = 'mock-scanner'
  private connected = false

  async connect(): Promise<void> {
    this.connected = true
  }

  async scan(): Promise<ScanPage> {
    if (!this.connected) {
      throw new ScannerUnavailableError('Scanner is not connected.')
    }
    throw new ScannerUnavailableError(
      'The development scanner connector is not a production device. Use file upload or the browser camera.',
    )
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }
}
