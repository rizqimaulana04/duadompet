export function estimatedCompletion(
  events: { amount: string; createdAt: string }[],
  target: string,
  now = new Date(),
): string | null {
  if (!events.length) return null;
  const funded = events.reduce((s, e) => s + BigInt(e.amount), 0n),
    remaining = BigInt(target) - funded;
  if (remaining <= 0n) return now.toISOString();
  if (funded <= 0n) return null;
  const first = Math.min(...events.map((e) => +new Date(e.createdAt)));
  const days = BigInt(Math.floor((+now - first) / 86400000));
  if (days < 7n) return null;
  const daysLeft = (remaining * days + funded - 1n) / funded;
  if (daysLeft > 36500n) return null;
  return new Date(+now + Number(daysLeft) * 86400000).toISOString();
}
