import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function POST(req: Request) {
  const { email, code } = await req.json()
  const supabase = createRouteHandlerClient({ cookies })

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'email', // email OTP
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Με το createRouteHandlerClient({ cookies }) τα Set-Cookie μπαίνουν αυτόματα.
  return NextResponse.json({ ok: true, user: data.user })
}
