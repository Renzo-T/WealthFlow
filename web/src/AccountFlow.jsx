import { useMemo, useState } from 'react';
import Tip, { useTip } from './Tip.jsx';
import { sankey, sankeyJustify, sankeyLinkHorizontal } from 'd3-sankey';
import { usd2, INCOME, SPENDING, SERIES, NEUTRAL, NEUTRAL_LIGHT } from './format.js';

const W = 900, PAD = 4;
const COLOR = {
  income: INCOME, account: SERIES[0], group: SPENDING, saving: SERIES[2], credit: SERIES[2], external: NEUTRAL, balance: NEUTRAL_LIGHT,
};
const color = (n) => COLOR[n.kind];
const short = (s, n = 26) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// Columns are laid out by d3-sankey: sources on the left, accounts in the middle (card accounts land a
// column after the account that pays them), spending and balances on the right.
function layout(data, H) {
  return sankey().nodeId((d) => d.id).nodeAlign(sankeyJustify).nodeWidth(12).nodePadding(24)
    .nodeSort(null).extent([[PAD, PAD], [W - PAD, H - PAD]])({
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.links.map((l) => ({ ...l })),
    });
}

export default function AccountFlow({ data, rename }) {
  const [hl, setHl] = useState(null); // { link } or { node }
  const [tip, show, hide] = useTip();
  const g = useMemo(() => {
    if (!data.links.length) return null;
    const first = layout(data, 800);
    const perCol = {};
    for (const n of first.nodes) perCol[n.depth] = (perCol[n.depth] ?? 0) + 1;
    const H = Math.max(380, Math.max(...Object.values(perCol)) * 58);
    return { ...layout(data, H), H };
  }, [data]);
  if (!g) return <div className="empty">No money moved in this period.</div>;
  const lit = (l) => !hl || hl.link === l || hl.node === l.source || hl.node === l.target;
  const sum = (ls) => ls.reduce((s, l) => s + l.value, 0);
  const linkTip = (l) => <><b>{l.source.name} → {l.target.name}</b><div>{usd2(l.value)}</div></>;
  const nodeTip = (n) => {
    const top = (ls, side) => [...ls].sort((a, b) => b.value - a.value).slice(0, 4).map((l) => <li key={l[side].id}><span>{l[side].name}</span><span>{usd2(l.value)}</span></li>);
    return <><b>{n.name}</b>{n.institution && <span className="muted"> · {n.institution}</span>}
      {n.targetLinks.length > 0 && <><div className="muted">In {usd2(sum(n.targetLinks))} from</div><ul>{top(n.targetLinks, 'source')}</ul></>}
      {n.sourceLinks.length > 0 && <><div className="muted">Out {usd2(sum(n.sourceLinks))} to</div><ul>{top(n.sourceLinks, 'target')}</ul></>}</>;
  };

  return (
    <>
    <svg className="chart" viewBox={`0 0 ${W} ${g.H}`} role="img" aria-label="How money moved through your accounts">
      <g fill="none">
        {g.links.map((l, i) => (
          <path key={i} className="flink" d={sankeyLinkHorizontal()(l)} stroke={color(l.source)} strokeWidth={Math.max(1, l.width)}
            strokeOpacity={hl ? (lit(l) ? 0.6 : 0.06) : 0.28}
            onMouseMove={(e) => { setHl({ link: l }); show(e, linkTip(l)); }} onMouseLeave={() => { setHl(null); hide(); }} />
        ))}
      </g>
      {g.nodes.map((n) => {
        const right = n.x0 < W / 2;
        const x = right ? n.x1 + 6 : n.x0 - 6, y = (n.y0 + n.y1) / 2;
        const clickable = n.kind === 'income';
        return (
          <g key={n.id}>
            <rect x={n.x0} y={n.y0} width={n.x1 - n.x0} height={Math.max(1, n.y1 - n.y0)} rx="2" fill={color(n)}
              onMouseMove={(e) => { setHl({ node: n }); show(e, nodeTip(n)); }} onMouseLeave={() => { setHl(null); hide(); }} />
            {n.y1 - n.y0 >= 22 ? <>
              <text x={x} y={y - 2} textAnchor={right ? 'start' : 'end'} className={`fl${clickable ? ' click' : ''}`}
                onClick={clickable ? () => rename(n.key, n.name) : undefined}>
                <title>{clickable ? 'Click to rename' : n.name}</title>{short(n.name)}
              </text>
              <text x={x} y={y + 11} textAnchor={right ? 'start' : 'end'}>{usd2(n.value)}</text>
            </> : (
              <text x={x} y={y + 4} textAnchor={right ? 'start' : 'end'} className={clickable ? 'click' : undefined}
                onClick={clickable ? () => rename(n.key, n.name) : undefined}>
                <title>{clickable ? 'Click to rename' : n.name}</title>
                <tspan className="fl">{short(n.name, 22)}</tspan> {usd2(n.value)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
    <Tip tip={tip} />
    </>
  );
}
