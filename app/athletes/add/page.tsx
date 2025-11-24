import { cookies } from 'next/headers';
import { SIGNUP_EMAIL_COOKIE } from '@/lib/session';
import AddAthleteClient from './AddAthleteClient';

export default async function Page(props: PageProps<'/athletes/add'>) {
  const searchParams = await props.searchParams;
  const cookieStore = await cookies();

 const cookieEmail = (cookieStore.get(SIGNUP_EMAIL_COOKIE)?.value || '')
  .trim()
  .toLowerCase();

const queryEmail = ((searchParams.email as string | undefined) || '')
  .trim()
  .toLowerCase();

const redirect  = (searchParams.redirect as string | undefined) || '';
const targetId  = (searchParams.id as string | undefined) || null;
const createNew = (searchParams.new as string | undefined) === '1';

// 👉 If coach is hitting ?new=1, we **do not** seed email from cookies
const initialEmail = createNew
  ? ''
  : (queryEmail || cookieEmail).trim().toLowerCase();


  // ✨ NEW: pass optional emergency seed values from query if present
  const initialEmRole  = (searchParams.emergency_role  as string | undefined) || '';
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
