import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Masthead, TabBar } from '@/components/Chrome';
import { useApp, useHydrated } from '@/store';
import { C } from '@/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const hydrated = useHydrated();
  const authed = useApp(s => s.authed);
  const ready = fontsLoaded && hydrated;

  return (
    <SafeAreaProvider>
      <StatusBar style={authed ? 'light' : 'dark'} />
      {/* On web, hold the phone-width column the design is drawn at. */}
      <View style={{ flex: 1, backgroundColor: Platform.OS === 'web' ? C.surface : C.bg, alignItems: 'center' }}>
        <View style={{ flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 480 : undefined, backgroundColor: C.bg }}>
          {ready && authed ? <Masthead /> : null}
          <View style={{ flex: 1 }}>
            {ready ? (
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
                <Stack.Protected guard={!authed}>
                  <Stack.Screen name="login" options={{ animation: 'fade' }} />
                </Stack.Protected>
                <Stack.Protected guard={authed}>
                  <Stack.Screen name="index" options={{ animation: 'none' }} />
                  <Stack.Screen name="markets" options={{ animation: 'none' }} />
                  <Stack.Screen name="research" options={{ animation: 'none' }} />
                  <Stack.Screen name="events" options={{ animation: 'none' }} />
                  <Stack.Screen name="more" options={{ animation: 'none' }} />
                  <Stack.Screen name="asset" />
                  <Stack.Screen name="reader/[id]" />
                  <Stack.Screen name="positioning" />
                  <Stack.Screen name="watchlist" />
                  <Stack.Screen name="names" />
                  <Stack.Screen name="name/[tk]" />
                  <Stack.Screen name="search" />
                  <Stack.Screen name="settings" />
                </Stack.Protected>
              </Stack>
            ) : null}
          </View>
          {ready && authed ? <TabBar /> : null}
        </View>
      </View>
    </SafeAreaProvider>
  );
}
