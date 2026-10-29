const time = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// "Aujourd'hui 08:40", "Hier 18:05" or "25/10/2026 17:12".
export function formatSyncDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return `Aujourd'hui ${time(d)}`;
  if (dayKey(d) === dayKey(yesterday)) return `Hier ${time(d)}`;
  return `${d.toLocaleDateString("fr-FR")} ${time(d)}`;
}

export function isToday(iso: string | null, now = new Date()): boolean {
  return !!iso && dayKey(new Date(iso)) === dayKey(now);
}
