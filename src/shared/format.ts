export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KiB', 'MiB', 'GiB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`
}

export function formatDifference(sourceBytes: number, resultBytes: number): string {
  const difference = sourceBytes - resultBytes
  if (difference === 0) return 'No size reduction'
  const percentage = Math.abs((difference / sourceBytes) * 100)
  return difference > 0 ? `${percentage.toFixed(1)}% smaller` : `${percentage.toFixed(1)}% larger`
}
