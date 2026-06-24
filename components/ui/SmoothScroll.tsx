'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';

const ReactLenis = dynamic(() => import('lenis/react').then(mod => mod.ReactLenis), { ssr: false });

interface SmoothScrollProps {
  children: ReactNode;
}

export default function SmoothScroll({ children }: SmoothScrollProps) {
  return (
    <>
      <ReactLenis root options={{ lerp: 0.08, duration: 1.2, smoothWheel: true }} />
      {children}
    </>
  );
}
