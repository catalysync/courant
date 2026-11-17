"use client";

export type LineChartPoint = { x: number; y: number };

/**
 * Tiny dependency-free SVG line chart.
 * Points are auto-scaled into a responsive viewBox.
 */
export const LineChart = ({
  data,
  width = 600,
  height = 200,
  padding = 10,
  baseline,
  top,
  area = false,
  className,
}: {
  data: LineChartPoint[];
  width?: number;
  height?: number;
  padding?: number;
  /** Force a lower bound for the y axis (e.g. 0). */
  baseline?: number;
  /** Force an upper bound for the y axis. */
  top?: number;
  /** Draw a subtle fill under the line. */
  area?: boolean;
  className?: string;
}) => {
  if (data.length < 2) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        Not enough data
      </div>
    );
  }

  const xs = data.map((p) => p.x);
  const ys = data.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (baseline !== undefined) minY = Math.min(minY, baseline);
  if (top !== undefined) maxY = Math.max(maxY, top);

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const sx = (x: number) => padding + ((x - minX) / rangeX) * (width - padding * 2);
  const sy = (y: number) => height - padding - ((y - minY) / rangeY) * (height - padding * 2);

  const points = data.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ");

  const areaPath = [
    `M ${sx(data[0].x)} ${height - padding}`,
    ...data.map((p) => `L ${sx(p.x)} ${sy(p.y)}`),
    `L ${sx(data[data.length - 1].x)} ${height - padding}`,
    "Z",
  ].join(" ");

  // Subtle horizontal grid lines (4 divisions).
  const gridLines = [0, 1, 2, 3, 4].map((i) => {
    const y = padding + (i * (height - padding * 2)) / 4;
    return (
      <line
        key={i}
        x1={padding}
        x2={width - padding}
        y1={y}
        y2={y}
        stroke="hsl(var(--border))"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    );
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-hidden="true"
    >
      {gridLines}
      {area && (
        <path d={areaPath} fill="hsl(var(--primary) / 0.12)" stroke="none" />
      )}
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};