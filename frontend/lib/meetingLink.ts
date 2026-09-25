/**
 * Accepts what people paste into "Join": a Meeting ID ("123 456 7890") or an invite link
 * ("https://site/j/1234567890?pwd=abc123"). Returns the code and the passcode if the link had one.
 */
export function parseMeetingInput(input: string): { code: string; passcode?: string } | null {
  const text = input.trim();
  if (!text) return null;

  if (/\/j\/\d/.test(text)) {
    try {
      const url = new URL(text.includes("://") ? text : `https://${text}`);
      const code = url.pathname.match(/\/j\/(\d{9,11})/)?.[1];
      if (!code) return null;
      return { code, passcode: url.searchParams.get("pwd") ?? undefined };
    } catch {
      return null;
    }
  }

  const digits = text.replace(/[\s-]/g, "");
  return /^\d{9,11}$/.test(digits) ? { code: digits } : null;
}
