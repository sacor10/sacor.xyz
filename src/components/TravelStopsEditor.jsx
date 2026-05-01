import { useEffect, useRef, useState } from 'react'
import { blankStop, normalizeStopsForSave, stopsForJsonDraft, stopsToDraft } from './travelStops'
import { searchPlaces } from './geocode'

const initialViewMode = (stop) => {
  const hasLat = String(stop?.lat ?? '').trim() !== ''
  const hasLng = String(stop?.lng ?? '').trim() !== ''
  return hasLat && hasLng ? 'advanced' : 'finder'
}

const SEARCH_DEBOUNCE_MS = 300

/** Phantom id: omitting a matching <form> opts this finder field out of the itinerary save form (otherwise Enter / GET submits add "?"). */
const FIND_PLACE_FIELD_FORM_ID = '__noop_travel_stop_finder__'

function StopFinder({ onPick }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const abortRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(
    () => () => {
      if (abortRef.current) abortRef.current.abort()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    [],
  )

  const runSearch = async () => {
    const trimmed = query.trim()
    if (!trimmed) {
      setError('Enter a place name to search.')
      return
    }
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus('loading')
    setError('')
    setResults([])
    setSearched(true)
    try {
      const { results: nextResults } = await searchPlaces(trimmed, {
        signal: controller.signal,
        limit: 5,
      })
      if (abortRef.current !== controller) return
      setResults(nextResults)
      setStatus('done')
    } catch (err) {
      if (abortRef.current !== controller) return
      if (err?.name === 'AbortError') return
      setStatus('error')
      setError(err?.message || 'Search failed.')
    }
  }

  /** Nested <form> is invalid HTML and submits the itinerary parent <form>; use controls only. */
  const scheduleSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      runSearch()
    }, SEARCH_DEBOUNCE_MS)
  }

  const handleFinderSearchClick = (event) => {
    event.preventDefault()
    event.stopPropagation()
    scheduleSearch()
  }

  const handleFinderInputKeyDown = (event) => {
    const isEnter =
      event.key === 'Enter' ||
      event.key === 'NumpadEnter' ||
      event.code === 'Enter' ||
      event.code === 'NumpadEnter'
    if (!isEnter) return
    /* Let IME composition finish; phantom `form=` blocks the GET save-<form>. */
    if (event.isComposing || event.nativeEvent?.isComposing) return
    event.preventDefault()
    event.stopPropagation()
    scheduleSearch()
  }

  return (
    <div className="travel-stop-finder">
      <div className="travel-stop-finder-form">
        <label className="travel-label">
          <font face="Impact" size="2" color="#FFFF00">
            FIND A PLACE
          </font>
          <input
            type="text"
            value={query}
            maxLength={200}
            form={FIND_PLACE_FIELD_FORM_ID}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleFinderInputKeyDown}
            placeholder="e.g. Eiffel Tower, Paris"
          />
        </label>
        <span className="travel-stops-actions">
          <button
            type="button"
            className="mini-btn"
            disabled={status === 'loading'}
            onClick={handleFinderSearchClick}
          >
            {status === 'loading' ? 'SEARCHING…' : 'SEARCH'}
          </button>
        </span>
      </div>

      {error && (
        <div className="travel-error">
          <font face="Comic Sans MS" size="2" color="#FF00FF">
            {error}
          </font>
        </div>
      )}

      {status === 'loading' && (
        <div className="travel-note">
          <font face="Comic Sans MS" size="2" color="#FFFF00">
            Searching…
          </font>
        </div>
      )}

      {status === 'done' && results.length === 0 && searched && (
        <div className="travel-note">
          <font face="Comic Sans MS" size="2" color="#FFFFFF">
            No matches.
          </font>
        </div>
      )}

      {results.length > 0 && (
        <div className="travel-stop-finder-results">
          {results.map((result) => (
            <button
              type="button"
              className="travel-stop-finder-result"
              key={result.id}
              onClick={() => onPick(result)}
            >
              <span className="travel-stop-finder-result-name">{result.name}</span>
              {result.address && result.address.trim() !== String(result.name ?? '').trim() && (
                <span className="travel-stop-finder-result-sub">{result.address}</span>
              )}
            </button>
          ))}
          <div className="travel-stop-finder-attribution">
            <font face="Comic Sans MS" size="1" color="#C0C0C0">
              Results © OpenStreetMap contributors
            </font>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TravelStopsEditor({ stops = [], onChange }) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [jsonMessage, setJsonMessage] = useState('')
  const [viewModes, setViewModes] = useState(() => stops.map(initialViewMode))

  useEffect(() => {
    setViewModes((prev) => {
      if (prev.length === stops.length) return prev
      const next = stops.map((stop, i) => prev[i] ?? initialViewMode(stop))
      return next
    })
  }, [stops])

  const setViewModeAt = (index, mode) => {
    setViewModes((prev) => {
      const next = [...prev]
      while (next.length <= index) next.push('finder')
      next[index] = mode
      return next
    })
  }

  const updateStop = (index, field, value) => {
    onChange(stops.map((stop, i) => (i === index ? { ...stop, [field]: value } : stop)))
  }

  const moveStop = (index, direction) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= stops.length) return
    const next = [...stops]
    const [moved] = next.splice(index, 1)
    next.splice(nextIndex, 0, moved)
    onChange(next)
    setViewModes((prev) => {
      const nextModes = [...prev]
      while (nextModes.length < stops.length) nextModes.push('finder')
      const [movedMode] = nextModes.splice(index, 1)
      nextModes.splice(nextIndex, 0, movedMode)
      return nextModes
    })
  }

  const removeStop = (index) => {
    onChange(stops.filter((_, i) => i !== index))
    setViewModes((prev) => prev.filter((_, i) => i !== index))
  }

  const addStop = () => {
    onChange([...stops, blankStop()])
    setViewModes((prev) => [...prev, 'finder'])
  }

  const handlePickPlace = (index, result) => {
    const lat = Number(result?.lat)
    const lng = Number(result?.lng)
    const name = String(result?.name ?? '').trim()
    onChange(
      stops.map((stop, i) => {
        if (i !== index) return stop
        return {
          ...stop,
          name: name || stop.name,
          lat: Number.isFinite(lat) ? String(lat) : stop.lat,
          lng: Number.isFinite(lng) ? String(lng) : stop.lng,
        }
      }),
    )
    setViewModeAt(index, 'advanced')
  }

  const toggleAdvanced = () => {
    setJsonError('')
    setJsonMessage('')
    if (!advancedOpen) setJsonText(JSON.stringify(stopsForJsonDraft(stops), null, 2))
    setAdvancedOpen(!advancedOpen)
  }

  const applyJson = () => {
    setJsonError('')
    setJsonMessage('')
    let parsed
    try {
      parsed = JSON.parse(jsonText)
    } catch (err) {
      setJsonError(`Invalid stops JSON: ${err.message}`)
      return
    }
    if (!Array.isArray(parsed)) {
      setJsonError('Stops JSON must be an array.')
      return
    }
    const draftStops = stopsToDraft(parsed)
    try {
      const normalizedStops = normalizeStopsForSave(draftStops)
      const nextStops = stopsToDraft(normalizedStops || [])
      setJsonText(JSON.stringify(normalizedStops || [], null, 2))
      onChange(nextStops)
      setViewModes(nextStops.map(initialViewMode))
      setJsonMessage(`Applied ${nextStops.length} stop${nextStops.length === 1 ? '' : 's'}.`)
    } catch (err) {
      setJsonError(err.message)
      return
    }
  }

  return (
    <div className="travel-stops-editor">
      <div className="travel-stops-toolbar">
        <font face="Impact" size="3" color="#FFFF00">
          STOPS
        </font>
        <span className="travel-stops-actions">
          {!advancedOpen && (
            <button type="button" className="mini-btn" onClick={addStop}>
              ADD STOP
            </button>
          )}
          <button type="button" className="mini-btn" onClick={toggleAdvanced}>
            {advancedOpen ? 'VALUE EDITOR' : 'ADVANCED JSON'}
          </button>
        </span>
      </div>

      {!advancedOpen && (
        <>
          {stops.length === 0 && (
            <div className="travel-note">
              <font face="Comic Sans MS" size="2" color="#FFFFFF">
                No map stops yet.
              </font>
            </div>
          )}

          {stops.map((stop, index) => {
            const viewMode = viewModes[index] ?? initialViewMode(stop)
            const isFinder = viewMode === 'finder'
            return (
              <div className="travel-stop-card" key={index}>
                <div className="travel-stop-header">
                  <font face="Impact" size="3" color="#00FFFF">
                    STOP {index + 1}
                  </font>
                  <span className="travel-stops-actions">
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() => setViewModeAt(index, isFinder ? 'advanced' : 'finder')}
                    >
                      {isFinder ? 'ADVANCED' : 'FINDER'}
                    </button>
                    <button type="button" className="mini-btn" onClick={() => moveStop(index, -1)} disabled={index === 0}>
                      UP
                    </button>
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() => moveStop(index, 1)}
                      disabled={index === stops.length - 1}
                    >
                      DOWN
                    </button>
                    <button type="button" className="mini-btn" onClick={() => removeStop(index)}>
                      REMOVE
                    </button>
                  </span>
                </div>

                {isFinder ? (
                  <StopFinder onPick={(result) => handlePickPlace(index, result)} />
                ) : (
                  <>
                    <label className="travel-label">
                      <font face="Impact" size="2" color="#FFFF00">
                        NAME
                      </font>
                      <input
                        type="text"
                        value={stop.name}
                        maxLength={200}
                        onChange={(e) => updateStop(index, 'name', e.target.value)}
                        placeholder="e.g. Golden Gate Bridge"
                      />
                    </label>

                    <div className="travel-stop-grid">
                      <label className="travel-label">
                        <font face="Impact" size="2" color="#FFFF00">
                          LATITUDE
                        </font>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={stop.lat}
                          onChange={(e) => updateStop(index, 'lat', e.target.value)}
                          placeholder="37.8199"
                        />
                      </label>
                      <label className="travel-label">
                        <font face="Impact" size="2" color="#FFFF00">
                          LONGITUDE
                        </font>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={stop.lng}
                          onChange={(e) => updateStop(index, 'lng', e.target.value)}
                          placeholder="-122.4783"
                        />
                      </label>
                    </div>

                    <div className="travel-stop-grid">
                      <label className="travel-label">
                        <font face="Impact" size="2" color="#FFFF00">
                          ARRIVAL TIME
                        </font>
                        <input
                          type="text"
                          value={stop.arrivalTime}
                          maxLength={50}
                          onChange={(e) => updateStop(index, 'arrivalTime', e.target.value)}
                          placeholder="9:30 AM"
                        />
                      </label>
                      <label className="travel-label">
                        <font face="Impact" size="2" color="#FFFF00">
                          DURATION MINUTES
                        </font>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={stop.durationMinutes}
                          onChange={(e) => updateStop(index, 'durationMinutes', e.target.value)}
                          placeholder="60"
                        />
                      </label>
                    </div>

                    <label className="travel-label">
                      <font face="Impact" size="2" color="#FFFF00">
                        NOTES
                      </font>
                      <textarea
                        value={stop.notes}
                        rows={3}
                        maxLength={1000}
                        onChange={(e) => updateStop(index, 'notes', e.target.value)}
                        placeholder="Reservation details, tickets, or why this stop matters..."
                      />
                    </label>
                  </>
                )}
              </div>
            )
          })}
        </>
      )}

      {advancedOpen && (
        <div className="travel-stops-json">
          <label className="travel-label">
            <font face="Impact" size="3" color="#FFFF00">
              ADVANCED STOPS JSON
            </font>
            <textarea
              value={jsonText}
              rows={8}
              onChange={(e) => {
                setJsonText(e.target.value)
                setJsonError('')
                setJsonMessage('')
              }}
              placeholder='[{"name":"...","lat":37.78,"lng":-122.4}]'
            />
          </label>
          <center>
            <button type="button" className="dl-btn" onClick={applyJson}>
              APPLY JSON
            </button>
          </center>
          {jsonError && (
            <div className="travel-error">
              <font face="Comic Sans MS" size="2" color="#FF00FF">
                {jsonError}
              </font>
            </div>
          )}
          {jsonMessage && (
            <div className="travel-note">
              <font face="Comic Sans MS" size="2" color="#FFFF00">
                {jsonMessage}
              </font>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
