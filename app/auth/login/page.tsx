'use client'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const sendOtp = async () => {
    setMsg(null)
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
    if (!res.ok) {
      const { error } = await res.json()
      setMsg(error || 'Failed to send OTP')
      return
    }
    setSent(true)
    setMsg('Κωδικός στάλθηκε στο email')
  }

  const verify = async () => {
    setMsg(null)
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    })
    const json = await res.json()
    if (!res.ok) {
      setMsg(json.error || 'Invalid code')
      return
    }
    setMsg('Επιτυχής σύνδεση')
    // Μετά το Set-Cookie, κάνε refresh για να δει ο server το session
    location.assign('/auth/me')
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Login</h2>

      <input value={email} onChange={e => setEmail(e.target.value)}
             placeholder="Email" className="border px-2 py-1 rounded mr-2" />
      <button onClick={sendOtp} className="border px-3 py-1 rounded">Send code</button>

      {sent && (
        <div style={{ marginTop: 12 }}>
          <input value={code} onChange={e => setCode(e.target.value)}
                 placeholder="6-digit code" className="border px-2 py-1 rounded mr-2" />
          <button onClick={verify} className="border px-3 py-1 rounded">Verify</button>
        </div>
      )}

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  )
}
