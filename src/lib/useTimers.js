import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from './storage'

const IDLE = { endsAt: null, duration: 0, label: '', kind: 'rest', target: null }

// Cronometro (tempo totale seduta) + conto alla rovescia (recupero, oppure esercizio/cardio a tempo).
// Entrambi sono basati su timestamp, quindi sopravvivono a ricarica pagina e schermo spento.
// Il conto alla rovescia si ferma da solo a zero e chiama onCountdownEnd(countdown).
export function useTimers({ sound = true, onCountdownEnd } = {}) {
  const [sw, setSw] = useLocalStorage('palestra:stopwatch', { startedAt: null, accumulated: 0, laps: [], sessionId: null, firstStartAt: null })
  const [rest, setRest] = useLocalStorage('palestra:rest', IDLE)
  const [now, setNow] = useState(Date.now())
  const [finished, setFinished] = useState(null) // ultimo conto alla rovescia terminato, per un avviso breve
  const firedRef = useRef(null)
  const endRef = useRef(onCountdownEnd)
  endRef.current = onCountdownEnd

  const active = sw.startedAt != null || rest.endsAt != null
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [active])

  const elapsed = sw.accumulated + (sw.startedAt != null ? now - sw.startedAt : 0)
  const restLeft = rest.endsAt != null ? Math.max(0, rest.endsAt - now) : 0

  // Fine conto alla rovescia: suono + vibrazione, stop automatico, callback
  useEffect(() => {
    if (rest.endsAt == null || restLeft > 0 || firedRef.current === rest.endsAt) return
    firedRef.current = rest.endsAt
    const ended = rest
    if (sound) beep()
    navigator.vibrate?.([300, 150, 300])
    setRest((r) => (r.endsAt === ended.endsAt ? IDLE : r))
    setFinished({ ...ended, at: Date.now() })
    endRef.current?.(ended)
  }, [rest, restLeft, sound, setRest])

  useEffect(() => {
    if (!finished) return
    const id = setTimeout(() => setFinished(null), 4000)
    return () => clearTimeout(id)
  }, [finished])

  // sessionId: seduta misurata dal cronometro (la durata salvata usa il cronometro solo per quella seduta)
  const startStopwatch = useCallback(
    (sessionId = null) =>
      setSw((s) => {
        if (typeof sessionId !== 'string') sessionId = null // usato anche come onClick: ignora l'evento
        if (s.startedAt != null) return s
        const fresh = !s.accumulated
        const t = Date.now()
        return { ...s, startedAt: t, sessionId: fresh ? sessionId : (s.sessionId ?? sessionId), firstStartAt: fresh ? t : (s.firstStartAt ?? t) }
      }),
    [setSw],
  )
  const pauseStopwatch = useCallback(
    () =>
      setSw((s) =>
        s.startedAt == null ? s : { ...s, startedAt: null, accumulated: s.accumulated + Date.now() - s.startedAt },
      ),
    [setSw],
  )
  const resetStopwatch = useCallback(() => setSw({ startedAt: null, accumulated: 0, laps: [], sessionId: null, firstStartAt: null }), [setSw])
  const lap = useCallback(
    () =>
      setSw((s) => {
        const t = s.accumulated + (s.startedAt != null ? Date.now() - s.startedAt : 0)
        return { ...s, laps: [...s.laps, t] }
      }),
    [setSw],
  )

  // kind: 'rest' (recupero) | 'work' (esercizio/cardio a tempo, target = cosa segnare come fatto a fine tempo)
  const startRest = useCallback(
    (seconds, label = 'Recupero', { kind = 'rest', target = null } = {}) => {
      unlockAudio()
      setFinished(null)
      setRest({ endsAt: Date.now() + seconds * 1000, duration: seconds, label, kind, target })
      setNow(Date.now())
    },
    [setRest],
  )
  const addRest = useCallback(
    (seconds) =>
      setRest((r) =>
        r.endsAt == null
          ? r
          : { ...r, endsAt: Math.max(Date.now() + 1000, r.endsAt + seconds * 1000), duration: Math.max(1, r.duration + seconds) },
      ),
    [setRest],
  )
  const stopRest = useCallback(() => setRest(IDLE), [setRest])

  return {
    elapsed,
    running: sw.startedAt != null,
    sessionId: sw.sessionId ?? null,
    // misura del cronometro attribuibile a una seduta (null se misura altro): tempo attivo e primo avvio
    stopwatchFor: (id) => (sw.sessionId === id ? { activeMs: sw.accumulated + (sw.startedAt != null ? Date.now() - sw.startedAt : 0), firstStartAt: sw.firstStartAt ?? null } : null),
    laps: sw.laps,
    startStopwatch,
    pauseStopwatch,
    resetStopwatch,
    lap,
    rest: {
      active: rest.endsAt != null,
      left: restLeft,
      duration: rest.duration,
      label: rest.label,
      kind: rest.kind ?? 'rest',
      target: rest.target,
    },
    finished,
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
