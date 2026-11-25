import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton, Seg } from '@/components/ui';
import type { Role } from '@/data';
import { useApp } from '@/store';
import { C, font, kicker, MUTED } from '@/theme';

export default function Login() {
  const insets = useSafeAreaInsets();
  const signIn = useApp(s => s.signIn);
  const [email, setEmail] = useState(useApp.getState().email);
  const [pw, setPw] = useState('');
  const [role, setRole] = useState<Role>(useApp.getState().role);
  const [err, setErr] = useState('');
  const [focus, setFocus] = useState<string | null>(null);

  const submit = () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter a valid work email.');
    if (pw.length < 6) return setErr('Password must be at least 6 characters.');
    setErr('');
    signIn(email.trim(), role);
  };

  const input = (k: string) => [styles.input, focus === k && { borderColor: C.a700 }];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: 56 + insets.top, paddingBottom: 28 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <Text style={[font(700, 32, 1), { letterSpacing: -0.48, color: C.text }]} accessibilityRole="header">
            Regime<Text style={{ color: C.gold }}>Vector</Text>
          </Text>
          <Text style={[font(400, 15, 1.45), { color: MUTED }]}>Cross-asset regime intelligence. Daily classification, research editions and event notes.</Text>
        </View>
        <View style={{ gap: 14, marginTop: 18 }}>
          <View style={{ gap: 5 }}>
            <Text style={kicker}>Work email</Text>
            <TextInput value={email} onChangeText={t => { setEmail(t); setErr(''); }} placeholder="name@firm.com" placeholderTextColor={C.n500}
              keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="username" accessibilityLabel="Work email"
              onFocus={() => setFocus('e')} onBlur={() => setFocus(null)} style={input('e')} />
          </View>
          <View style={{ gap: 5 }}>
            <Text style={kicker}>Password</Text>
            <TextInput value={pw} onChangeText={t => { setPw(t); setErr(''); }} placeholder="6+ characters" placeholderTextColor={C.n500}
              secureTextEntry autoComplete="password" textContentType="password" accessibilityLabel="Password" onSubmitEditing={submit}
              onFocus={() => setFocus('p')} onBlur={() => setFocus(null)} style={input('p')} />
          </View>
          <View style={{ gap: 5 }}>
            <Text style={kicker}>Access</Text>
            <Seg options={['Client', 'Internal'] as const} value={role} onChange={setRole} size={14} />
          </View>
          {err ? <Text style={styles.err} accessibilityRole="alert">{err}</Text> : null}
        </View>
        <View style={{ marginTop: 6 }}><PrimaryButton label="Sign in" onPress={submit} /></View>
        <Text style={[font(400, 12, 1.45), { color: MUTED, marginTop: 'auto' }]}>
          Research content is interpretive commentary on a classified state. It is not investment advice.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: 28, gap: 22 },
  input: { height: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: C.divider, ...font(400, 16), color: C.text, borderRadius: 0 },
  err: { ...font(500, 13), color: C.a800, borderWidth: 1, borderColor: C.a700, paddingVertical: 8, paddingHorizontal: 10 },
});
