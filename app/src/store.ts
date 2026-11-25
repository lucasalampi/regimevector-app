import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Role } from '@/data';

/** Timeline: clean plot with a regime ribbon (default). Overlay: regime tints behind the line. */
export type ChartStyle = 'Timeline' | 'Overlay';
export type MapStyle = 'Matrix' | 'Ranked';
export type NotifKey = 'daily' | 'event' | 'regime' | 'pos';

interface AppState {
  authed: boolean;
  email: string;
  role: Role;
  watch: string[];
  saved: string[];
  read: string[];
  notif: Record<NotifKey, boolean>;
  chartStyle: ChartStyle;
  mapStyle: MapStyle;
  signIn: (email: string, role: Role) => void;
  signOut: () => void;
  setRole: (r: Role) => void;
  toggleWatch: (s: string) => void;
  toggleSaved: (id: string) => void;
  markRead: (id: string) => void;
  toggleNotif: (k: NotifKey) => void;
  setChartStyle: (s: ChartStyle) => void;
  setMapStyle: (s: MapStyle) => void;
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

export const useApp = create<AppState>()(
  persist(
    set => ({
      authed: false,
      email: '',
      role: 'Client',
      watch: ['US 10Y', 'S&P 500', 'USDCAD', 'Gold'],
      saved: [],
      read: [],
      notif: { daily: true, event: true, regime: true, pos: false },
      chartStyle: 'Timeline',
      mapStyle: 'Matrix',
      // Mock auth: any valid email + 6-char password. Replace with the real identity provider.
      signIn: (email, role) => set({ authed: true, email, role }),
      signOut: () => set({ authed: false }),
      setRole: role => set({ role }),
      toggleWatch: s => set(st => ({ watch: toggle(st.watch, s) })),
      toggleSaved: id => set(st => ({ saved: toggle(st.saved, id) })),
      markRead: id => set(st => (st.read.includes(id) ? st : { read: [...st.read, id] })),
      toggleNotif: k => set(st => ({ notif: { ...st.notif, [k]: !st.notif[k] } })),
      setChartStyle: chartStyle => set({ chartStyle }),
      setMapStyle: mapStyle => set({ mapStyle }),
    }),
    {
      name: 'rv-app', version: 3, storage: createJSONStorage(() => AsyncStorage),
      // v1 kept a reader font/zoom size (zoom now lives in the full-screen viewer).
      migrate: s => {
        const { fs: _fs, ...rest } = (s ?? {}) as Record<string, unknown>;
        // v2 offered Bands / Strip / Rules; Bands maps to Overlay, the others to the new Timeline default.
        rest.chartStyle = rest.chartStyle === 'Bands' ? 'Overlay' : 'Timeline';
        return rest as unknown as AppState;
      },
    },
  ),
);

export function useHydrated() {
  const [h, setH] = useState(useApp.persist.hasHydrated());
  useEffect(() => useApp.persist.onFinishHydration(() => setH(true)), []);
  return h;
}
