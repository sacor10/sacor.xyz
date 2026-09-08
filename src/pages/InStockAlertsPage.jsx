import { useCallback, useEffect, useState } from 'react'
import Layout from '../Layout'
import HitCounter from '../components/HitCounter'
import { useAuth } from '../auth/useAuth'

const API = '/.netlify/functions/in-stock-alerts'

const STATUS_STYLE = {
  in_stock: { label: '★ IN STOCK!', color: '#00FF00' },
  out_of_stock: { label: 'SOLD OUT', color: '#FF00FF' },
  unknown: { label: 'UNKNOWN', color: '#00FFFF' },
  error: { label: '⚠ ERROR', color: '#FF0000' },
}

const CARRIER_LABELS = {
  att: 'AT&T',
  boost: 'Boost',
  consumercellular: 'Consumer Cellular',
  cricket: 'Cricket',
  googlefi: 'Google Fi',
  metropcs: 'Metro by T-Mobile',
  mint: 'Mint Mobile',
  sprint: 'Sprint',
  ting: 'Ting',
  tmobile: 'T-Mobile',
  uscellular: 'US Cellular',
  verizon: 'Verizon',
  visible: 'Visible',
  xfinity: 'Xfinity Mobile',
}

const MODE_LABELS = {
  auto: 'Auto-detect',
  contains: 'In stock when page CONTAINS',
  absent: 'In stock when page LACKS',
}

const inputStyle = {
  fontFamily: 'Courier New, monospace',
  fontSize: '13px',
  background: '#000',
  color: '#00FF00',
  border: '2px inset #00FF00',
  padding: '2px 6px',
}

const formatWhen = (iso) => {
  if (!iso) return 'never'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

const countdown = (iso) => {
  if (!iso) return 'any moment'
  const ms = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(ms)) return 'any moment'
  if (ms <= 0) return 'any moment'
  return `in ~${Math.max(1, Math.round(ms / 60000))} min`
}

// A blank row the user fills in; the server assigns the real id on save.
const blankWatch = () => ({
  id: `new-${Math.random().toString(36).slice(2, 10)}`,
  label: '',
  url: '',
  enabled: true,
  match: { mode: 'auto', text: '' },
  notifyEmail: true,
  notifySms: true,
  status: 'unknown',
  statusReason: 'Not saved yet',
  lastCheckedAt: null,
  lastInStockAt: null,
  nextCheckAt: null,
})

