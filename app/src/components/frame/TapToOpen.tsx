import { Text, View } from 'react-native';
import { C, font } from '@/theme';

/** Navy/gold call-to-action strip laid over an edition preview. */
export function TapToOpen({ label }: { label: string }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingVertical: 12, alignItems: 'center', backgroundColor: 'rgba(12,24,41,.92)', borderTopWidth: 2, borderTopColor: C.gold }}>
      <Text style={[font(700, 12), { color: '#fff', letterSpacing: 0.96, textTransform: 'uppercase' }]}>{label}</Text>
    </View>
  );
}
