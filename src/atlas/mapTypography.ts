/** Shared by label measurement and painting; uses local fonts without loading work. */
export function mapLabelFont(size = 13): string {
  return `${size}px Georgia, "Times New Roman", serif`;
}
