import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from './storage'

// Cronometro (tempo totale seduta) + timer di recupero a conto alla rovescia.
// Entrambi sono basati su timestamp, quindi sopravvivono a ricarica pagina e schermo spento.
export function useTimers({ sound = true } = {}) {
  const [sw, setSw] = useLocalStorage('palestra:stopwatch', { startedAt: null, accumulated: 0, laps: [] })
  const [rest, setRest] = useLocalStorage('palestra:rest', { endsAt: null, duration: 0, label: '' })
  const [now, setNow] = useState(Date.now())
  const firedRef = useRef(null)

  const active = sw.startedAt != null || rest.endsAt != null
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [active])

  const elapsed = sw.accumulated + (sw.startedAt != null ? now - sw.startedAt : 0)
  const restLeft = rest.endsAt != null ? Math.max(0, rest.endsAt - now) : 0

  // Fine recupero: suono + vibrazione, una sola volta
  useEffect(() => {
    if (rest.endsAt != null && restLeft === 0 && firedRef.current !== rest.endsAt) {
      firedRef.current = rest.endsAt
      if (sound) beep()
      navigator.vibrate?.([300, 150, 300])
    }
  }, [rest.endsAt, restLeft, sound])

  const startStopwatch = useCallback(
    () => setSw((s) => (s.startedAt != null ? s : { ...s, startedAt: Date.now() })),
    [setSw],
  )
  const pauseStopwatch = useCallback(
    () =>
      setSw((s) =>
        s.startedAt == null ? s : { ...s, startedAt: null, accumulated: s.accumulated + Date.now() - s.startedAt },
      ),
    [setSw],
  )
  const resetStopwatch = useCallback(() => setSw({ startedAt: null, accumulated: 0, laps: [] }), [setSw])
  const lap = useCallback(
    () =>
      setSw((s) => {
        const t = s.accumulated + (s.startedAt != null ? Date.now() - s.startedAt : 0)
        return { ...s, laps: [...s.laps, t] }
      }),
    [setSw],
  )

  const startRest = useCallback(
    (seconds, label = 'Recupero') => {
      unlockAudio()
      setRest({ endsAt: Date.now() + seconds * 1000, duration: seconds, label })
      setNow(Date.now())
    },
    [setRest],
  )
  const addRest = useCallback(
    (seconds) => setRest((r) => (r.endsAt == null ? r : { ...r, endsAt: Math.max(Date.now(), r.endsAt + seconds * 1000) })),
    [setRest],
  )
  const stopRest = useCallback(() => setRest({ endsAt: null, duration: 0, label: '' }), [setRest])

  return {
    elapsed,
    running: sw.startedAt != null,
    laps: sw.laps,
    startStopwatch,
    pauseStopwatch,
    resetStopwatch,
    lap,
    rest: { active: rest.endsAt != null, left: restLeft, duration: rest.duration, label: rest.label },
    startRest,
    addRest,
    stopRest,
  }
}

let ctx
function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
  } catch {
    /* audio non disponibile */
  }
}

function beep() {
  try {
    unlockAudio()
    const t0 = ctx.currentTime
    ;[0, 0.35, 0.7].forEach((off) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = 880
      g.gain.setValueAtTime(0.0001, t0 + off)
      g.gain.exponentialRampToValueAtTime(0.4, t0 + off + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.25)
      o.connect(g).connect(ctx.destination)
      o.start(t0 + off)
      o.stop(t0 + off + 0.3)
    })
  } catch {
    /* audio non disponibile */
  }
}