function GatedMessage({ loading }) {
  return (
    <table width="100%" cellPadding="14" cellSpacing="0" border="0" className="postbox" bgcolor="#000000">
      <tbody>
        <tr>
          <td align="center">
            <font face="Impact" size="5" color="#FF00FF">
              ~ SIGN IN TO SET UP ALERTS ~
            </font>
            <br />
            <br />
            <font face="Comic Sans MS" size="3" color="#FFFFFF">
              {loading
                ? 'checking your session...'
                : 'Sign in with Google in the top banner to watch product pages and get an email + text the moment one comes back in stock.'}
            </font>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function Sidebar() {
  return (
    <>
      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#000080">
        <tbody>
          <tr>
            <td align="center" bgcolor="#FFFF00" className="section-bar-sm">
              <font face="Impact" size="4" color="#000000">~ HOW IT WORKS ~</font>
            </td>
          </tr>
          <tr>
            <td bgcolor="#000000">
              <font face="Comic Sans MS" size="2" color="#00FFFF">
                <b className="yellow">1.</b> Paste a product page URL.
                <br />
                <b className="yellow">2.</b> A robot fetches it every{' '}
                <b className="lime">2&ndash;5 minutes</b>, at a random
                interval so it never looks like a metronome.
                <br />
                <b className="yellow">3.</b> The moment the page flips from sold out to
                buyable, you get an <b className="lime">email</b> and a{' '}
                <b className="lime">text</b>.
                <br />
                <br />
                <font color="#FF00FF">
                  One alert per page per 6 hours, so a flaky storefront cannot spam you.
                </font>
              </font>
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <HitCounter />

      <br />

      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#4B0082">
        <tbody>
          <tr>
            <td align="center" bgcolor="#FF00FF" className="section-bar-sm">
              <font face="Impact" size="4" color="#FFFF00">~ FINE PRINT ~</font>
            </td>
          </tr>
          <tr>
            <td bgcolor="#000000">
              <marquee behavior="scroll" direction="left" scrollamount="4">
                <font face="Impact" size="3" color="#FFFF00">
                  &#9888; STOCK DETECTION IS BEST-EFFORT &#9888; ALWAYS CONFIRM ON THE SITE &#9888;
                </font>
              </marquee>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

function ContactPanel({ config, capabilities, onChange }) {
  const carriers = capabilities?.carriers ?? []
  const twilio = !!capabilities?.twilio

  return (
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#000000">
      <tbody>
        <tr>
          <td bgcolor="#000000">
            <font face="Courier New" size="2" color="#00FF00">EMAIL:&nbsp;</font>
            <input
              type="email"
              value={config.email}
              size={28}
              maxLength={254}
              style={inputStyle}
              onChange={(e) => onChange({ email: e.target.value })}
            />
            <br />
            <br />
            <font face="Courier New" size="2" color="#00FF00">PHONE:&nbsp;</font>
            <input
              type="tel"
              value={config.phone}
              size={16}
              maxLength={20}
              placeholder="555-123-4567"
              style={inputStyle}
              onChange={(e) => onChange({ phone: e.target.value })}
            />
            {!twilio && (
              <>
                &nbsp;
                <font face="Courier New" size="2" color="#00FF00">CARRIER:&nbsp;</font>
                <select
                  value={config.carrier}
                  style={inputStyle}
                  onChange={(e) => onChange({ carrier: e.target.value })}
                >
                  <option value="">-- pick one --</option>
                  {carriers.map((key) => (
                    <option key={key} value={key}>{CARRIER_LABELS[key] ?? key}</option>
                  ))}
                </select>
              </>
            )}
            <br />
            <br />
            <font face="Comic Sans MS" size="2" color="#FFFFFF">
              {twilio
                ? 'Texts are sent through Twilio.'
                : 'Texts are sent through your carrier’s free email-to-SMS gateway, so the carrier is required. Leave the phone blank for email-only alerts.'}
            </font>
            {capabilities && !capabilities.email && (
              <>
                <br />
                <font face="Comic Sans MS" size="2" color="#FF0000">
                  &#9888; The server has no email sender configured (RESEND_API_KEY /
                  RESEND_FROM_EMAIL), so nothing can be delivered yet.
                </font>
              </>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function WatchRow({ watch, dirty, checking, onChange, onRemove, onCheckNow }) {
  const style = STATUS_STYLE[watch.status] ?? STATUS_STYLE.unknown
  const isNew = watch.id.startsWith('new-')

  return (
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#000000">
      <tbody>
        <tr>
          <td align="center" bgcolor={watch.status === 'in_stock' ? '#008000' : '#2E0854'} className="section-bar-sm">
            <font face="Impact" size="3" color={style.color}>
              {watch.status === 'in_stock' ? <span className="blink">{style.label}</span> : style.label}
            </font>
          </td>
        </tr>
        <tr>
          <td bgcolor="#000000">
            <font face="Courier New" size="2" color="#00FF00">NAME:&nbsp;</font>
            <input
              value={watch.label}
              size={28}
              maxLength={80}
              placeholder="Zelda 40th Anniversary Bundle"
              style={inputStyle}
              onChange={(e) => onChange({ label: e.target.value })}
            />
            <br />
            <br />
            <font face="Courier New" size="2" color="#00FF00">URL:&nbsp;</font>
            <input
              value={watch.url}
              size={48}
              maxLength={500}
              placeholder="https://www.example.com/product/thing"
              style={inputStyle}
              onChange={(e) => onChange({ url: e.target.value })}
            />
            <br />
            <br />
            <font face="Courier New" size="2" color="#00FF00">RULE:&nbsp;</font>
            <select
              value={watch.match.mode}
              style={inputStyle}
              onChange={(e) => onChange({ match: { mode: e.target.value, text: watch.match.text } })}
            >
              {Object.entries(MODE_LABELS).map(([mode, label]) => (
                <option key={mode} value={mode}>{label}</option>
              ))}
            </select>
            {watch.match.mode !== 'auto' && (
              <>
                &nbsp;
                <input
                  value={watch.match.text}
                  size={24}
                  maxLength={200}
                  placeholder="Add to Cart"
                  style={inputStyle}
                  onChange={(e) => onChange({ match: { mode: watch.match.mode, text: e.target.value } })}
                />
              </>
            )}
            <br />
            <br />
            <font face="Comic Sans MS" size="2" color="#FFFFFF">
              <label>
                <input
                  type="checkbox"
                  checked={watch.enabled}
                  onChange={(e) => onChange({ enabled: e.target.checked })}
                />
                {' '}watching
              </label>
              &nbsp;&nbsp;
              <label>
                <input
                  type="checkbox"
                  checked={watch.notifyEmail}
                  onChange={(e) => onChange({ notifyEmail: e.target.checked })}
                />
                {' '}email me
              </label>
              &nbsp;&nbsp;
              <label>
                <input
                  type="checkbox"
                  checked={watch.notifySms}
                  onChange={(e) => onChange({ notifySms: e.target.checked })}
                />
                {' '}text me
              </label>
            </font>
            <br />
            <br />
            <font face="Comic Sans MS" size="2" color="#FFFF00">
              {watch.statusReason || 'Not checked yet'}
            </font>
            <br />
            <font face="Comic Sans MS" size="1" color="#AAAAAA">
              last checked {formatWhen(watch.lastCheckedAt)}
              {watch.enabled && !isNew ? ` ★ next check ${countdown(watch.nextCheckAt)}` : ''}
              {watch.lastInStockAt ? ` ★ last seen in stock ${formatWhen(watch.lastInStockAt)}` : ''}
            </font>
            <br />
            <br />
            <button
              type="button"
              className="navbtn-link"
              style={{ cursor: dirty || isNew || checking ? 'default' : 'pointer' }}
              disabled={dirty || isNew || checking}
              onClick={onCheckNow}
              title={dirty || isNew ? 'Save your changes first' : 'Fetch the page right now'}
            >
              {checking ? '★ CHECKING... ★' : '★ CHECK NOW ★'}
            </button>
            &nbsp;
            <a href={watch.url || '#'} target="_blank" rel="noopener noreferrer" className="navbtn-link">
              &#9733; OPEN PAGE &#9733;
            </a>
            &nbsp;
            <button type="button" className="navbtn-link" style={{ cursor: 'pointer' }} onClick={onRemove}>
              &#10005; REMOVE
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function AlertsManager() {
  const [config, setConfig] = useState(null)
  const [capabilities, setCapabilities] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checkingId, setCheckingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const applyResponse = useCallback((data) => {
    const { capabilities: caps, ...rest } = data
    setCapabilities(caps ?? null)
    setConfig(rest)
    setDirty(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(API, { credentials: 'same-origin' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body?.error || `Load failed (${res.status})`)
        return body
      })
      .then((data) => {
        if (!cancelled) applyResponse(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load your alerts.')
      })
    return () => {
      cancelled = true
    }
  }, [applyResponse])

  const patchConfig = (patch) => {
    setConfig((current) => ({ ...current, ...patch }))
    setDirty(true)
    setNotice('')
  }

  const patchWatch = (id, patch) => {
    setConfig((current) => ({
      ...current,
      watches: current.watches.map((watch) => (watch.id === id ? { ...watch, ...patch } : watch)),
    }))
    setDirty(true)
    setNotice('')
  }

  const removeWatch = (id) => {
    setConfig((current) => ({ ...current, watches: current.watches.filter((watch) => watch.id !== id) }))
    setDirty(true)
    setNotice('')
  }

  const addWatch = () => {
    setConfig((current) => ({ ...current, watches: [...current.watches, blankWatch()] }))
    setDirty(true)
    setNotice('')
  }

  const save = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: config.email,
          phone: config.phone,
          carrier: config.carrier,
          watches: config.watches.map((watch) => ({
            id: watch.id.startsWith('new-') ? undefined : watch.id,
            label: watch.label,
            url: watch.url,
            enabled: watch.enabled,
            match: watch.match,
            notifyEmail: watch.notifyEmail,
            notifySms: watch.notifySms,
          })),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || `Save failed (${res.status})`)
      applyResponse(body)
      setNotice('Saved. The watcher takes it from here.')
    } catch (err) {
      setError(err.message || 'Could not save your alerts.')
    } finally {
      setSaving(false)
    }
  }

  const checkNow = async (id) => {
    setCheckingId(id)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`${API}?check=${encodeURIComponent(id)}`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || `Check failed (${res.status})`)
      applyResponse(body)
    } catch (err) {
      setError(err.message || 'Could not check that page.')
    } finally {
      setCheckingId('')
    }
  }

  if (!config) {
    return (
      <center>
        <font face="Impact" size="4" color="#00FFFF">
          {error ? <font color="#FF0000">&#9888; {error}</font> : <span className="blink">~ LOADING YOUR ALERTS ~</span>}
        </font>
      </center>
    )
  }

  return (
    <>
      <center>
        <table width="100%" cellPadding="0" cellSpacing="0" border="0">
          <tbody>
            <tr>
              <td align="center" bgcolor="#FFFF00" className="section-bar">
                <font face="Impact" size="5" color="#000000">~ WHERE TO REACH YOU ~</font>
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />

      <ContactPanel config={config} capabilities={capabilities} onChange={patchConfig} />

      <br />

      <center>
        <table width="100%" cellPadding="0" cellSpacing="0" border="0">
          <tbody>
            <tr>
              <td align="center" bgcolor="#FF00FF" className="section-bar">
                <font face="Impact" size="5" color="#FFFF00">
                  ~ WATCHED PAGES ({config.watches.length}
                  {capabilities?.maxWatches ? `/${capabilities.maxWatches}` : ''}) ~
                </font>
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />

      {config.watches.length === 0 && (
        <center>
          <font face="Comic Sans MS" size="3" color="#FFFFFF">
            Nothing watched yet. Add a product page below.
          </font>
          <br />
          <br />
        </center>
      )}

      {config.watches.map((watch) => (
        <div key={watch.id}>
          <WatchRow
            watch={watch}
            dirty={dirty}
            checking={checkingId === watch.id}
            onChange={(patch) => patchWatch(watch.id, patch)}
            onRemove={() => removeWatch(watch.id)}
            onCheckNow={() => checkNow(watch.id)}
          />
          <br />
        </div>
      ))}

      <center>
        <button
          type="button"
          className="navbtn-link"
          style={{ cursor: 'pointer' }}
          disabled={!!capabilities?.maxWatches && config.watches.length >= capabilities.maxWatches}
          onClick={addWatch}
        >
          &#9733; ADD A PAGE &#9733;
        </button>
        &nbsp;&nbsp;
        <button
          type="button"
          className="navbtn-link"
          style={{ cursor: saving || !dirty ? 'default' : 'pointer' }}
          disabled={saving || !dirty}
          onClick={save}
        >
          {saving ? '★ SAVING... ★' : '★ SAVE ALERTS ★'}
        </button>
        <br />
        <br />
        {error && <font face="Comic Sans MS" size="2" color="#FF0000">&#9888; {error}</font>}
        {!error && notice && <font face="Comic Sans MS" size="2" color="#00FF00">{notice}</font>}
        {!error && !notice && dirty && (
          <font face="Comic Sans MS" size="2" color="#FFFF00">
            Unsaved changes &mdash; hit SAVE ALERTS to arm them.
          </font>
        )}
      </center>

      <br />

      <center>
        <table width="100%" cellPadding="0" cellSpacing="0" border="0">
          <tbody>
            <tr>
              <td align="center" bgcolor="#00FFFF" className="section-bar">
                <font face="Impact" size="5" color="#000000">~ ALERT HISTORY ~</font>
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />

      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#000000">
        <tbody>
          {config.events.length === 0 ? (
            <tr>
              <td align="center" bgcolor="#000000">
                <font face="Comic Sans MS" size="2" color="#FFFFFF">
                  No alerts sent yet. That is a good sign &mdash; it means nothing has dropped
                  behind your back.
                </font>
              </td>
            </tr>
          ) : (
            config.events.map((event) => (
              <tr key={event.id}>
                <td bgcolor="#000000">
                  <font face="Courier New" size="2" color="#00FF00">
                    {formatWhen(event.at)}
                  </font>
                  <br />
                  <font face="Comic Sans MS" size="2" color="#FFFF00">
                    <b>{event.label}</b> &mdash; sent via{' '}
                    {event.channels.length > 0 ? event.channels.join(' + ') : 'nothing (delivery failed)'}
                  </font>
                  <br />
                  <font face="Comic Sans MS" size="1" color="#AAAAAA">{event.detail}</font>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  )
}

export default function InStockAlertsPage() {
  const { loading, isSignedIn } = useAuth()

  const mainContent = (
    <>
      <center>
        <font face="Impact" size="6" color="#00FFFF" className="hero-glow">
          ~*~ IN-STOCK ALERTS ~*~
        </font>
        <br />
        <font face="Comic Sans MS" size="3" color="#FFFF00">
          <span className="blink">~ a robot that refreshes the page so you don&rsquo;t have to ~</span>
        </font>
      </center>

      <br />

      <font face="Comic Sans MS" size="3" color="#FFFFFF">
        <font color="#FFFF00">&#9733;</font> Point this at any product page. Every couple of
        minutes it quietly fetches the page, reads the store&rsquo;s own availability data, and
        the second something flips from <b className="hotpink">SOLD OUT</b> to{' '}
        <b className="lime">BUYABLE</b> it emails and texts you.{' '}
        <font color="#FFFF00">&#9733;</font>
      </font>

      <br />
      <br />

      {isSignedIn ? <AlertsManager /> : <GatedMessage loading={loading} />}

      <br />
    </>
  )

  return <Layout mainContent={mainContent} rightSidebar={<Sidebar />} />
}
