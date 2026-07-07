const TYPO_MAP: Record<string, string> = {
  "gamil.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmali.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmil.com": "gmail.com",
  "gimail.com": "gmail.com",
  "gamail.com": "gmail.com",
  "gemail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "yhaoo.com": "yahoo.com",
  "yahoomail.com": "yahoo.com",
  "hotmal.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmali.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "outlok.com": "outlook.com",
  "outook.com": "outlook.com",
  "outlook.co": "outlook.com",
  "redifmail.com": "rediffmail.com",
  "rediifmail.com": "rediffmail.com",
};

export function checkEmailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const atIdx = trimmed.lastIndexOf("@");
  if (atIdx === -1) return null;
  const domain = trimmed.slice(atIdx + 1);
  return TYPO_MAP[domain] ?? null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
