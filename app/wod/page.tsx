// app/wod/page.tsx
'use client';

import { useEffect, useState } from 'react';
import DateStepper from '@/components/DateStepper';
import { supabase } from '@/lib/supabaseClient';

type ScoringType = 'for_time' | 'amrap' | 'emom';

type StrengthPart = {
  title: string;
  description: string;
  scoreHint: string;
  recordScore: boolean;
};

type WOD = {
  // Η ημερομηνία κρατιέται ξεχωριστά (string YYYY-MM-DD)
  strength: StrengthPart;
  title: string;
  description: string;
  scoring: ScoringType;
  timeCap: string;
  recordMainScore: boolean; // ΝΕΟ: στήλη στη βάση
};

// ===== Helpers =====
const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const fmtDDMMYYYY = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
};

// Παράγει ISO timestamptz για 00:00:00 Europe/Athens (αρκεί για πρακτική χρήση)
// Αν θέλεις πλήρη ακρίβεια σε DST, μπορώ να το γυρίσω σε Temporal polyfill.
const toAthensMidnightISO = (yyyy_mm_dd: string) => {
  // Οκτώβριος 2025: UTC+3. Αν κινείσαι όλο τον χρόνο, προτίμησε Temporal/ZonedDateTime.
  const iso = new Date(`${yyyy_mm_dd}T00:00:00+03:00`).toISOString();
  return iso;
};

const defaultWOD = (): WOD => ({
  strength: { title: '', description: '', scoreHint: '', recordScore: false },
  title: '',
  description: '',
  scoring: 'for_time',
  timeCap: '',
  recordMainScore: true,
});

