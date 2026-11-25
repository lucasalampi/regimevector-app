import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Role } from '@/data';

export type ChartStyle = 'Bands' | 'Strip' | 'Rules';
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
  /** Reader zoom, 16 = 100%. */
  fs: number;
  chartStyle: ChartStyle;
  mapStyle: MapStyle;
  signIn: (email: string, role: Role) => void;
  signOut: () => void;
  setRole: (r: Role) => void;
  toggleWatch: (s: string) => void;
  toggleSaved: (id: string) => void;
  markRead: (id: string) => void;
  toggleNotif: (k: NotifKey) => void;
  zoom: (dir: 1 | -1) => void;
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
      fs: 16,
      chartStyle: 'Bands',
      mapStyle: 'Matrix',
      // Mock auth: any valid email + 6-char password. Replace with the real identity provider.
      signIn: (email, role) => set({ authed: true, email, role }),
      signOut: () => set({ authed: false }),
      setRole: role => set({ role }),
      toggleWatch: s => set(st => ({ watch: toggle(st.watch, s) })),
      toggleSaved: id => set(st => ({ saved: toggle(st.saved, id) })),
      markRead: id => set(st => (st.read.includes(id) ? st : { read: [...st.read, id] })),
      toggleNotif: k => set(st => ({ notif: { ...st.notif, [k]: !st.notif[k] } })),
      zoom: dir => set(st => ({ fs: Math.max(16, Math.min(40, st.fs + dir * 4)) })),
      setChartStyle: chartStyle => set({ chartStyle }),
      setMapStyle: mapStyle => set({ mapStyle }),
    }),
    { name: 'rv-app', version: 1, storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export function useHydrated() {
  const [h, setH] = useState(useApp.persist.hasHydrated());
  useEffect(() => useApp.persist.onFinishHydration(() => setH(true)), []);
  return h;
}
