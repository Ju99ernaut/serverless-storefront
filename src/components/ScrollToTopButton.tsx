'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export default function ScrollToTopButton() {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const scrolled = !entry.isIntersecting;
          setIsScrolled(scrolled);
          document.documentElement.classList.toggle('scrolled', scrolled);
        }
      },
      { root: null, rootMargin: '120px 0px 0px 0px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove('scrolled');
    };
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="scroll-sentinel" aria-hidden="true" />
      <button
        type="button"
        data-scrolled={isScrolled ? 'true' : 'false'}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Scroll to top"
        title="Scroll to top"
        className="back-to-top inline-flex h-11 w-11 items-center justify-center rounded-none border border-[var(--border-color)] bg-[#5C5EDC] text-white shadow-lg hover:bg-[#494bc7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5C5EDC] cursor-pointer"
      >
        <ArrowUp className="h-5 w-5" aria-hidden="true" />
      </button>
    </>
  );
}
