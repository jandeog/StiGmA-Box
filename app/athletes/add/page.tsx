import { cookies } from 'next/headers';
import { SIGNUP_EMAIL_COOKIE } from '@/lib/session';
import AddAthleteClient from './AddAthleteClient';

export default async function Page(props: PageProps<'/athletes/add'>) {
  const searchParams = await props.searchParams;

  const cookieStore = cookies();
  const cookieEmail =
    (cookieStore.get(SIGNUP_EMAIL_COOKIE)?.value || '').trim().toLowerCase();

  const queryEmail = ((searchParams.email as string) || '').trim().toLowerCase();
  const initialEmail = (queryEmail || cookieEmail).trim().toLowerCase();

  const redirect = (searchParams.redirect as string) || '';
  const targetId = (searchParams.id as string) || null;
  const createNew = (searchParams.new as string) === '1';

  return (
    <AddAthleteClient
      initialEmail={initialEmail}
      redirect={redirect}
      targetId={targetId}
      createNew={createNew}
    />
  );
}
