// Short synthesized sounds with the Web Audio API: no audio files to download, works offline.
// Off by default; the Profile toggle turns them on. Every sound is under half a second.
import { useStore } from '../store/useStore'

export type SoundKind = 'complete' | 'correct' | 'wrong' | 'card' | 'badge'

let ctx: AudioContext | null = null

function context(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface Note { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number }

const SOUNDS: Record<SoundKind, Note[]> = {
  // A rising three-note chime
  complete: [
    { freq: 523.25, at: 0, dur: 0.12 },
    { freq: 659.25, at: 0.11, dur: 0.12 },
    { freq: 783.99, at: 0.22, dur: 0.22 },
  ],
  correct: [{ freq: 880, at: 0, dur: 0.12 }],
  wrong: [{ freq: 196, at: 0, dur: 0.16, type: 'triangle', gain: 0.12 }],
  card: [{ freq: 600, at: 0, dur: 0.05, type: 'square', gain: 0.05 }],
  badge: [
    { freq: 659.25, at: 0, dur: 0.1 },
    { freq: 783.99, at: 0.1, dur: 0.1 },
    { freq: 1046.5, at: 0.2, dur: 0.3 },
  ],
}

/** Play a sound if the learner has turned sounds on. Safe to call anywhere; never throws. */
export function playSound(kind: SoundKind) {
  try {
    if (!useStore.getState().settings.sound) return
    const ac = context()
    if (!ac) return
    const t0 = ac.currentTime
    for (const n of SOUNDS[kind]) {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = n.type ?? 'sine'
      osc.frequency.value = n.freq
      const g = n.gain ?? 0.15
      gain.gain.setValueAtTime(0.0001, t0 + n.at)
      gain.gain.exponentialRampToValueAtTime(g, t0 + n.at + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur)
      osc.connect(gain).connect(ac.destination)
      osc.start(t0 + n.at)
      osc.stop(t0 + n.at + n.dur + 0.02)
    }
  } catch {
    /* audio is best effort */
  }
}
