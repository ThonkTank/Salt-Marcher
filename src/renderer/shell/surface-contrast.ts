export const rubricSurfacePairs = {
  light: [
    ['#7a2017', '#fbf5e4'],
    ['#7a2017', '#f4ead1'],
    ['#702017', '#e2cea4']
  ],
  dark: [
    ['#e8c882', '#0f0c08'],
    ['#e8c882', '#221a12'],
    ['#e8c882', '#17120d']
  ]
} as const

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background))
  const darker = Math.min(luminance(foreground), luminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

function luminance(color: string): number {
  const channels = color
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    )
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
}
