export function jakartaDay(at = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Jakarta', year:'numeric', month:'2-digit', day:'2-digit' }).format(at);
}
// Ledger dates are date-only records, consistently anchored at noon Jakarta.
// createdAt retains the actual timestamp for auditing.
export function ledgerToday(at = new Date()): Date {
  return new Date(jakartaDay(at)+'T05:00:00Z');
}
