/**
 * Admins sign in with phone + password. Supabase password sign-in uses email, so each admin
 * has an internal address derived from their phone (set by scripts/set-admin-password.mjs).
 */
export function adminEmail(e164: string): string {
  return `${e164.replace(/^\+/, '')}@admin.nearbuy.lk`;
}
