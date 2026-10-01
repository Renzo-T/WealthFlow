// Dashboard layout logic, kept free of React so it can be tested (tests/layout.test.js).
// A layout is { order: [ids], hidden: [ids], rail: [ids] }; panels are [{ id, rail? }] in default order.

export const defaultLayout = (panels) => ({ order: panels.map((p) => p.id), hidden: [], rail: panels.filter((p) => p.rail).map((p) => p.id) });

// A saved layout with any panels it doesn't know about added (just before the panel that follows them by default,
// or at the end if nothing does) and ids that no longer exist dropped, so a saved layout never hides new features.
export function mergeLayout(saved, panels) {
  if (!saved) return defaultLayout(panels);
  const known = new Set(panels.map((p) => p.id));
  const order = (saved.order ?? []).filter((id) => known.has(id));
  // Last to first, so a run of new panels each find their already-placed successor.
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (order.includes(p.id)) continue;
    const after = panels.slice(i + 1).find((q) => order.includes(q.id));
    order.splice(after ? order.indexOf(after.id) : order.length, 0, p.id);
  }
  const isNew = (id) => !(saved.order ?? []).includes(id);
  return {
    order,
    hidden: (saved.hidden ?? []).filter((id) => known.has(id)),
    rail: [...(saved.rail ?? []).filter((id) => known.has(id)), ...panels.filter((p) => p.rail && isNew(p.id)).map((p) => p.id)],
  };
}
