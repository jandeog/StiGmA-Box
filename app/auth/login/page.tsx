'use client'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const sendOtp = async () => {
    setMsg(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to send OTP')
      setSent(true)
      setMsg('Κωδικός στάλθηκε στο email')
    } catch (err:any) {
      setMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  const verify = async () => {
    setMsg(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Invalid code')
      setMsg('Επιτυχής σύνδεση')
      // Μετά το Set-Cookie, πήγαινε στο /auth/me (server θα δει το cookie)
      location.assign('/auth/me')
    } catch (err:any) {
      setMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Login</h2>

      <input
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email"
        className="border px-2 py-1 rounded mr-2 w-[480px] max-w-full"
        type="email"
        autoComplete="email"
      />
      <button onClick={sendOtp} disabled={loading || !email} className="border px-3 py-1 rounded">
        {loading ? '...' : 'Send code'}
      </button>

      {sent && (
        <div style={{ marginTop: 12 }}>
          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="6-digit code"
            className="border px-2 py-1 rounded mr-2"
            inputMode="numeric"
            maxLength={6}
          />
          <button onClick={verify} disabled={loading || code.length !== 6} className="border px-3 py-1 rounded">
            {loading ? '...' : 'Verify'}
          </button>
        </div>
      )}

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  )
}
