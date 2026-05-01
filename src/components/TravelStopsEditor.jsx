import { useState } from 'react'
import { blankStop, normalizeStopsForSave, stopsForJsonDraft, stopsToDraft } from './travelStops'

export default function TravelStopsEditor({ stops = [], onChange }) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [jsonMessage, setJsonMessage] = useState('')

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
  }

  const removeStop = (index) => {
    onChange(stops.filter((_, i) => i !== index))
  }

  const addStop = () => {
    onChange([...stops, blankStop()])
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

          {stops.map((stop, index) => (
            <div className="travel-stop-card" key={index}>
              <div className="travel-stop-header">
                <font face="Impact" size="3" color="#00FFFF">
                  STOP {index + 1}
                </font>
                <span className="travel-stops-actions">
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
            </div>
          ))}
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
