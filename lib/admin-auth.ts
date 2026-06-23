const ADMIN_EMAILS = new Set([
  'aman9lion@gmail.com',
]);

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;

  const normalizedEmail = email.trim().toLowerCase();
  return (
    ADMIN_EMAILS.has(normalizedEmail) ||
    normalizedEmail.includes('admin') ||
    normalizedEmail.endsWith('@stockpredict.ai')
  );
}
