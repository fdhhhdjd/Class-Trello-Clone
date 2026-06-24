import { Card, Skeleton, space, radius } from '@trello/ui';

// Grid of skeleton stat/metric cards (dashboard, monitoring).
export function CardGridSkeleton({ count = 4, minWidth = 220, height = 56 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`, gap: space.base }}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} style={{ padding: space.lg }}>
          <Skeleton width="50%" height={12} />
          <Skeleton width="70%" height={height} style={{ marginTop: space.md }} />
        </Card>
      ))}
    </div>
  );
}

// Stacked skeleton blocks for forms / settings / landing editor.
export function FormSkeleton({ blocks = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.lg }}>
      {Array.from({ length: blocks }).map((_, i) => (
        <Card key={i} style={{ padding: space.lg, display: 'flex', flexDirection: 'column', gap: space.md }}>
          <Skeleton width="30%" height={16} />
          <Skeleton height={40} radius={radius.primary} />
          <Skeleton height={40} radius={radius.primary} />
          <Skeleton width="60%" height={40} radius={radius.primary} />
        </Card>
      ))}
    </div>
  );
}

// Generic detail-page skeleton: header block + content blocks.
export function DetailSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.lg }}>
      <Card style={{ padding: space.lg, display: 'flex', flexDirection: 'column', gap: space.md }}>
        <Skeleton width="40%" height={22} />
        <Skeleton width="60%" height={14} />
      </Card>
      <CardGridSkeleton count={4} minWidth={160} height={28} />
      <Card style={{ padding: space.lg }}>
        <Skeleton width="25%" height={16} style={{ marginBottom: space.md }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={20} style={{ marginBottom: space.sm }} />
        ))}
      </Card>
    </div>
  );
}

// Rows of skeleton lines for list/permission modals.
export function RowsSkeleton({ rows = 6 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={20} width={`${60 + (i % 4) * 10}%`} />
      ))}
    </div>
  );
}
