// Small rounded line icons for the opening menu (24px grid, 1.8 stroke, round caps). Decorative: the label beside
// each one carries the meaning, so they are aria-hidden.
const P: Record<string, string[]> = {
  checkup: ['M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z', 'M3.5 12H9l1-2 2 4.5 2-6 1.5 3.5h5'],
  arcade: ['M6 11h4', 'M8 9v4', 'M15 12h.01', 'M18 10h.01', 'M17.3 5H6.7a4 4 0 0 0-4 3.6C2.6 9.4 2 14.5 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.4-1.4A2 2 0 0 1 9.8 16h4.4a2 2 0 0 1 1.4.6L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.5-.6-6.6-.7-7.3A4 4 0 0 0 17.3 5Z'],
  cuddle: ['M8 14s1.5 2 4 2 4-2 4-2', 'M9 9.5h.01', 'M15 9.5h.01', 'M12 22a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M6.5 6.2 5 3.5', 'M17.5 6.2 19 3.5'],
  sunday: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  capsule: ['M6 3h12l4 6-10 13L2 9Z', 'M11 3 8 9l4 13 4-13-3-6', 'M2 9h20'],
  settings: ['M20 7h-9', 'M14 17H5', 'M17 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', 'M7 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  studio: ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9Z'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.9 1.9 0 0 0 3.4 0'],
  heart: ['M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z'],
};
export function Ico({ name, size = 18 }: { name: keyof typeof P | string; size?: number }) {
  return (
    <svg className="ico-line" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {(P[name] ?? P.heart).map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}
