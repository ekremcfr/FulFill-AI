import { AISLES, OPTIMIZED_ROUTE, WAREHOUSE_HEIGHT, WAREHOUSE_WIDTH, type Zone } from "@/lib/warehouse-data";

const ZONE_FILL: Record<Zone, string> = {
  A: "oklch(0.78 0.16 75 / 0.55)",   // hot — accent
  B: "oklch(0.34 0.09 260 / 0.35)",  // primary tint
  C: "oklch(0.34 0.09 260 / 0.12)",  // cold
};
const ZONE_STROKE: Record<Zone, string> = {
  A: "oklch(0.65 0.16 70)",
  B: "oklch(0.34 0.09 260 / 0.6)",
  C: "oklch(0.34 0.09 260 / 0.3)",
};

export interface WarehouseMapProps {
  showRoute?: boolean;
  showHeatmap?: boolean;
  showLabels?: boolean;
  highlightAisles?: string[];
  className?: string;
}

export function WarehouseMap({
  showRoute = true,
  showHeatmap = true,
  showLabels = true,
  highlightAisles,
  className,
}: WarehouseMapProps) {
  const routePath =
    "M " + OPTIMIZED_ROUTE.map(([x, y]) => `${x} ${y}`).join(" L ");

  return (
    <svg
      viewBox={`0 0 ${WAREHOUSE_WIDTH} ${WAREHOUSE_HEIGHT}`}
      className={className}
      role="img"
      aria-label="Interactive warehouse floor plan"
    >
      <defs>
        <pattern id="floor-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="oklch(0.92 0.008 250)" strokeWidth="1" />
        </pattern>
        <linearGradient id="dock-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="oklch(0.96 0.05 85)" />
          <stop offset="1" stopColor="oklch(0.92 0.04 85)" />
        </linearGradient>
      </defs>

      {/* Floor */}
      <rect x="0" y="0" width={WAREHOUSE_WIDTH} height={WAREHOUSE_HEIGHT} fill="oklch(0.985 0.004 250)" />
      <rect x="20" y="20" width={WAREHOUSE_WIDTH - 40} height={WAREHOUSE_HEIGHT - 40} fill="url(#floor-grid)" opacity="0.6" rx="8" />

      {/* Building outline */}
      <rect
        x="20" y="20"
        width={WAREHOUSE_WIDTH - 40}
        height={WAREHOUSE_HEIGHT - 40}
        fill="none"
        stroke="oklch(0.34 0.09 260 / 0.4)"
        strokeWidth="2"
        rx="8"
      />

      {/* Zones */}
      {showHeatmap && (
        <g opacity="0.9">
          {/* Zone A near dock */}
          <rect x="780" y="40" width="380" height="680" fill="oklch(0.78 0.16 75 / 0.06)" rx="4" />
          <rect x="420" y="40" width="360" height="680" fill="oklch(0.34 0.09 260 / 0.04)" rx="4" />
          <rect x="40" y="40" width="380" height="680" fill="oklch(0.34 0.09 260 / 0.02)" rx="4" />
          <text x="60" y="60" fontSize="10" fontWeight="600" fill="oklch(0.5 0.02 260)" letterSpacing="1.5">ZONE C · SLOW</text>
          <text x="440" y="60" fontSize="10" fontWeight="600" fill="oklch(0.5 0.02 260)" letterSpacing="1.5">ZONE B · MEDIUM</text>
          <text x="800" y="60" fontSize="10" fontWeight="600" fill="oklch(0.55 0.14 70)" letterSpacing="1.5">ZONE A · FAST MOVERS</text>
        </g>
      )}

      {/* Dock area */}
      <g>
        <rect x="1050" y="640" width="110" height="80" fill="url(#dock-grad)" stroke="oklch(0.55 0.14 70)" strokeWidth="1" rx="4" />
        <text x="1105" y="686" textAnchor="middle" fontSize="10" fontWeight="600" fill="oklch(0.35 0.09 60)">DOCK</text>
        <text x="1105" y="700" textAnchor="middle" fontSize="9" fill="oklch(0.45 0.05 60)">Shipping</text>
      </g>

      {/* Packing */}
      <g>
        <rect x="1050" y="40" width="110" height="140" fill="oklch(0.34 0.09 260 / 0.06)" stroke="oklch(0.34 0.09 260 / 0.4)" strokeWidth="1" strokeDasharray="4 4" rx="4" />
        <text x="1105" y="65" textAnchor="middle" fontSize="10" fontWeight="600" fill="oklch(0.35 0.09 260)">PACK</text>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={1064} y={80 + i * 22} width="82" height="16" fill="oklch(0.99 0 0)" stroke="oklch(0.34 0.09 260 / 0.3)" rx="2" />
        ))}
      </g>

      {/* Receiving */}
      <g>
        <rect x="1050" y="220" width="110" height="380" fill="oklch(0.99 0 0)" stroke="oklch(0.34 0.09 260 / 0.35)" strokeWidth="1" rx="4" />
        <text x="1105" y="245" textAnchor="middle" fontSize="10" fontWeight="600" fill="oklch(0.35 0.09 260)">RECEIVING</text>
      </g>

      {/* Aisles */}
      {AISLES.map((aisle) => {
        const dim = highlightAisles && !highlightAisles.includes(aisle.label);
        return (
          <g key={aisle.id} opacity={dim ? 0.35 : 1}>
            {aisle.racks.map((r) => (
              <rect
                key={r.id}
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                fill={ZONE_FILL[r.zone]}
                stroke={ZONE_STROKE[r.zone]}
                strokeWidth="0.75"
                rx="1.5"
              />
            ))}
            {showLabels && (
              <text
                x={aisle.racks[0].x + aisle.racks[0].w / 2}
                y={78}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill="oklch(0.35 0.06 260)"
                fontFamily="'JetBrains Mono', monospace"
              >
                {aisle.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Optimized route */}
      {showRoute && (
        <g>
          <path
            d={routePath}
            fill="none"
            stroke="oklch(0.34 0.09 260 / 0.2)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={routePath}
            fill="none"
            stroke="oklch(0.34 0.09 260)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="8 6"
            className="animate-route-dash"
          />
          {/* Waypoints */}
          {OPTIMIZED_ROUTE.slice(1, -1).map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="6" fill="oklch(1 0 0)" stroke="oklch(0.34 0.09 260)" strokeWidth="1.75" />
              <text x={x} y={y + 3} textAnchor="middle" fontSize="8" fontWeight="700" fill="oklch(0.34 0.09 260)">
                {i + 1}
              </text>
            </g>
          ))}
          {/* Picker */}
          <g transform={`translate(${OPTIMIZED_ROUTE[7][0]} ${OPTIMIZED_ROUTE[7][1]})`}>
            <circle r="16" fill="oklch(0.78 0.16 75 / 0.25)" className="animate-pulse-ring" />
            <circle r="9" fill="oklch(0.78 0.16 75)" stroke="oklch(1 0 0)" strokeWidth="2" />
          </g>
        </g>
      )}

      {/* Charging stations */}
      {[[40, 640], [40, 680]].map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y} width="30" height="30" fill="oklch(0.34 0.09 260 / 0.08)" stroke="oklch(0.34 0.09 260 / 0.4)" rx="3" />
          <text x={x + 15} y={y + 19} textAnchor="middle" fontSize="8" fill="oklch(0.35 0.06 260)">⚡</text>
        </g>
      ))}
    </svg>
  );
}
