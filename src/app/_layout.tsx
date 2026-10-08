import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { migrar, NOMBRE_BD } from '@/data/db';
import { ProveedorRespaldo, useRespaldo } from '@/sync/proveedor';
import { C } from '@/ui/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName={NOMBRE_BD} onInit={migrar}>
        <ProveedorRespaldo>
          <StatusBar style="dark" />
          <Navegacion />
        </ProveedorRespaldo>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

function Navegacion() {
  const { conNube, sesion, cargandoSesion } = useRespaldo();
  useEffect(() => {
    if (!cargandoSesion) SplashScreen.hideAsync();
  }, [cargandoSesion]);

  // Sin nube configurada (desarrollo) se usa sin cuenta; con nube, primero hay que entrar.
  const adentro = !conNube || !!sesion;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: C.fondo },
        headerShadowVisible: false,
        headerTintColor: C.tinta,
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: 'Atrás',
        contentStyle: { backgroundColor: C.fondo },
      }}>
      <Stack.Protected guard={adentro}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="cita/nueva" options={{ title: 'Nueva cita', presentation: 'modal' }} />
        <Stack.Screen name="cita/[id]/index" options={{ title: 'Cita' }} />
        <Stack.Screen name="cita/[id]/nota" options={{ title: 'Anotar sesión' }} />
        <Stack.Screen name="cita/[id]/cobro" options={{ title: 'Cobrar' }} />
        <Stack.Screen name="paciente/nuevo" options={{ title: 'Paciente nuevo', presentation: 'modal' }} />
        <Stack.Screen name="paciente/[id]/index" options={{ title: 'Ficha' }} />
        <Stack.Screen name="paciente/[id]/historia" options={{ title: 'Historia clínica' }} />
        <Stack.Screen name="paciente/[id]/paquete" options={{ title: 'Vender paquete' }} />
        <Stack.Screen name="ajustes" options={{ title: 'Ajustes' }} />
      </Stack.Protected>
      <Stack.Protected guard={!adentro}>
        <Stack.Screen name="entrar" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Screen name="auth" options={{ headerShown: false }} />
    </Stack>
  );
}
