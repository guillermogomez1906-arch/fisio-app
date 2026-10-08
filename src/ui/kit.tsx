// Piezas de interfaz compartidas. Botones de al menos 44 px de alto para usarse con una mano.

import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRespaldo } from '@/sync/proveedor';

import { C, E, R } from './theme';

export type Icono = ComponentProps<typeof Feather>['name'];

/**
 * Carga datos cada vez que la pantalla gana el foco (al volver de otra pantalla)
 * y cuando el respaldo trae cambios de la nube.
 */
export function useAlEnfocar<T>(cargar: () => Promise<T>, deps: unknown[]): { datos: T | null; recargar: () => void } {
  const [datos, setDatos] = useState<T | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const { version } = useRespaldo();
  // La función de carga cambia en cada render; se guarda la última sin volver a disparar la carga.
  const cargarRef = useRef(cargar);
  useEffect(() => { cargarRef.current = cargar; });
  const clave = JSON.stringify([...deps, version]);
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      cargarRef.current().then((d) => { if (vivo) setDatos(d); });
      return () => { vivo = false; };
      // Dependencias a propósito: vuelve a cargar si cambian los parámetros o se pide recargar().
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clave, vuelta]),
  );
  return { datos, recargar: () => setVuelta((v) => v + 1) };
}

export function Pantalla({ children, scroll = true, abajo }: { children: ReactNode; scroll?: boolean; abajo?: ReactNode }) {
  return (
    <SafeAreaView edges={['bottom']} style={s.pantalla}>
      {/* Con Android de pantalla completa, la ventana ya no se encoge con el teclado: se hace aquí. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      {scroll ? (
        <ScrollView contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[s.contenido, { flex: 1 }]}>{children}</View>
      )}
      {abajo ? <View style={s.abajo}>{abajo}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Cargando() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fondo }}>
      <ActivityIndicator color={C.acento} />
    </View>
  );
}

export function Tarjeta({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.tarjeta, style]}>{children}</View>;
}

export function T({ children, v = 'cuerpo', style, numberOfLines }: {
  children: ReactNode; v?: keyof typeof textos; style?: StyleProp<TextStyle>; numberOfLines?: number;
}) {
  return <Text style={[textos[v], style]} numberOfLines={numberOfLines}>{children}</Text>;
}

export function Pill({ texto, fondo, color }: { texto: string; fondo: string; color: string }) {
  return (
    <View style={[s.pill, { backgroundColor: fondo }]}>
      <Text style={[s.pillTexto, { color }]}>{texto}</Text>
    </View>
  );
}

type Variante = 'primario' | 'secundario' | 'whatsapp' | 'fantasma' | 'peligro';

export function Boton({ texto, onPress, v = 'primario', icono, deshabilitado, style }: {
  texto: string; onPress: () => void; v?: Variante; icono?: Icono; deshabilitado?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const colores: Record<Variante, { fondo: string; texto: string; borde: string }> = {
    primario: { fondo: C.acento, texto: C.blanco, borde: C.acento },
    secundario: { fondo: C.tarjeta, texto: C.acento, borde: C.acento },
    whatsapp: { fondo: C.whatsapp, texto: C.blanco, borde: C.whatsapp },
    fantasma: { fondo: 'transparent', texto: C.tenue, borde: 'transparent' },
    peligro: { fondo: 'transparent', texto: C.error, borde: 'transparent' },
  };
  const k = colores[v];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={deshabilitado}
      style={({ pressed }) => [
        s.boton,
        { backgroundColor: k.fondo, borderColor: k.borde, opacity: deshabilitado ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {icono ? <Feather name={icono} size={18} color={k.texto} /> : null}
      <Text style={[s.botonTexto, { color: k.texto }]}>{texto}</Text>
    </Pressable>
  );
}

/** Opción seleccionable (chips de método de pago, lugar, día, dolor...). */
export function Opcion({ texto, activo, onPress, style }: { texto: string; activo: boolean; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      onPress={onPress}
      style={[s.opcion, activo ? s.opcionActiva : null, style]}>
      <Text style={[s.opcionTexto, activo ? { color: C.blanco } : null]}>{texto}</Text>
    </Pressable>
  );
}

/** Interruptor de fila completa: "Pidió factura", "Descontar del paquete". */
export function FilaInterruptor({ titulo, detalle, activo, onPress }: { titulo: string; detalle?: string; activo: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: activo }}
      onPress={onPress}
      style={[s.filaInt, activo ? { borderColor: C.acento, borderWidth: 2, backgroundColor: C.acentoSuave } : null]}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="fuerte">{titulo}</T>
        {detalle ? <T v="chico">{detalle}</T> : null}
      </View>
      <View style={[s.check, activo ? { backgroundColor: C.acento, borderColor: C.acento } : null]}>
        {activo ? <Feather name="check" size={16} color={C.blanco} /> : null}
      </View>
    </Pressable>
  );
}

export function Campo({ etiqueta, multilinea, ayuda, error, ...props }: TextInputProps & {
  etiqueta: string; multilinea?: boolean; ayuda?: string; error?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.etiqueta}>{etiqueta}</Text>
      <TextInput
        accessibilityLabel={etiqueta}
        placeholderTextColor={C.apagado}
        multiline={multilinea}
        style={[s.input, multilinea ? s.inputLargo : null, error ? { borderColor: C.error } : null]}
        {...props}
      />
      {error ? <Text style={[s.ayuda, { color: C.error }]}>{error}</Text> : ayuda ? <Text style={s.ayuda}>{ayuda}</Text> : null}
    </View>
  );
}

