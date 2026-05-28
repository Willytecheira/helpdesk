"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Atajos globales:
 * - "?": muestra ayuda (TODO)
 * - "g d": ir al dashboard
 * - "g t": ir a tickets
 * - "g k": ir a KB
 * - "g i": ir a AI
 * - "n" en /tickets: crear ticket (TODO depende de la página)
 * Cmd+K se maneja en command-palette.tsx
 */
export function KeyboardShortcuts() {
  const router = useRouter()

  useEffect(() => {
    let lastKey = ""
    let lastTime = 0
    const handler = (e: KeyboardEvent) => {
      if (isInputElement(e.target)) return
      const now = Date.now()
      const seq = now - lastTime < 1000 ? lastKey + e.key.toLowerCase() : e.key.toLowerCase()

      switch (seq) {
        case "gd":
          router.push("/dashboard")
          break
        case "gt":
          router.push("/tickets")
          break
        case "gk":
          router.push("/kb")
          break
        case "gi":
          router.push("/ai")
          break
        case "gc":
          router.push("/customers")
          break
        case "gs":
          router.push("/settings/integrations")
          break
        case "gp":
          router.push("/profile")
          break
      }

      lastKey = e.key.toLowerCase()
      lastTime = now
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [router])

  return null
}

function isInputElement(t: EventTarget | null) {
  if (!t || !(t instanceof Element)) return false
  const tag = t.tagName.toLowerCase()
  return tag === "input" || tag === "textarea" || (t as HTMLElement).isContentEditable
}
