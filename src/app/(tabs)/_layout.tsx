import Feather from '@expo/vector-icons/Feather';
import { Link, Tabs } from 'expo-router';
import { Pressable } from 'react-native';

import { C } from '@/ui/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.acento,
        tabBarInactiveTintColor: '#6B756F',
        tabBarStyle: { backgroundColor: C.tarjeta, borderTopColor: C.linea, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', paddingBottom: 4 },
        headerStyle: { backgroundColor: C.fondo },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 22, color: C.tinta },
        headerTitleAlign: 'left',
        sceneStyle: { backgroundColor: C.fondo },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoy',
          tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size} color={color} />,
          headerRight: () => (
            <Link href="/ajustes" asChild>
              <Pressable accessibilityLabel="Ajustes" hitSlop={12} style={{ padding: 10, marginRight: 8 }}>
                <Feather name="settings" size={22} color={C.tinta} />
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="pacientes"
        options={{ title: 'Pacientes', tabBarIcon: ({ color, size }) => <Feather name="users" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="resumen"
        options={{ title: 'Resumen', tabBarIcon: ({ color, size }) => <Feather name="bar-chart-2" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