export function Titulo({ children, derecha }: { children: ReactNode; derecha?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: E.s }}>
      <T v="seccion">{children}</T>
      {derecha}
    </View>
  );
}

export function Aviso({ texto, tipo = 'aviso' }: { texto: string; tipo?: 'aviso' | 'ok' | 'error' }) {
  const k = tipo === 'ok' ? [C.acentoSuave, C.acentoOscuro] : tipo === 'error' ? [C.errorSuave, C.error] : [C.avisoSuave, C.aviso];
  return (
    <View style={{ backgroundColor: k[0], borderRadius: R.s, paddingVertical: 8, paddingHorizontal: 10 }}>
      <Text style={{ color: k[1], fontSize: 13, lineHeight: 18 }}>{texto}</Text>
    </View>
  );
}

export function Vacio({ texto, accion }: { texto: string; accion?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: E.m, paddingVertical: 32 }}>
      <T v="tenue" style={{ textAlign: 'center' }}>{texto}</T>
      {accion}
    </View>
  );
}

export function Barra({ fraccion, color = C.acento, alto = 10 }: { fraccion: number; color?: string; alto?: number }) {
  return (
    <View style={{ height: alto, borderRadius: alto / 2, backgroundColor: C.barra, overflow: 'hidden' }}>
      <View style={{ height: '100%', width: `${Math.max(0, Math.min(1, fraccion)) * 100}%`, backgroundColor: color, borderRadius: alto / 2 }} />
    </View>
  );
}

const textos = StyleSheet.create({
  cuerpo: { fontSize: 15, color: C.tinta, lineHeight: 21 },
  fuerte: { fontSize: 15, color: C.tinta, fontWeight: '600' },
  grande: { fontSize: 16, color: C.tinta, fontWeight: '600' },
  titulo: { fontSize: 24, color: C.tinta, fontWeight: '700', letterSpacing: -0.4 },
  seccion: { fontSize: 15, color: C.tinta, fontWeight: '600' },
  chico: { fontSize: 13, color: C.tenue, lineHeight: 18 },
  tenue: { fontSize: 14, color: C.tenue, lineHeight: 20 },
  numero: { fontSize: 22, color: C.tinta, fontWeight: '700' },
});

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  contenido: { padding: E.xl, paddingTop: E.l, gap: E.m, paddingBottom: 40 },
  abajo: { paddingHorizontal: E.xl, paddingTop: E.s, paddingBottom: E.m, backgroundColor: C.fondo, gap: E.s },
  tarjeta: { backgroundColor: C.tarjeta, borderColor: C.linea, borderWidth: 1, borderRadius: R.l, padding: E.l, gap: E.s },
  pill: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, alignSelf: 'flex-start' },
  pillTexto: { fontSize: 12, fontWeight: '600' },
  boton: { minHeight: 52, borderRadius: R.m, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: E.l },
  botonTexto: { fontSize: 16, fontWeight: '600' },
  opcion: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: C.linea, backgroundColor: C.tarjeta, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  opcionActiva: { backgroundColor: C.acento, borderColor: C.acento },
  opcionTexto: { fontSize: 14, fontWeight: '600', color: C.tinta },
  filaInt: { minHeight: 64, borderRadius: R.l, borderWidth: 1, borderColor: C.linea, backgroundColor: C.tarjeta, padding: E.m, paddingHorizontal: E.l, flexDirection: 'row', alignItems: 'center', gap: E.m },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: C.apagado, alignItems: 'center', justifyContent: 'center' },
  etiqueta: { fontSize: 13, fontWeight: '600', color: C.tenue },
  input: { minHeight: 48, borderWidth: 1, borderColor: C.linea, borderRadius: R.s, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: C.tinta, backgroundColor: C.campo },
  inputLargo: { minHeight: 88, textAlignVertical: 'top' },
  ayuda: { fontSize: 12, color: C.tenue },
});
