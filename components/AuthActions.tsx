'use client'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

export default function AuthActions() {
  const supabase = createClientComponentClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return
      setUser(user ?? null)
      setLoading(false)
    })()

    // ακούει αλλαγές session (login/logout)
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      router.refresh()
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [supabase, router])

  if (loading) return null

  if (!user) {
    return (
      <a href="/auth/login" className="px-3 py-1 rounded-xl border">Sign in</a>
    )
  }

  return (
    <button
      className="px-3 py-1 rounded-xl border"
      onClick={async () => {
        await supabase.auth.signOut()
        router.refresh()
      }}
    >
      Sign out
    </button>
  )
}
