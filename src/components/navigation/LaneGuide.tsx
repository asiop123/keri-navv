import { ArrowUp, ArrowUpLeft, ArrowUpRight, ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import type { ManeuverIcon } from "@/hooks/useTurnByTurn";

interface Lane {
  directions: ManeuverIcon[];
  follow: boolean;
}

/**
 * Synthesize a likely lane configuration from maneuver + junctionType.
 * (TomTom REST API doesn't return real lane data — only their Navigation SDK does.
 * This is an honest visual approximation.)
 */
function synthesizeLanes(icon: ManeuverIcon, junctionType: string): Lane[] {
  const j = (junctionType || "").toUpperCase();
  const isBifurcation = j.includes("BIFURCATION");
  const isExit = j.includes("EXIT") || j.includes("RAMP");

  // Highway split / exit → 3 lanes typically
  if (isExit || isBifurcation) {
    if (icon === "slight-right" || icon === "right") {
      return [
        { directions: ["straight"], follow: false },
        { directions: ["straight"], follow: false },
        { directions: ["slight-right"], follow: true },
      ];
    }
    if (icon === "slight-left" || icon === "left") {
      return [
        { directions: ["slight-left"], follow: true },
        { directions: ["straight"], follow: false },
        { directions: ["straight"], follow: false },
      ];
    }
    if (icon === "straight") {
      return [
        { directions: ["straight"], follow: true },
        { directions: ["straight"], follow: true },
        { directions: ["slight-right"], follow: false },
      ];
    }
  }

  // City turn → 2 lanes
  if (icon === "left" || icon === "sharp-left") {
    return [
      { directions: ["left"], follow: true },
      { directions: ["straight", "right"], follow: false },
    ];
  }
  if (icon === "right" || icon === "sharp-right") {
    return [
      { directions: ["left", "straight"], follow: false },
      { directions: ["right"], follow: true },
    ];
  }
  return [];
}

function LaneArrow({ dir, active }: { dir: ManeuverIcon; active: boolean }) {
  const cls = `h-5 w-5 ${active ? "text-secondary" : "text-primary-foreground/40"}`;
  switch (dir) {
    case "left": return <ArrowLeft className={cls} />;
    case "right": return <ArrowRight className={cls} />;
    case "sharp-left": return <ArrowLeft className={`${cls} -rotate-12`} />;
    case "sharp-right": return <ArrowRight className={`${cls} rotate-12`} />;
    case "slight-left": return <ArrowUpLeft className={cls} />;
    case "slight-right": return <ArrowUpRight className={cls} />;
    case "uturn": return <RotateCcw className={cls} />;
    default: return <ArrowUp className={cls} />;
  }
}

export function LaneGuide({
  icon,
  junctionType,
}: {
  icon: ManeuverIcon;
  junctionType: string;
}) {
  const lanes = synthesizeLanes(icon, junctionType);
  if (lanes.length === 0) return null;

  return (
    <div className="flex items-end justify-center gap-1.5 px-3 py-2 bg-primary-foreground/5 border-t border-primary-foreground/10">
      {lanes.map((lane, i) => (
        <div
          key={i}
          className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md ${
            lane.follow ? "bg-secondary/20" : "bg-transparent"
          }`}
        >
          <div className="flex items-center gap-0.5">
            {lane.directions.map((d, k) => (
              <LaneArrow key={k} dir={d} active={lane.follow} />
            ))}
          </div>
          <div className={`h-0.5 w-6 rounded-full ${lane.follow ? "bg-secondary" : "bg-primary-foreground/20"}`} />
        </div>
      ))}
    </div>
  );
}
