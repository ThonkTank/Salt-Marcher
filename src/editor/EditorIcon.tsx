import type { ReactNode } from "react";

const paths = {
  select: <path d="m5 3 14 9-7 1-3 7-4-17Z" />,
  height: (
    <>
      <path d="m2 19 7-13 5 8 3-5 5 10H2Z" />
      <path d="m6.5 11 2.5 2 2.5-2" />
    </>
  ),
  forest: (
    <>
      <path d="m12 3-5 7h3l-5 7h14l-5-7h3l-5-7Z" />
      <path d="M12 17v4" />
    </>
  ),
  clearing: (
    <>
      <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />
      <path d="M8 12h8" />
    </>
  ),
  house: (
    <>
      <path d="m3 11 9-8 9 8M5 10v11h14V10" />
      <path d="M10 21v-7h4v7" />
    </>
  ),
  pan: (
    <>
      <path d="M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3" />
    </>
  ),
  road: (
    <>
      <path d="M6 3c12 5-12 13 0 18M18 3c12 5-12 13 0 18" />
      <path d="m12 4 1 3m-2 4-1 3m1 4 1 2" />
    </>
  ),
  river: (
    <>
      <path d="M14 3c-13 7 13 11-1 18M19 3c-13 7 13 11-1 18M8 3 4 7l4 4" />
    </>
  ),
  water: (
    <>
      <path d="M3 8q3-4 6 0t6 0 6 0M3 13q3-4 6 0t6 0 6 0M3 18q3-4 6 0t6 0 6 0" />
    </>
  ),
  ground: (
    <>
      <path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5" />
    </>
  ),
  region: (
    <>
      <path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0" />
    </>
  ),
  room: (
    <>
      <path d="M3 3h18v18H3V3Zm9 0v7m0 5v6M3 12h6m7 0h5" />
    </>
  ),
  erase: (
    <>
      <path d="m4 14 11-11 6 6-11 11H8l-4-4v-2Zm6-6 6 6M10 20h11" />
    </>
  ),
  assign: (
    <>
      <path d="M14 4h6v16h-6M3 12h12m-4-4 4 4-4 4" />
    </>
  ),
  door: (
    <>
      <path d="M5 21V3h14v18M5 21h14M9 21V6l10-3" />
      <path d="M15 12v2" />
    </>
  ),
  stairs: <path d="M3 21v-6h6V9h6V3h6M3 21h18V3" />,
  undo: (
    <>
      <path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12" />
    </>
  ),
  redo: (
    <>
      <path d="m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type EditorIconName = keyof typeof paths;

export function EditorIcon({ name }: { name: EditorIconName }) {
  return (
    <svg
      className="editor-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
