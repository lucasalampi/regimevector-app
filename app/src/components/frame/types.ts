import type { Doc } from '@/data';

/** Fit-to-width edition inside the Reader's scroll. Tapping a page asks to open it full screen. */
export interface InlineProps { doc: Doc; onOpen: (page: number) => void; onNote: (note: string) => void }

/** Full-screen edition: scrolls itself, zooms sharp, reports the page in view. */
export interface ViewerProps {
  doc: Doc;
  /** 1 = fit width. */
  zoom: number;
  /** 1-based page to open at. */
  page: number;
  onPage: (n: number) => void;
  onNote: (note: string) => void;
}

export const pagesNote = (n: number) => `${n} ${n === 1 ? 'page' : 'pages'}`;
export const FAIL_NOTE = 'could not render this edition';
