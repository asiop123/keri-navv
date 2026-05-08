import { useEffect, useRef, useState } from 'react';
import type { GuidanceInstruction } from '@/services/tomtom';
import { speak } from '@/lib/voice';

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type ManeuverIcon =
  | 'left' | 'right' | 'sharp-left' | 'sharp-right'
  | 'slight-left' | 'slight-right' | 'straight'
  | 'roundabout' | 'uturn' | 'arrive' | 'depart';

export function maneuverToIcon(maneuver?: string): ManeuverIcon {
  const m = (maneuver || '').toUpperCase();
  if (m.includes('ROUNDABOUT')) return 'roundabout';
  if (m.includes('UTURN')) return 'uturn';
  if (m.includes('SHARP_LEFT')) return 'sharp-left';
  if (m.includes('SHARP_RIGHT')) return 'sharp-right';
  if (m.includes('BEAR_LEFT') || m.includes('SLIGHT_LEFT') || m.includes('KEEP_LEFT')) return 'slight-left';
  if (m.includes('BEAR_RIGHT') || m.includes('SLIGHT_RIGHT') || m.includes('KEEP_RIGHT')) return 'slight-right';
  if (m.includes('LEFT')) return 'left';
  if (m.includes('RIGHT')) return 'right';
  if (m.includes('ARRIVE')) return 'arrive';
  if (m.includes('DEPART')) return 'depart';
  return 'straight';
}

export interface CurrentGuidance {
  instruction: GuidanceInstruction | null;
  distanceMeters: number | null;
  icon: ManeuverIcon;
  message: string;
  street: string;
  signpostText: string;
  exitNumber: string;
  junctionType: string;
  roadNumbers: string[];
  roundaboutExitNumber: number;
  index: number;
}

interface Options {
  voice?: boolean;
}

/**
 * Givet listan med TomTom guidance instructions och chaufförens aktuella position,
 * returnera nästa sväng + avstånd. Säger även röst-cue:s vid 500m, 200m och vid svängen.
 */
export function useTurnByTurn(
  instructions: GuidanceInstruction[] | undefined,
  userPosition: { lat: number; lng: number } | null,
  opts: Options = {},
): CurrentGuidance {
  const [currentIdx, setCurrentIdx] = useState(0);
  const lastSpokeRef = useRef<{ idx: number; bucket: string } | null>(null);

  // Reset when instructions change
  useEffect(() => {
    setCurrentIdx(0);
    lastSpokeRef.current = null;
  }, [instructions]);

  const list = instructions || [];
  const safeIdx = Math.min(currentIdx, Math.max(0, list.length - 1));
  const current = list[safeIdx] || null;

  let distanceMeters: number | null = null;
  if (current && userPosition) {
    distanceMeters = haversineM(
      userPosition.lat, userPosition.lng,
      current.point.lat, current.point.lng,
    );
  }

  // Advance when within 30m
  useEffect(() => {
    if (!current || distanceMeters === null) return;
    if (distanceMeters < 30 && safeIdx < list.length - 1) {
      setCurrentIdx(safeIdx + 1);
    }
  }, [distanceMeters, current, safeIdx, list.length]);

  // Voice cues
  useEffect(() => {
    if (!opts.voice) return;
    if (!current || distanceMeters === null) return;
    const msg = current.message || '';
    if (!msg) return;

    let bucket: string | null = null;
    if (distanceMeters < 60) bucket = 'now';
    else if (distanceMeters < 220) bucket = '200';
    else if (distanceMeters < 520) bucket = '500';

    if (!bucket) return;
    const last = lastSpokeRef.current;
    if (last && last.idx === safeIdx && last.bucket === bucket) return;
    lastSpokeRef.current = { idx: safeIdx, bucket };

    let prefix = '';
    if (bucket === '500') prefix = 'Om 500 meter, ';
    else if (bucket === '200') prefix = 'Om 200 meter, ';
    speak(prefix + msg, { priority: bucket === 'now' ? 'high' : 'low' });
  }, [distanceMeters, current, safeIdx, opts.voice]);

  return {
    instruction: current,
    distanceMeters,
    icon: maneuverToIcon(current?.maneuver),
    message: current?.message || '',
    street: current?.street || '',
    signpostText: current?.signpostText || '',
    exitNumber: current?.exitNumber || '',
    junctionType: current?.junctionType || '',
    roadNumbers: current?.roadNumbers || [],
    index: safeIdx,
  };
}
