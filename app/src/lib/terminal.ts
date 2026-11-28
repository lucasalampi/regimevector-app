// Desktop "terminal" mode: the same app laid out for a computer (wide browser window, mouse and keyboard).
// Phones, tablets in portrait and native builds keep the mobile layout.
import { useEffect, useRef } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

export const TERMINAL_MIN_WIDTH = 1100;
/** From here the terminal adds its third (right-hand) pane. */
export const TERMINAL_WIDE = 1400;

/** Terminal with room for three panes. */
export function useTerminalWide() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= TERMINAL_WIDE;
}

/** True on web when the window is wide enough for the multi-pane terminal layout. */
export function useTerminal() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= TERMINAL_MIN_WIDTH;
}

/** Whether a key event came from a text field (shortcuts stay out of the way while typing). */
export const typing = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};

/**
 * Keyboard shortcuts for the terminal (web only). The handler always sees the latest props/state;
 * return true from it to mark the key as handled (prevents the browser default, e.g. page scroll).
 */
export function useKeys(handler: (e: KeyboardEvent) => boolean | void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const on = (e: KeyboardEvent) => {
      if (e.defaultPrevented || typing(e) || e.altKey || e.ctrlKey || e.metaKey) return;
      if (ref.current(e)) e.preventDefault();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [enabled]);
}
