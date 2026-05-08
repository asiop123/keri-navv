import type { ManeuverIcon } from "@/hooks/useTurnByTurn";

interface Props {
  icon: ManeuverIcon;
  junctionType: string;
  distanceMeters: number | null;
  exitNumber?: string;
  signpostText?: string;
  roundaboutExitNumber?: number;
  roadNumbers?: string[];
}

/**
 * Komplett väg-/rondell-illustration med animerade filer, riktningspil
 * och inbäddade skylttexter. Renderar olika SVG beroende på manövertyp.
 */
export function RoadDiagram(props: Props) {
  const { icon, junctionType } = props;
  const j = (junctionType || "").toUpperCase();

  const isRoundabout =
    icon === "roundabout" ||
    j.includes("ROUNDABOUT") ||
    j.includes("CIRCLE");
  const isExit = j.includes("EXIT") || j.includes("RAMP");
  const isBifurcation = j.includes("BIFURCATION") || j.includes("FORK");
  const isCityTurn =
    icon === "left" || icon === "right" ||
    icon === "sharp-left" || icon === "sharp-right";

  if (isRoundabout) return <RoundaboutDiagram {...props} />;
  if (isExit || isBifurcation) return <HighwayExitDiagram {...props} />;
  if (isCityTurn && j.includes("CROSS")) return <IntersectionDiagram {...props} />;
  if (isExit || isBifurcation || isCityTurn) return <HighwayExitDiagram {...props} />;
  return null;
}

/* ─────────────────────────────────────────────────────────────────
   Shared label overlays (rendered as HTML over SVG so text is crisp)
   ───────────────────────────────────────────────────────────────── */