export default function WodPage() {
  // Ημερομηνία ανεξάρτητη από το περιεχόμενο
  const [date, setDate] = useState(todayStr());

  // Περιεχόμενο WOD για την επιλεγμένη ημερομηνία
  const [wod, setWod] = useState<WOD>(defaultWOD());

  const [savedMsg, setSavedMsg] = useState('');
  const [locked, setLocked] = useState(false); // Αν θέλεις να κλειδώνει όταν υπάρχει ήδη

  // Κοινή κλάση για inputs
  const field =
    'w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm field-muted ' +
    'focus:ring-2 focus:ring-zinc-700/50 focus:outline-none shadow-sm';

  // ===== Load από Supabase όταν αλλάζει η μέρα =====
  useEffect(() => {
    let isMounted = true;

    (async () => {
      setSavedMsg('');
      setLocked(false);

      const atMidnight = toAthensMidnightISO(date);

      const { data, error } = await supabase
        .from('Wod')
        .select(
          'title, description, scoring, timeCap, strengthTitle, strengthDescription, strengthScoreHint, strengthRecordScore, recordMainScore'
        )
        .eq('date', atMidnight)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        console.error('[WOD load error]', error);
        setWod(defaultWOD());
        return;
      }

      if (data) {
        // Υπάρχει WOD για τη μέρα — γέμισμα φόρμας
        setWod({
          strength: {
            title: data.strengthTitle ?? '',
            description: data.strengthDescription ?? '',
            scoreHint: data.strengthScoreHint ?? '',
            recordScore: !!data.strengthRecordScore,
          },
          title: data.title ?? '',
          description: data.description ?? '',
          scoring: (data.scoring as ScoringType) ?? 'for_time',
          timeCap: data.timeCap ?? '',
          recordMainScore: data.recordMainScore ?? true,
        });
        // Αν θέλεις να "κλειδώνει" όταν έχει ήδη αποθηκευτεί:
        // setLocked(true);
      } else {
        // Δεν υπάρχει καταχώρηση — καθαρή φόρμα
        setWod(defaultWOD());
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [date]);

  // ===== Save/Upsert στο Supabase =====
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!wod.title.trim()) {
      setSavedMsg('⚠️ Πρόσθεσε τίτλο για το Main WOD');
      return;
    }
// μέσα στη handleSubmit, πριν το upsert:
const { data: { user }, error: uerr } = await supabase.auth.getUser();
if (!user) {
  setSavedMsg('⚠️ Πρέπει να είσαι συνδεδεμένος για να κάνεις Save.');
  console.log('[AUTH USER] NULL', uerr ?? null);
  return;
}
// ακόμα μέσα στη handleSubmit, αμέσως μετά το getUser()
const { data: sess, error: serr } = await supabase.auth.getSession();
console.log('[AUTH SESSION EXISTS]', !!sess.session, serr ?? null);

const token = sess.session?.access_token;
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  console.log('[JWT ROLE]', payload.role); // περιμένουμε "authenticated"
} else {
  console.log('[JWT ROLE] NO TOKEN');
}

console.log('[AUTH USER]', user.id);

    const atMidnight = toAthensMidnightISO(date);

    const row = {
      // id: αφήνουμε το default στη βάση (gen_random_uuid()) — δες το alter table
      date: atMidnight,
      title: wod.title,
      description: wod.description,
      scoring: wod.scoring,
      timeCap: wod.timeCap || null,
      strengthTitle: wod.strength.title || null,
      strengthDescription: wod.strength.description || null,
      strengthScoreHint: wod.strength.scoreHint || null,
      strengthRecordScore: wod.strength.recordScore,
      recordMainScore: wod.recordMainScore,
    };

    const { error } = await supabase.from('Wod').upsert(row, {
      onConflict: 'date', // unique constraint στη βάση
    });

    if (error) {
      console.error('[WOD save error]', error);
 setSavedMsg(`❌ Save failed: ${error.message}${error.details ? ' — ' + error.details : ''}`);      return;
    }

    setSavedMsg('✅ Αποθηκεύτηκε στη βάση για αυτή την ημερομηνία');
    setTimeout(() => setSavedMsg(''), 1600);
    // setLocked(true);
  };

  return (
    <section className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">WOD</h1>

      {/* Date — standalone and ENABLED */}
      <div className="flex items-center gap-3">
        <div className="text-sm text-zinc-400">Date</div>
        <DateStepper value={date} onChange={setDate} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Strength / Skills */}
        <h2 className="text-lg font-semibold">Strength / Skills</h2>
        <div className="border border-zinc-800 rounded p-3 bg-zinc-900">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1 text-zinc-300">Title</label>
              <input
                disabled={locked}
                value={wod.strength.title}
                onChange={(e) =>
                  setWod((s) => ({
                    ...s,
                    strength: { ...s.strength, title: e.target.value },
                  }))
                }
                placeholder="e.g. Back Squat"
                className={field}
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-zinc-300">
                Score (hint)
              </label>
              <input
                disabled={locked}
                value={wod.strength.scoreHint}
                onChange={(e) =>
                  setWod((s) => ({
                    ...s,
                    strength: { ...s.strength, scoreHint: e.target.value },
                  }))
                }
                placeholder="e.g. 5x5 @kg or EMOM 10’"
                className={field}
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-sm mb-1 text-zinc-300">
              Description
            </label>
            <textarea
              disabled={locked}
              rows={5}
              value={wod.strength.description}
              onChange={(e) =>
                setWod((s) => ({
                  ...s,
                  strength: { ...s.strength, description: e.target.value },
                }))
              }
              placeholder="Sets, reps, tempo, rest, cues…"
              className={field}
            />
          </div>

          <div className="mt-3 inline-flex items-center gap-2">
            <input
              disabled={locked}
              id="strength-record"
              type="checkbox"
              checked={wod.strength.recordScore}
              onChange={(e) =>
                setWod((s) => ({
                  ...s,
                  strength: {
                    ...s.strength,
                    recordScore: e.target.checked,
                  },
                }))
              }
              className="h-4 w-4 accent-zinc-200"
            />
            <label
              htmlFor="strength-record"
              className="text-sm text-zinc-300 whitespace-nowrap"
            >
              Record score for Strength / Skills
            </label>
          </div>
        </div>

        {/* Main WOD */}
        <h2 className="text-lg font-semibold">Main WOD</h2>
        <div className="border border-zinc-800 rounded p-3 bg-zinc-900">
          {/* Title + Scoring */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1 text-zinc-300">Title</label>
              <input
                disabled={locked}
                placeholder="e.g. Fran / EMOM 12’ / 5 Rounds …"
                value={wod.title}
                onChange={(e) =>
                  setWod((s) => ({ ...s, title: e.target.value }))
                }
                className={field}
              />
            </div>

            <div>
              <label className="block text-sm mb-1 text-zinc-300">
                Scoring
              </label>
              <select
                disabled={locked}
                value={wod.scoring}
                onChange={(e) =>
                  setWod((s) => ({
                    ...s,
                    scoring: e.target.value as ScoringType,
                  }))
                }
                className={field}
              >
                <option value="for_time">For Time</option>
                <option value="amrap">AMRAP</option>
                <option value="emom">EMOM</option>
              </select>
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-sm mb-1 text-zinc-300">
              Description / Rep scheme
            </label>
            <textarea
              disabled={locked}
              rows={6}
              placeholder={`e.g.
21-15-9 Thrusters (42.5/30) & Pull-ups
Time cap: 8:00`}
              value={wod.description}
              onChange={(e) =>
                setWod((s) => ({ ...s, description: e.target.value }))
              }
              className={field}
            />
          </div>

          {/* Time cap + checkbox */}
          <div className="mt-3">
            <label className="block text-sm mb-1 text-zinc-300">Time cap</label>
            <input
              disabled={locked}
              placeholder="e.g. 12:00"
              value={wod.timeCap}
              onChange={(e) =>
                setWod((s) => ({ ...s, timeCap: e.target.value }))
              }
              className={field}
            />

            <div className="mt-3 inline-flex items-center gap-2">
              <input
                disabled={locked}
                id="main-record"
                type="checkbox"
                checked={wod.recordMainScore}
                onChange={(e) =>
                  setWod((s) => ({ ...s, recordMainScore: e.target.checked }))
                }
                className="h-4 w-4 accent-zinc-200"
              />
              <label
                htmlFor="main-record"
                className="text-sm text-zinc-300 whitespace-nowrap"
              >
                Record score for Main WOD
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className={`px-4 py-2 rounded border border-zinc-700 text-sm ${
              locked ? 'opacity-60 cursor-not-allowed' : 'hover:bg-zinc-800'
            }`}
            disabled={locked}
            title={
              locked
                ? 'This date already has a saved WOD (locked)'
                : 'Save WOD for this date'
            }
          >
            Save
          </button>
          {savedMsg && <span className="text-sm text-zinc-300">{savedMsg}</span>}
        </div>
      </form>

      {/* Preview */}
      <hr className="my-6 border-zinc-800" />
      <h2 className="text-lg font-semibold mb-2">Preview</h2>
      <div className="border border-zinc-800 rounded p-3 bg-zinc-900 space-y-4">
        <div className="text-sm text-zinc-400">{fmtDDMMYYYY(date)}</div>

        {/* Strength / Skills preview */}
        <div>
          <div className="text-sm text-zinc-400">Strength / Skills</div>
          <div className="font-semibold">{wod.strength.title || '—'}</div>
          <div className="text-sm text-zinc-300 whitespace-pre-wrap">
            {wod.strength.description || '—'}
          </div>
          <div className="text-sm text-zinc-400 mt-1">
            {wod.strength.scoreHint ? `Score: ${wod.strength.scoreHint} • ` : ''}
            Record score: {wod.strength.recordScore ? 'Yes' : 'No'}
          </div>
        </div>

        {/* Main WOD preview */}
        <div className="pt-2 border-t border-zinc-800">
          <div className="text-sm text-zinc-400">Main WOD</div>
          <div className="text-xl font-bold">{wod.title || '—'}</div>
          <div className="text-sm text-zinc-300 whitespace-pre-wrap mt-1">
            {wod.description || '—'}
          </div>
          <div className="text-sm text-zinc-400 mt-1">
            Scoring: {wod.scoring.toUpperCase()}
            {wod.timeCap ? ` • Time cap: ${wod.timeCap}` : ''} • Record score:{' '}
            {wod.recordMainScore ? 'Yes' : 'No'}
          </div>
        </div>
      </div>
    </section>
  );
}
