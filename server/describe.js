// Turns a raw bank description into something readable for the transactions list. The original is always
// kept and shown on hover, so this only needs to be good, not perfect.
//   "ONLINE/MOBILE PAYMENT CONF#M08104055672"                       → "Online/Mobile Payment"
//   "Bank of America DES:CASHREWARD ID:DOE INDN:XXXXX1234… PPD" → "Bank of America · Cashreward"
//   "TRANSFERRED FROM OVERDRAFT TRANSFER VS. Z99-123456-1 DIRECT DEBIT (Cash)" → "Transferred From Overdraft Transfer Vs. Z99-123456-1 Direct Debit"
export function describe(name) {
  if (!name) return '';
  let s = name
    .replace(/\((Cash|Margin)\)/gi, ' ')
    .replace(/\b(CO ID|INDN|ID|WEB ID|TRACE|REF)\s*[:#]\s*\S+/gi, ' ') // reference and customer ids
    .replace(/\bCONF\s*#\s*\S+/gi, ' ')
    .replace(/\S*X{3,}\S*/g, ' ') // masked numbers like XXXXX1234
    .replace(/\b(PPD|CCD|WEB|TEL)\b\s*$/i, ' ')
    .replace(/\bDES:\s*/gi, ' · ')
    .replace(/(^|\s)\d{6,}(?=\s|$)/g, ' ') // long bare numbers
    .replace(/\s+/g, ' ').replace(/\s·\s*$/, '').trim();
  if (s === s.toUpperCase()) s = s.toLowerCase().replace(/(^|[\s/(·-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  return s || name;
}
