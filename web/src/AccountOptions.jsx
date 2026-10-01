// <option>s for an account <select>, grouped under each bank. Expects /api/accounts rows (name, mask, institution).
export default function AccountOptions({ accounts }) {
  const banks = new Map();
  for (const a of accounts) {
    const k = a.institution ?? 'Other';
    if (!banks.has(k)) banks.set(k, []);
    banks.get(k).push(a);
  }
  return [...banks].sort(([a], [b]) => a.localeCompare(b)).map(([bank, list]) => (
    <optgroup key={bank} label={bank}>
      {list.map((a) => <option key={a.id} value={a.id}>{a.name}{a.mask ? ` ••${a.mask}` : ''}</option>)}
    </optgroup>
  ));
}
