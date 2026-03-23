export function getGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

export function getWazeUrl(address: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`
}

export function buildFullAddress(parts: {
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}): string {
  return [parts.address, parts.city, parts.state, parts.zip]
    .filter(Boolean)
    .join(', ')
}
