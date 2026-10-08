// Nubecita en el encabezado: dice de un vistazo si todo está respaldado.

import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable } from 'react-native';

import { useRespaldo } from '@/sync/proveedor';

import { C } from './theme';

export function IconoRespaldo() {
  const { conNube, sincronizando, pendientes, error } = useRespaldo();
  if (!conNube) return null;

  let etiqueta = 'Todo respaldado';
  let contenido = <Feather name="cloud" size={21} color={C.acento} />;
  if (sincronizando) {
    etiqueta = 'Respaldando';
    contenido = <ActivityIndicator size="small" color={C.acento} />;
  } else if (error) {
    etiqueta = 'No se pudo respaldar';
    contenido = <Feather name="cloud-off" size={21} color={C.aviso} />;
  } else if (pendientes > 0) {
    etiqueta = `${pendientes} cambios por respaldar`;
    contenido = <Feather name="upload-cloud" size={21} color={C.tenue} />;
  }

  return (
    <Pressable accessibilityLabel={etiqueta} hitSlop={8} onPress={() => router.push('/ajustes')} style={{ padding: 10 }}>
      {contenido}
    </Pressable>
  );
}
