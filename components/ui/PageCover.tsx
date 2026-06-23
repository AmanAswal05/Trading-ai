'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function PageCover() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [animating, setAnimating] = useState(true);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!active) return;
      setVisible(true);
      setAnimating(true);
    }, 0);

    const startFade = setTimeout(() => {
      if (!active) return;
      setAnimating(false);
    }, 20);

    const endTransition = setTimeout(() => {
      if (!active) return;
      setVisible(false);
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(startFade);
      clearTimeout(endTransition);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 pointer-events-none transition-opacity duration-200 ease-out bg-bg-primary ${
        animating ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}
