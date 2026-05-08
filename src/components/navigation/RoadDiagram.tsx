import type { ManeuverIcon } from "@/hooks/useTurnByTurn";

/**
 * Visuell väg-illustration som ritar själva vägen i perspektiv,
 * med filer och ev. avfartsramp. Visar tydligt vilken fil chauffören ska ta.
 */
export function RoadDiagram({
  icon,
  junctionType,
  distanceMeters,
  exitNumber,
}: {
  icon: ManeuverIcon;
  junctionType: string;
  distanceMeters: number | null;
  exitNumber?: string;
}) {
  const j = (junctionType || "").toUpperCase();
  const isExit = j.includes("EXIT") || j.includes("RAMP");
  const isBifurcation = j.includes("BIFURCATION");
  const goesRight = icon === "right" || icon === "slight-right" || icon === "sharp-right";
  const goesLeft = icon === "left" || icon === "slight-left" || icon === "sharp-left";

  // Only draw the road diagram when there's a real split / exit ahead
  if (!isExit && !isBifurcation) return null;
  if (!goesRight && !goesLeft) return null;

  const showDistance =
    distanceMeters !== null && distanceMeters < 2000
      ? distanceMeters < 1000
        ? `${Math.max(0, Math.round(distanceMeters / 50) * 50)} m`
        : `${(distanceMeters / 1000).toFixed(1)} km`
      : null;

  // Mirror geometry for left exits
  const mirror = goesLeft;

  return (
    <div className="relative w-full bg-gradient-to-b from-slate-700 to-slate-800 overflow-hidden border-t border-primary-foreground/10">
      <svg
        viewBox="0 0 320 160"
        className="w-full h-40"
        style={mirror ? { transform: "scaleX(-1)" } : undefined}
      >
        {/* Sky/grass background */}
        <rect x="0" y="0" width="320" height="160" fill="hsl(155, 25%, 22%)" />

        {/* Main highway — perspective trapezoid (narrow at top, wide at bottom) */}
        <path
          d="M 100 10 L 220 10 L 280 160 L 40 160 Z"
          fill="hsl(220, 10%, 28%)"
        />

        {/* Exit ramp peeling off to the right */}
        <path
          d="M 220 10 Q 260 50 310 70 L 320 90 L 320 160 L 280 160 Z"
          fill="hsl(220, 10%, 28%)"
        />

        {/* Lane dividers on main highway (dashed white) */}
        <line
          x1="140" y1="10" x2="120" y2="160"
          stroke="white" strokeWidth="2" strokeDasharray="6 8" opacity="0.7"
        />
        <line
          x1="180" y1="10" x2="200" y2="160"
          stroke="white" strokeWidth="2" strokeDasharray="6 8" opacity="0.7"
        />

        {/* Solid white edge lines */}
        <path d="M 100 10 L 40 160" stroke="white" strokeWidth="2" opacity="0.9" />
        <path d="M 220 10 Q 260 50 310 70" stroke="white" strokeWidth="2" opacity="0.9" />

        {/* HIGHLIGHT — yellow path showing the correct lane to take */}
        <path
          d="M 200 30 Q 240 60 290 90 L 300 130"
          stroke="hsl(48, 96%, 53%)"
          strokeWidth="14"
          fill="none"
          strokeLinecap="round"
          opacity="0.85"
        />
        {/* Arrow tip */}
        <polygon
          points="290,118 310,130 290,142"
          fill="hsl(48, 96%, 53%)"
        />

        {/* Truck icon at bottom of highlighted lane */}
        <g transform="translate(180, 140)">
          <rect x="-10" y="-8" width="20" height="14" rx="2" fill="hsl(var(--secondary))" />
          <rect x="-8" y="-6" width="6" height="5" fill="white" opacity="0.8" />
        </g>
      </svg>

      {/* Overlay labels — NOT mirrored, positioned outside SVG */}
      <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none">
        <div className="flex justify-end">
          {exitNumber && (
            <div className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-xs font-black shadow-lg">
              AVFART {exitNumber}
            </div>
          )}
        </div>
        <div className="flex justify-between items-end">
          <div className="bg-primary/90 text-primary-foreground px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider">
            {goesRight ? "Håll höger" : "Håll vänster"}
          </div>
          {showDistance && (
            <div className="bg-background/90 text-foreground px-2 py-1 rounded-md text-sm font-black shadow-lg">
              {showDistance}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
