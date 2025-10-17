import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    const supabase = createRouteHandlerClient({ cookies })

    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) {
      // ΕΠΙΣΤΡΕΦΩ όλο το μήνυμα για να το δούμε στο UI
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown server error' }, { status: 500 })
  }
}
