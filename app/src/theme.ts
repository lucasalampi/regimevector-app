import type { TextStyle } from 'react-native';

// House tokens from "RegimeVector Mobile v2" (Industry DS, re-keyed to RV navy + gold).
export const C = {
  bg: '#f4f7fa',
  surface: '#e4e9ee',
  paper: '#ffffff',
  text: '#0b0f1a',
  divider: '#d9e0e7',
  n500: '#7a8fa3',
  n700: '#3a4d61',
  n800: '#3a4d61',
  a100: '#eef2f6',
  a200: '#dfe6ee',
  a300: '#c4cdd6',
  a400: '#9fb0c2',
  a600: '#15304e',
  a700: '#15304e',
  a800: '#0c1829',
  navy: '#0c1829',
  navyMid: '#15304e',
  navyLine: '#22395a',
  navyInk: '#a9b8c8',
  gold: '#bc9330',
  cream: '#fbf6ea',
  up: '#185c38',
  down: '#8b2020',
  noticeBg: '#fdf8ee',
  noticeInk: '#6b4800',
} as const;

export const ON = C.a700;
export const MUTED = C.n700;

/** Level tints for internal-role dimension cells: [fill, ink]. */
export const LEVEL_TINT: Record<string, [string, string]> = {
  RED: ['#fdf0f0', '#8b2020'],
  AMBER: ['#fdf8ee', '#6b4800'],
  GREEN: ['#ebf4ee', '#185c38'],
};

const FAMILY = { 400: 'Inter_400Regular', 500: 'Inter_500Medium', 600: 'Inter_600SemiBold', 700: 'Inter_700Bold' } as const;
export type Weight = keyof typeof FAMILY;

/** CSS `font: <weight> <size>/<lineHeight>` shorthand for React Native. */
export function font(weight: Weight, size: number, lineHeight?: number): TextStyle {
  return { fontFamily: FAMILY[weight], fontSize: size, ...(lineHeight ? { lineHeight: Math.round(size * lineHeight) } : null) };
}

/** Uppercase micro label used for every section heading. */
export const kicker: TextStyle = { ...font(600, 11), letterSpacing: 0.88, textTransform: 'uppercase', color: MUTED };

export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/** `color-mix(in srgb, <hex> p%, transparent)` equivalent. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

export const changeColor = (c?: string | null) => (!c ? MUTED : c[0] === '+' ? C.up : c[0] === '−' ? C.down : MUTED);