function Overlays({
  distanceMeters,
  exitNumber,
  signpostText,
  roadNumbers,
  directionLabel,
}: {
  distanceMeters: number | null;
  exitNumber?: string;
  signpostText?: string;
  roadNumbers?: string[];
  directionLabel: string;
}) {
  const showDistance =
    distanceMeters !== null
      ? distanceMeters < 1000
        ? `${Math.max(0, Math.round(distanceMeters / 50) * 50)} m`
        : `${(distanceMeters / 1000).toFixed(1)} km`
      : null;

  return (
    <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none">
      {/* Top row: exit number + road numbers + signpost */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 max-w-[60%]">
          {signpostText && (
            <div className="bg-emerald-700 text-white px-2 py-1 rounded text-[11px] font-bold border border-white/40 shadow-lg truncate">
              ➜ {signpostText}
            </div>
          )}
          {roadNumbers && roadNumbers.length > 0 && (
            <div className="flex gap-1">
              {roadNumbers.slice(0, 3).map((rn) => (
                <span
                  key={rn}
                  className="px-1.5 py-0.5 rounded border-2 border-white/80 bg-primary/80 text-white text-[10px] font-black shadow"
                >
                  {rn}
                </span>
              ))}
            </div>
          )}
        </div>
        {exitNumber && (
          <div className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-xs font-black shadow-lg shrink-0 animate-fade-in">
            AVF {exitNumber}
          </div>
        )}
      </div>

      {/* Bottom row: direction + distance */}
      <div className="flex items-end justify-between">
        <div className="bg-primary/90 text-primary-foreground px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider shadow-lg">
          {directionLabel}
        </div>
        {showDistance && (
          <div className="bg-background/95 text-foreground px-2.5 py-1 rounded-md text-base font-black shadow-lg tabular-nums">
            {showDistance}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   1. HIGHWAY EXIT / BIFURCATION
   ───────────────────────────────────────────────────────────────── */
function HighwayExitDiagram(props: Props) {
  const { icon, distanceMeters } = props;
  const goesLeft = icon === "left" || icon === "slight-left" || icon === "sharp-left";
  const mirror = goesLeft;

  // Closer = thicker, more glow
  const proximity = distanceMeters !== null
    ? Math.max(0, Math.min(1, 1 - distanceMeters / 1500))
    : 0.5;
  const glow = 0.4 + proximity * 0.5;
  const dashSpeed = 1.5 - proximity * 0.8; // faster dash when closer

  return (
    <div className="relative w-full bg-gradient-to-b from-slate-800 to-slate-900 overflow-hidden border-t border-primary-foreground/10 animate-fade-in">
      <svg
        viewBox="0 0 320 180"
        className="w-full h-44 transition-transform duration-700"
        style={mirror ? { transform: "scaleX(-1)" } : undefined}
      >
        <defs>
          <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="hsl(155, 30%, 18%)" />
            <stop offset="1" stopColor="hsl(155, 25%, 25%)" />
          </linearGradient>
          <filter id="lane-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="0" y="0" width="320" height="180" fill="url(#grass)" />

        {/* Main highway perspective trapezoid */}
        <path d="M 110 10 L 210 10 L 280 180 L 40 180 Z" fill="hsl(220, 12%, 26%)" />
        {/* Exit ramp */}
        <path
          d="M 210 10 Q 250 50 305 75 L 320 95 L 320 180 L 280 180 Z"
          fill="hsl(220, 12%, 26%)"
        />

        {/* Lane dividers — 3 lanes on main road */}
        {[0.33, 0.66].map((t, i) => {
          const x1 = 110 + (210 - 110) * t;
          const x2 = 40 + (280 - 40) * t;
          return (
            <line
              key={i}
              x1={x1} y1="10" x2={x2} y2="180"
              stroke="white" strokeWidth="2"
              strokeDasharray="8 10" opacity="0.6"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="0" to="-18"
                dur={`${dashSpeed}s`}
                repeatCount="indefinite"
              />
            </line>
          );
        })}

        {/* Solid edge lines */}
        <path d="M 110 10 L 40 180" stroke="white" strokeWidth="2.5" opacity="0.9" />
        <path d="M 210 10 Q 250 50 305 75" stroke="white" strokeWidth="2.5" opacity="0.9" />

        {/* HIGHLIGHTED PATH — yellow glowing arrow into the exit */}
        <path
          d="M 195 25 Q 235 55 290 85 L 305 130"
          stroke="hsl(48, 96%, 53%)"
          strokeWidth={10 + proximity * 4}
          fill="none"
          strokeLinecap="round"
          opacity={glow}
          filter="url(#lane-glow)"
        />
        <path
          d="M 195 25 Q 235 55 290 85 L 305 130"
          stroke="hsl(48, 96%, 53%)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="6 8"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="14" to="0"
            dur={`${dashSpeed}s`}
            repeatCount="indefinite"
          />
        </path>

        {/* Arrow tip */}
        <polygon
          points="295,118 315,130 295,142"
          fill="hsl(48, 96%, 53%)"
          filter="url(#lane-glow)"
        />

        {/* Truck position */}
        <g transform="translate(160, 165)">
          <rect x="-10" y="-8" width="20" height="14" rx="2" fill="hsl(var(--secondary))" stroke="white" strokeWidth="1" />
        </g>
      </svg>

      <Overlays
        distanceMeters={distanceMeters}
        exitNumber={props.exitNumber}
        signpostText={props.signpostText}
        roadNumbers={props.roadNumbers}
        directionLabel={goesLeft ? "Håll vänster" : "Håll höger"}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   2. ROUNDABOUT
   ───────────────────────────────────────────────────────────────── */
function RoundaboutDiagram(props: Props) {
  const exitN = Math.max(1, Math.min(6, props.roundaboutExitNumber || 2));
  const totalExits = Math.max(exitN + 1, 4); // assume at least 4 exits

  const cx = 160;
  const cy = 95;
  const rOuter = 55;
  const rInner = 22;

  // Entry from south (270°). Exits go anticlockwise (right-driving = clockwise),
  // first exit at ~90° from entry, etc.
  const entryAngle = Math.PI / 2; // bottom (south, 90° in screen coords)

  // For each exit, distribute around circle (right-hand traffic = clockwise)
  function angleOf(n: number): number {
    // Skip the entry itself, distribute remaining exits clockwise
    const step = (Math.PI * 2) / totalExits;
    return entryAngle - step * n; // going CCW in screen coords = right turn
  }

  const exits: { n: number; ang: number; x: number; y: number }[] = [];
  for (let i = 1; i <= totalExits; i++) {
    if (i === totalExits) continue; // last is the entry direction
    const a = angleOf(i);
    exits.push({
      n: i,
      ang: a,
      x: cx + Math.cos(a) * (rOuter + 30),
      y: cy - Math.sin(a) * (rOuter + 30),
    });
  }

  const targetExit = exits.find((e) => e.n === exitN) || exits[0];

  return (
    <div className="relative w-full bg-gradient-to-b from-slate-800 to-slate-900 overflow-hidden border-t border-primary-foreground/10 animate-fade-in">
      <svg viewBox="0 0 320 180" className="w-full h-44">
        <defs>
          <filter id="ra-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="0" y="0" width="320" height="180" fill="hsl(155, 25%, 22%)" />

        {/* Entry road from bottom */}
        <rect x={cx - 20} y={cy + rOuter - 5} width="40" height="100" fill="hsl(220, 12%, 26%)" />
        <line x1={cx} y1={cy + rOuter + 5} x2={cx} y2="180" stroke="white" strokeWidth="2" strokeDasharray="6 8" opacity="0.6" />

        {/* All exit roads */}
        {exits.map((e) => {
          const x2 = cx + Math.cos(e.ang) * (rOuter + 80);
          const y2 = cy - Math.sin(e.ang) * (rOuter + 80);
          const x1 = cx + Math.cos(e.ang) * rOuter;
          const y1 = cy - Math.sin(e.ang) * rOuter;
          // perpendicular offset for road width
          const dx = -Math.sin(e.ang) * 12;
          const dy = -Math.cos(e.ang) * 12;
          return (
            <g key={e.n}>
              <path
                d={`M ${x1 - dx} ${y1 - dy} L ${x2 - dx} ${y2 - dy} L ${x2 + dx} ${y2 + dy} L ${x1 + dx} ${y1 + dy} Z`}
                fill="hsl(220, 12%, 26%)"
              />
              {/* Exit number badge */}
              <circle cx={x2} cy={y2} r="11" fill={e.n === exitN ? "hsl(48, 96%, 53%)" : "hsl(220, 12%, 35%)"} stroke="white" strokeWidth="1.5" />
              <text
                x={x2} y={y2 + 4}
                textAnchor="middle"
                fontSize="13"
                fontWeight="900"
                fill={e.n === exitN ? "hsl(220, 50%, 20%)" : "white"}
              >
                {e.n}
              </text>
            </g>
          );
        })}

        {/* Roundabout circle */}
        <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="hsl(220, 12%, 26%)" strokeWidth="22" />
        <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="white" strokeWidth="1.5" opacity="0.8" />
        <circle cx={cx} cy={cy} r={rInner} fill="hsl(155, 35%, 30%)" stroke="white" strokeWidth="1.5" />

        {/* HIGHLIGHTED PATH — yellow arrow through roundabout to chosen exit */}
        {(() => {
          // Arc from entry (bottom) clockwise to target exit angle
          const startAng = entryAngle; // bottom
          const endAng = targetExit.ang;
          const sweep = 0; // clockwise in SVG (since y is flipped)
          const startX = cx + Math.cos(startAng) * rOuter;
          const startY = cy - Math.sin(startAng) * rOuter;
          const endX = cx + Math.cos(endAng) * rOuter;
          const endY = cy - Math.sin(endAng) * rOuter;
          // Largeness: if we have to go more than 180°
          const angDiff = ((startAng - endAng) + Math.PI * 2) % (Math.PI * 2);
          const largeArc = angDiff > Math.PI ? 1 : 0;
          // Tangent direction at exit point for arrow tip
          const tipX = cx + Math.cos(endAng) * (rOuter + 28);
          const tipY = cy - Math.sin(endAng) * (rOuter + 28);

          return (
            <g filter="url(#ra-glow)">
              {/* Entry stub */}
              <line
                x1={cx} y1={cy + rOuter + 60}
                x2={startX} y2={startY}
                stroke="hsl(48, 96%, 53%)" strokeWidth="8"
                strokeLinecap="round" opacity="0.85"
              />
              {/* Arc through roundabout */}
              <path
                d={`M ${startX} ${startY} A ${rOuter} ${rOuter} 0 ${largeArc} ${sweep} ${endX} ${endY}`}
                stroke="hsl(48, 96%, 53%)"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                opacity="0.9"
              />
              {/* Exit stub */}
              <line
                x1={endX} y1={endY}
                x2={tipX} y2={tipY}
                stroke="hsl(48, 96%, 53%)" strokeWidth="8"
                strokeLinecap="round"
              />
              {/* Animated dash overlay */}
              <path
                d={`M ${cx} ${cy + rOuter + 60} L ${startX} ${startY} A ${rOuter} ${rOuter} 0 ${largeArc} ${sweep} ${endX} ${endY} L ${tipX} ${tipY}`}
                stroke="white"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="6 10"
                opacity="0.9"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="16" to="0"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          );
        })()}
      </svg>

      <Overlays
        distanceMeters={props.distanceMeters}
        exitNumber={props.exitNumber || `${exitN}:a avfart`}
        signpostText={props.signpostText}
        roadNumbers={props.roadNumbers}
        directionLabel={`Rondell · ${exitN}:a avfart`}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   3. CITY INTERSECTION (cross)
   ───────────────────────────────────────────────────────────────── */
function IntersectionDiagram(props: Props) {
  const { icon } = props;
  const goesLeft = icon === "left" || icon === "sharp-left";
  const mirror = goesLeft;

  return (
    <div className="relative w-full bg-gradient-to-b from-slate-800 to-slate-900 overflow-hidden border-t border-primary-foreground/10 animate-fade-in">
      <svg viewBox="0 0 320 180" className="w-full h-44" style={mirror ? { transform: "scaleX(-1)" } : undefined}>
        <rect x="0" y="0" width="320" height="180" fill="hsl(155, 25%, 22%)" />

        {/* Vertical road (incoming) */}
        <rect x={130} y="60" width="60" height="120" fill="hsl(220, 12%, 26%)" />
        {/* Horizontal road */}
        <rect x="0" y={60} width="320" height="60" fill="hsl(220, 12%, 26%)" />

        {/* Center divider on incoming road */}
        <line x1={160} y1="120" x2={160} y2="180" stroke="white" strokeWidth="2" strokeDasharray="6 8" opacity="0.7" />
        {/* Crossing road dividers */}
        <line x1="0" y1={90} x2="130" y2={90} stroke="white" strokeWidth="2" strokeDasharray="6 8" opacity="0.7" />
        <line x1="190" y1={90} x2="320" y2={90} stroke="white" strokeWidth="2" strokeDasharray="6 8" opacity="0.7" />

        {/* HIGHLIGHTED yellow turn arrow (right turn) */}
        <path
          d="M 160 170 L 160 100 Q 160 80 180 80 L 290 80"
          stroke="hsl(48, 96%, 53%)"
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          opacity="0.9"
        />
        <polygon points="285,68 305,80 285,92" fill="hsl(48, 96%, 53%)" />

        {/* Animated dashes */}
        <path
          d="M 160 170 L 160 100 Q 160 80 180 80 L 290 80"
          stroke="white"
          strokeWidth="2"
          fill="none"
          strokeDasharray="6 10"
        >
          <animate attributeName="stroke-dashoffset" from="16" to="0" dur="1s" repeatCount="indefinite" />
        </path>
      </svg>

      <Overlays
        distanceMeters={props.distanceMeters}
        exitNumber={props.exitNumber}
        signpostText={props.signpostText}
        roadNumbers={props.roadNumbers}
        directionLabel={goesLeft ? "Sväng vänster" : "Sväng höger"}
      />
    </div>
  );
}
