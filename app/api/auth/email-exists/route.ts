// app/api/auth/email-exists/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 })
    }

    // έλεγχος ύπαρξης στο athletes.email
    const { data, error } = await supabase
      .from('athletes')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error(error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ exists: !!data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
