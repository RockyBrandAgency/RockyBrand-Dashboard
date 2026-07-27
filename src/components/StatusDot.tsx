import { STATUS, type Status } from './status';

export function StatusDot({ status, label }: { status: Status; label?: string }) {
  const s = STATUS[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: s.dot,
          display: 'inline-block',
          flexShrink: 0,
          boxShadow: `0 0 0 2px ${s.dot}30`,
        }}
      />
      <span style={{ fontSize: 12, fontWeight: 600, color: s.dot, whiteSpace: 'nowrap' }}>{label ?? s.label}</span>
    </span>
  );
}
