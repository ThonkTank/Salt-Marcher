let lastTimestamp = -1
let sequence = 0

export function uuidv7(now = Date.now()): string {
  let logicalTimestamp = Math.trunc(now)
  if (logicalTimestamp > lastTimestamp) {
    lastTimestamp = logicalTimestamp
    sequence = 0
  } else {
    sequence += 1
    if (sequence > 0xfff) {
      lastTimestamp += 1
      sequence = 0
    }
    logicalTimestamp = lastTimestamp
  }

  const timestamp = logicalTimestamp.toString(16).padStart(12, '0')
  const sequenceHex = sequence.toString(16).padStart(3, '0')
  const random = crypto.randomUUID().replaceAll('-', '')
  const variant = (
    (Number.parseInt(random[0] ?? '0', 16) & 0x3) |
    0x8
  ).toString(16)
  return `${timestamp.slice(0, 8)}-${timestamp.slice(8, 12)}-7${sequenceHex}-${variant}${random.slice(1, 4)}-${random.slice(4, 16)}`
}
