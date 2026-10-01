import { useCallback, useState } from 'react';

// Tooltip that follows the pointer inside a chart. Wrap the chart in an element with position: relative
// (e.g. .flowchart) and render <Tip tip={tip} /> inside it.
export function useTip() {
  const [tip, setTip] = useState(null);
  const show = useCallback((e, content) => {
    const box = e.currentTarget.closest('.flowchart')?.getBoundingClientRect();
    if (!box) return;
    const x = e.clientX - box.left, y = e.clientY - box.top;
    setTip({ x, y, right: x > box.width * 0.6, content });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  return [tip, show, hide];
}

export default function Tip({ tip }) {
  if (!tip) return null;
  return <div className="tip" style={tip.right ? { right: `calc(100% - ${tip.x - 12}px)`, top: tip.y + 12 } : { left: tip.x + 12, top: tip.y + 12 }}>{tip.content}</div>;
}
