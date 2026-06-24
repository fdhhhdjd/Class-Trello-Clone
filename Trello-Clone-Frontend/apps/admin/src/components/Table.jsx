import { useState } from 'react';
import { color, space, font, radius, shadow, Skeleton, Button, IconButton, Select, EmptyState } from '@trello/ui';
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileText, AlertTriangle,
} from 'lucide-react';
import { PAGE_SIZE_OPTIONS } from '../lib/usePagination';

export function Table({
  columns, rows, empty = 'No records', emptyDescription, emptyIcon = <FileText size={36} />,
  loading, fetching, error, onRetry, rowKey, skeletonRows = 6,
}) {
  const th = {
    textAlign: 'left', padding: '12px 16px', fontFamily: font.text, fontSize: 11,
    textTransform: 'uppercase', letterSpacing: 0.6, color: color.textMuted,
    fontWeight: 700, borderBottom: `1px solid ${color.border}`,
    background: color.surfaceAlt, position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap',
  };
  const td = {
    padding: '12px 16px', fontFamily: font.text, fontSize: 14,
    color: color.text, borderBottom: `1px solid ${color.border}`, verticalAlign: 'middle',
  };

  // Subtle loading overlay when refetching with prior rows kept.
  const showOverlay = fetching && !loading && rows.length > 0;

  return (
    <div style={{
      position: 'relative',
      background: color.surface, border: `1px solid ${color.border}`,
      borderRadius: radius.large, overflow: 'hidden', boxShadow: shadow.subtle,
    }}>
      <ShimmerKeyframes />
      {(loading || fetching) && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3, zIndex: 3,
          background: `linear-gradient(90deg, transparent, ${color.blue}, transparent)`,
          backgroundSize: '40% 100%', animation: 'adminShimmer 1.1s ease-in-out infinite',
        }} />
      )}
      {showOverlay && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2, background: color.surface,
          opacity: 0.45, pointerEvents: 'none', transition: 'opacity .15s',
        }} />
      )}
      <div style={{ overflowX: 'auto', maxHeight: '64vh', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ ...th, width: c.width, textAlign: c.align ?? 'left' }}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  {columns.map((c) => (
                    <td key={c.key} style={td}><Skeleton width={`${50 + ((i + c.key.length) % 4) * 12}%`} /></td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={columns.length} style={{ ...td, borderBottom: 'none', padding: 0 }}>
                  <EmptyState
                    icon={<AlertTriangle size={36} />}
                    title="Something went wrong"
                    description={error}
                    action={onRetry ? <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button> : undefined}
                  />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ ...td, borderBottom: 'none', padding: 0 }}>
                  <EmptyState icon={emptyIcon} title={empty} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              rows.map((row) => <Row key={rowKey(row)} row={row} columns={columns} td={td} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ShimmerKeyframes() {
  return (
    <style>{`@keyframes adminShimmer {
      0% { background-position: -40% 0; }
      100% { background-position: 140% 0; }
    }`}</style>
  );
}

function Row({ row, columns, td }) {
  const [hover, setHover] = useState(false);
  const bg = hover ? color.surfaceAlt : color.surface;
  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ background: bg, transition: 'background .1s' }}
    >
      {columns.map((c) => (
        <td key={c.key} style={{ ...td, textAlign: c.align ?? 'left' }}>
          {c.render ? c.render(row) : row[c.key]}
        </td>
      ))}
    </tr>
  );
}

/* ------------------------------------------------------------ Pagination */

function pageList(page, maxPage) {
  if (maxPage <= 7) return Array.from({ length: maxPage }, (_, i) => i + 1);
  const out = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(maxPage - 1, page + 1);
  if (start > 2) out.push('…');
  for (let p = start; p <= end; p += 1) out.push(p);
  if (end < maxPage - 1) out.push('…');
  out.push(maxPage);
  return out;
}

export function Pagination({
  page, pageSize, total, onPage, onPageSize, pageSizeOptions = PAGE_SIZE_OPTIONS,
}) {
  const safeTotal = total || 0;
  const maxPage = Math.max(1, Math.ceil(safeTotal / pageSize));
  const current = Math.min(page, maxPage);
  const from = safeTotal === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, safeTotal);
  const pages = pageList(current, maxPage);

  const navBtn = (off) => ({
    width: 32, height: 32, borderRadius: radius.base, border: `1px solid ${color.border}`,
    background: color.surface, color: color.text,
    opacity: off ? 0.4 : 1, cursor: off ? 'not-allowed' : 'pointer',
  });
  const firstOff = current <= 1;
  const lastOff = current >= maxPage;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: space.base, marginTop: space.base, flexWrap: 'wrap',
      fontFamily: font.text, fontSize: 14, color: color.textMuted,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}>
        {onPageSize && (
          <label style={{ display: 'flex', alignItems: 'center', gap: space.sm, color: color.textMuted }}>
            <span style={{ whiteSpace: 'nowrap' }}>Rows per page</span>
            <Select
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
              style={{ minHeight: 32, padding: '4px 28px 4px 10px', width: 'auto' }}
            >
              {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </label>
        )}
        <span style={{ whiteSpace: 'nowrap' }}>
          Showing <strong style={{ color: color.text }}>{from.toLocaleString()}–{to.toLocaleString()}</strong>
          {' '}of <strong style={{ color: color.text }}>{safeTotal.toLocaleString()}</strong>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: space.xs }}>
        <IconButton label="First page" disabled={firstOff} onClick={() => onPage(1)} style={navBtn(firstOff)}>
          <ChevronsLeft size={16} />
        </IconButton>
        <IconButton label="Previous page" disabled={firstOff} onClick={() => onPage(current - 1)} style={navBtn(firstOff)}>
          <ChevronLeft size={16} />
        </IconButton>

        {pages.map((p, i) => (
          p === '…' ? (
            <span key={`e-${i}`} style={{ padding: '0 4px', color: color.mediumGray }}>…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              aria-current={p === current ? 'page' : undefined}
              style={{
                minWidth: 32, height: 32, padding: '0 8px', borderRadius: radius.base,
                cursor: 'pointer', fontFamily: font.text, fontSize: 14, fontWeight: p === current ? 700 : 500,
                border: `1px solid ${p === current ? color.blue : color.border}`,
                background: p === current ? color.blue : color.surface,
                color: p === current ? color.white : color.text,
                transition: 'background .12s, border-color .12s',
              }}
            >
              {p}
            </button>
          )
        ))}

        <IconButton label="Next page" disabled={lastOff} onClick={() => onPage(current + 1)} style={navBtn(lastOff)}>
          <ChevronRight size={16} />
        </IconButton>
        <IconButton label="Last page" disabled={lastOff} onClick={() => onPage(maxPage)} style={navBtn(lastOff)}>
          <ChevronsRight size={16} />
        </IconButton>
      </div>
    </div>
  );
}
