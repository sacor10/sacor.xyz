const stopFields = ['name', 'lat', 'lng', 'arrivalTime', 'durationMinutes', 'notes']

export const blankStop = () => ({
  name: '',
  lat: '',
  lng: '',
  arrivalTime: '',
  durationMinutes: '',
  notes: '',
})

const hasValue = (value) => String(value ?? '').trim() !== ''

const isBlankStop = (stop) => stopFields.every((field) => !hasValue(stop?.[field]))

const draftValue = (value) => (value === null || value === undefined ? '' : String(value))

const toDraftStop = (stop = {}) => {
  const source = stop && typeof stop === 'object' ? stop : {}
  return {
    name: draftValue(typeof source.name === 'string' ? source.name : ''),
    lat: draftValue(source.lat),
    lng: draftValue(source.lng),
    arrivalTime: draftValue(typeof source.arrivalTime === 'string' ? source.arrivalTime : ''),
    durationMinutes: draftValue(source.durationMinutes),
    notes: draftValue(typeof source.notes === 'string' ? source.notes : ''),
  }
}

const maybeNumber = (value) => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const number = Number(text)
  return Number.isFinite(number) ? number : text
}

export const stopsForJsonDraft = (stops) =>
  (Array.isArray(stops) ? stops : [])
    .filter((stop) => !isBlankStop(stop))
    .map((stop) => {
      const out = {}
      const name = String(stop.name ?? '').trim()
      const arrivalTime = String(stop.arrivalTime ?? '').trim()
      const notes = String(stop.notes ?? '').trim()
      if (name) out.name = name
      if (hasValue(stop.lat)) out.lat = maybeNumber(stop.lat)
      if (hasValue(stop.lng)) out.lng = maybeNumber(stop.lng)
      if (arrivalTime) out.arrivalTime = arrivalTime
      if (hasValue(stop.durationMinutes)) out.durationMinutes = maybeNumber(stop.durationMinutes)
      if (notes) out.notes = notes
      return out
    })

export const stopsToDraft = (stops) => (Array.isArray(stops) ? stops.map(toDraftStop) : [])

export function normalizeStopsForSave(stops) {
  const normalized = []

  ;(Array.isArray(stops) ? stops : []).forEach((stop, index) => {
    if (isBlankStop(stop)) return

    const label = `Stop ${index + 1}`
    const name = String(stop.name ?? '').trim()
    const latText = String(stop.lat ?? '').trim()
    const lngText = String(stop.lng ?? '').trim()

    if (!name) throw new Error(`${label}: name is required.`)
    if (!latText) throw new Error(`${label}: latitude is required.`)
    if (!lngText) throw new Error(`${label}: longitude is required.`)

    const lat = Number(latText)
    const lng = Number(lngText)
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new Error(`${label}: latitude must be between -90 and 90.`)
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new Error(`${label}: longitude must be between -180 and 180.`)
    }

    const out = { name, lat, lng }
    const arrivalTime = String(stop.arrivalTime ?? '').trim()
    const durationText = String(stop.durationMinutes ?? '').trim()
    const notes = String(stop.notes ?? '').trim()

    if (arrivalTime) out.arrivalTime = arrivalTime
    if (durationText) {
      const durationMinutes = Number(durationText)
      if (!Number.isFinite(durationMinutes)) {
        throw new Error(`${label}: duration must be a number of minutes.`)
      }
      out.durationMinutes = durationMinutes
    }
    if (notes) out.notes = notes

    normalized.push(out)
  })

  return normalized.length > 0 ? normalized : null
}
