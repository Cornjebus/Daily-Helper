"use client"

import { useEffect, useRef, useState } from 'react'

export function SessionTimer({ minutes = 5 }: { minutes?: number }) {
  const total = minutes * 60
  const [remaining, setRemaining] = useState(total)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    start()
    return stop
  }, [])

  const start = () => {
    stop()
    intervalRef.current = setInterval(() => {
      setRemaining(prev => (prev > 0 ? prev - 1 : 0))
    }, 1000)
  }

  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
  }

  const reset = () => setRemaining(total)

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="font-mono">{mm}:{ss}</span>
      <button className="underline" onClick={reset}>Reset</button>
    </div>
  )
}

