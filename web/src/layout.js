// Dashboard layout logic, kept free of React so it can be tested (tests/layout.test.js).
// A layout is { order: [ids], hidden: [ids], rail: [ids] }; panels are [{ id, rail?, hidden? }] in default order.
// `hidden: true` on a panel means it starts hidden for a new or reset layout (it stays listed under Customize).

export const defaultLayout = (panels) => ({ order: panels.map((p) => p.id), hidden: panels.filter((p) => p.hidden).map((p) => p.id), rail: panels.filter((p) => p.rail).map((p) => p.id) });

// Panels that replaced others (`was: [old ids]`, e.g. two panels merged into one): a saved layout's old ids become the
// new one, at the earliest of their positions. It is hidden only if everything it replaced was hidden (or it was hidden
// itself, among them), and in the side column if any of them was.
export function renamePanels(saved, panels) {
  let { order = [], hidden = [], rail = [] } = saved;
  for (const p of panels) {
    const ids = [p.id, ...(p.was ?? [])].filter((id) => order.includes(id));
    if (!p.was?.length || !ids.length || (ids.length === 1 && ids[0] === p.id)) continue;
    const at = Math.min(...ids.map((id) => order.indexOf(id)));
    order = order.map((id, i) => (i === at ? p.id : id)).filter((id, i) => i === at || !ids.includes(id));
    const allHidden = ids.every((id) => hidden.includes(id)), anyRail = ids.some((id) => rail.includes(id));
    hidden = [...hidden.filter((id) => !ids.includes(id)), ...(allHidden ? [p.id] : [])];
    rail = [...rail.filter((id) => !ids.includes(id)), ...(anyRail ? [p.id] : [])];
  }
  return { ...saved, order, hidden, rail };
}

// A saved layout with any panels it doesn't know about added (just before the panel that follows them by default,
// or at the end if nothing does) and ids that no longer exist dropped, so a saved layout never hides new features.
export function mergeLayout(saved, panels) {
  if (!saved) return defaultLayout(panels);
  saved = renamePanels(saved, panels);
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
    // Saved panels keep whatever you chose; only panels new to the saved layout follow their own default.
    hidden: [...(saved.hidden ?? []).filter((id) => known.has(id)), ...panels.filter((p) => p.hidden && isNew(p.id)).map((p) => p.id)],
    rail: [...(saved.rail ?? []).filter((id) => known.has(id)), ...panels.filter((p) => p.rail && isNew(p.id)).map((p) => p.id)],
  };
}
