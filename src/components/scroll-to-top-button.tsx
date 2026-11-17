'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { Button } from './ui/button'

export default function ScrollToTopButton() {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const scrolled = !entry.isIntersecting
          setIsScrolled(scrolled)
          document.documentElement.classList.toggle('scrolled', scrolled)
        }
      },
      { root: null, rootMargin: '120px 0px 0px 0px', threshold: 0 },
    )

    observer.observe(sentinel)
    return () => {
      observer.disconnect()
      document.documentElement.classList.remove('scrolled')
    }
  }, [])

  return (
    <>
      <div ref={sentinelRef} className="scroll-sentinel" aria-hidden="true" />
      <Button
        type="button"
        data-scrolled={isScrolled ? 'true' : 'false'}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Scroll to top"
        title="Scroll to top"
        className="back-to-top"
      >
        <ArrowUp className="h-5 w-5" aria-hidden="true" />
      </Button>
    </>
  )
}
