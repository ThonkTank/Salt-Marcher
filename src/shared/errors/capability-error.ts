export class CapabilityError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = 'CapabilityError'
  }
}
