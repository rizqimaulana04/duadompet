export function inviteCallback(value: string | null): string {
  return value && /^\/household\/invitations\?token=[a-f0-9]{64}$/.test(value)
    ? value
    : "";
}
