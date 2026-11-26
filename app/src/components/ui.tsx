import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { C, font, kicker, MUTED, ON } from '@/theme';
import { ChevronRight } from './icons';

/** Pressable with the DS hover/pressed tint (accent-100). */
export function Tap({ style, hoverBg = C.a100, children, ...rest }: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; hoverBg?: string; children?: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      style={state => [style, ((state as { hovered?: boolean }).hovered || state.pressed) && { backgroundColor: hoverBg }]}>
      {children}
    </Pressable>
  );
}

/** Screen body: scrolls, padded like the prototype's per-screen wrappers. */
export function Screen({ children, pad = [18, 18, 28], gap = 22, style }: { children: ReactNode; pad?: [number, number, number]; gap?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={[{ paddingTop: pad[0], paddingHorizontal: pad[1], paddingBottom: pad[2], gap }, style]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export const Kicker = ({ children, color, style }: { children: ReactNode; color?: string; style?: object }) => (
  <Text style={[kicker, color ? { color } : null, style]}>{children}</Text>
);

/** `.blueprint` from the DS as overridden in v2: white plate, hairline border, corners hidden. */
export const blueprint: ViewStyle = { backgroundColor: C.paper, borderWidth: 1, borderColor: C.divider };

export function Seg<T extends string>({ options, value, onChange, height = 44, size = 13, itemWidth, fit }: {
  options: readonly T[]; value: T; onChange: (v: T) => void; height?: number; size?: number; itemWidth?: number;
  /** Size each item to its label and share the spare width (long and short labels side by side). */
  fit?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: C.divider }} accessibilityRole="tablist">
      {options.map(o => {
        const on = o === value;
        return (
          <Tap key={o} onPress={() => onChange(o)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            hoverBg={on ? ON : C.a100}
            style={[{ height, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? ON : 'transparent' }, itemWidth ? { width: itemWidth } : fit ? { flexGrow: 1, flexBasis: 'auto', paddingHorizontal: 6 } : { flex: 1 }]}>
            <Text style={[font(500, size), { color: on ? '#fff' : C.text }]} numberOfLines={1}>{o}</Text>
          </Tap>
        );
      })}
    </View>
  );
}

export function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.primary, { backgroundColor: pressed ? C.a800 : hovered ? C.a700 : C.a600 }]}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

export function OutlineButton({ label, onPress, muted }: { label: string; onPress: () => void; muted?: boolean }) {
  return (
    <Tap onPress={onPress} style={[styles.outline, { borderColor: muted ? C.divider : C.a700 }]}>
      <Text style={[styles.outlineText, { color: muted ? C.text : C.a700 }]}>{label}</Text>
    </Tap>
  );
}

/** Programme header bar: navy with gold top rule. */
export function ProgrammeBar({ label, note, style }: { label: string; note?: string; style?: ViewStyle }) {
  return (
    <View style={[styles.progBar, style]}>
      <Text style={styles.progText}>{label}</Text>
      {note ? <Text style={styles.progNote}>{note}</Text> : null}
    </View>
  );
}

/** Two-line list row with chevron (Latest research, Saved research, More). */
export function DocRow({ title, sub, kind, onPress, border = 'top', minHeight = 52 }: {
  title: string; sub: string; kind?: string; onPress: () => void; border?: 'top' | 'bottom'; minHeight?: number;
}) {
  return (
    <Tap onPress={onPress} style={[styles.docRow, { minHeight }, border === 'top' ? { borderTopWidth: 1 } : { borderBottomWidth: 1 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {kind ? <Text style={[font(600, 10), { letterSpacing: 0.8, textTransform: 'uppercase', color: C.a700 }]}>{kind}</Text> : null}
        <Text style={[font(500, 15, 1.3), { color: C.text }]}>{title}</Text>
        <Text style={[font(400, 12), { color: MUTED }]}>{sub}</Text>
      </View>
      <ChevronRight />
    </Tap>
  );
}

const styles = StyleSheet.create({
  primary: { height: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.a600 },
  primaryText: { ...font(700, 15), color: '#fff', letterSpacing: 0.9, textTransform: 'uppercase' },
  outline: { height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  outlineText: { ...font(700, 13), letterSpacing: 0.78, textTransform: 'uppercase' },
  progBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, backgroundColor: C.navyMid, borderTopWidth: 2, borderTopColor: C.gold, paddingVertical: 8, paddingHorizontal: 12 },
  progText: { ...font(700, 11, 1.3), letterSpacing: 1.1, textTransform: 'uppercase', color: '#fff', flexShrink: 1 },
  progNote: { ...font(400, 10), letterSpacing: 0.2, color: C.a400 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderColor: C.divider },
});
