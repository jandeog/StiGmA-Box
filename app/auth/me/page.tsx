import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'

export default async function MePage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <p>Not logged in.</p>
        <a href="/auth/login">Go to login</a>
      </div>
    )
  }

  return (
    <pre style={{ padding: 24 }}>{JSON.stringify(user, null, 2)}</pre>
  )
}
