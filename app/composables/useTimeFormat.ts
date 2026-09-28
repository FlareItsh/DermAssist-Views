/**
 * Formats a duration in seconds into a clean, human-readable string.
 * Examples:
 *   formatDuration(0) => '0s'
 *   formatDuration(45) => '45s'
 *   formatDuration(60) => '1m'
 *   formatDuration(125) => '2m 5s'
 *   formatDuration(3600) => '1h'
 *   formatDuration(3725) => '1h 2m'
 */
export const formatDuration = (totalSeconds: number | null | undefined): string => {
  if (totalSeconds === null || totalSeconds === undefined || Number.isNaN(totalSeconds) || totalSeconds <= 0) {
    return '0s'
  }

  const s = Math.round(totalSeconds)

  if (s < 60) {
    return `${s}s`
  }

  const mins = Math.floor(s / 60)
  const remainingSecs = s % 60

  if (s < 3600) {
    return remainingSecs > 0 ? `${mins}m ${remainingSecs}s` : `${mins}m`
  }

  const hours = Math.floor(s / 3600)
  const remainingMins = Math.floor((s % 3600) / 60)

  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`
}

export const useTimeFormat = () => {
  return {
    formatDuration,
  }
}
