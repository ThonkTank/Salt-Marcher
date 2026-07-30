export function uuidv7(now = Date.now()): string {
  const timestamp = now.toString(16).padStart(12, '0')
  const random = crypto.randomUUID().replaceAll('-', '')
  return `${timestamp.slice(0, 8)}-${timestamp.slice(8, 12)}-7${random.slice(0, 3)}-${((Number.parseInt(random[3] ?? '0', 16) & 0x3) | 0x8).toString(16)}${random.slice(4, 7)}-${random.slice(7, 19)}`
}
