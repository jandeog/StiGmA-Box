import { cookies } from 'next/headers';
import { SIGNUP_EMAIL_COOKIE } from '@/lib/session';
import AddAthleteClient from './AddAthleteClient';

export default async function Page(props: PageProps<'/athletes/add'>) {
  const searchParams = await props.searchParams;
  const cookieStore = cookies();

  const cookieEmail = (cookieStore.get(SIGNUP_EMAIL_COOKIE)?.value || '')
    .trim()
    .toLowerCase();

  const queryEmail = ((searchParams.email as string | undefined) || '')
    .trim()
    .toLowerCase();

  const initialEmail = (queryEmail || cookieEmail).trim().toLowerCase();

  const redirect  = (searchParams.redirect as string | undefined) || '';
  const targetId  = (searchParams.id as string | undefined) || null;
  const createNew = (searchParams.new as string | undefined) === '1';

  // ✨ NEW: pass optional emergency seed values from query if present
  const initialEmRole  = (searchParams.emergency_name as string | undefined) || '';
  const initialEmPhone = (searchParams.emergency_phone as string | undefined) || '';

  return (
    <AddAthleteClient
      initialEmail={initialEmail}
      redirect={redirect}
      targetId={targetId}
      createNew={createNew}
      initialEmRole={initialEmRole}
      initialEmPhone={initialEmPhone}
    />
  );
}
