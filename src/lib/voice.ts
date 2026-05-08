/**
 * Svensk röstuppläsning via webbläsarens speechSynthesis.
 * Throttlad så samma fras inte upprepas inom 8 sekunder.
 */

let muted = false;
let svVoice: SpeechSynthesisVoice | null = null;
const recent = new Map<string, number>();

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === 'sv-SE') ||
    voices.find((v) => v.lang.startsWith('sv')) ||
    null
  );
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  svVoice = pickVoice();
  window.speechSynthesis.onvoiceschanged = () => {
    svVoice = pickVoice();
  };
}

export function setVoiceMuted(value: boolean) {
  muted = value;
  if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function isVoiceMuted() {
  return muted;
}

/**
 * Säg en fras på svenska. Samma fras säg inte oftare än var 8:e sekund.
 */
export function speak(text: string, opts: { priority?: 'low' | 'high' } = {}) {
  if (muted) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (!text) return;

  const now = Date.now();
  const last = recent.get(text);
  if (last && now - last < 8000) return;
  recent.set(text, now);

  // Cleanup old entries
  if (recent.size > 30) {
    for (const [k, t] of recent.entries()) if (now - t > 60000) recent.delete(k);
  }

  if (opts.priority === 'high') {
    window.speechSynthesis.cancel();
  }

  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'sv-SE';
  u.rate = 1.0;
  u.pitch = 1.0;
  if (svVoice) u.voice = svVoice;
  window.speechSynthesis.speak(u);
}

export function cancelSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  recent.clear();
}
