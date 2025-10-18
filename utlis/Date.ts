// utils/date.ts
export const toAthensMidnightISO = (yyyy_mm_dd: string) => {
  // Europe/Athens (UTC+3 ή +2 ανάλογα το DST). Για απλότητα:
  const tzOffset = 3; // τώρα Οκτώβριος 2025 είναι UTC+3
  const iso = new Date(`${yyyy_mm_dd}T00:00:00+0${tzOffset}:00`).toISOString();
  return iso;
};
