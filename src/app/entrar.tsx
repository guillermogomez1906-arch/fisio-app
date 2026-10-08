import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { entrarConCodigo, entrarConGoogle, pedirCodigo } from '@/sync/entrar';
import { Aviso, Boton, Campo, T, Tarjeta } from '@/ui/kit';
import { C, E } from '@/ui/theme';

const correoValido = (c: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.trim());

/** Traduce los errores de Supabase que puede ver el fisio. */
function explicar(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/expired|invalid/i.test(m) && /token|otp|code/i.test(m)) return 'El código no es válido o ya venció. Pide uno nuevo.';
  if (/rate limit|too many|seconds/i.test(m)) return 'Espera un minuto antes de pedir otro código.';
  if (/provider is not enabled|unsupported provider/i.test(m)) return 'La entrada con Google todavía no está activada. Usa tu correo.';
  if (/network|fetch/i.test(m)) return 'Sin conexión. Para entrar la primera vez necesitas internet.';
  return m;
}

export default function Entrar() {
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const correr = async (fn: () => Promise<unknown>) => {
    setOcupado(true);
    setError(null);
    try { await fn(); } catch (e) { setError(explicar(e)); } finally { setOcupado(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.fondo }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: E.l }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: E.s, marginBottom: E.l }}>
            <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: C.acento, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="activity" size={32} color={C.blanco} />
            </View>
            <T v="titulo">Fisio</T>
            <T v="tenue" style={{ textAlign: 'center' }}>Tu agenda, tus pacientes y tus cobros, respaldados en tu cuenta.</T>
          </View>

          {error ? <Aviso tipo="error" texto={error} /> : null}

          <Boton icono="log-in" texto="Entrar con Google" deshabilitado={ocupado} onPress={() => correr(entrarConGoogle)} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: E.m }}>
            <View style={{ flex: 1, height: 1, backgroundColor: C.linea }} />
            <T v="chico">o con tu correo</T>
            <View style={{ flex: 1, height: 1, backgroundColor: C.linea }} />
          </View>

          <Tarjeta style={{ gap: E.m }}>
            {!codigoEnviado ? (
              <>
                <Campo etiqueta="Correo" value={correo} onChangeText={setCorreo} placeholder="tu@correo.com"
                  keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
                <Boton v="secundario" texto="Mandarme un código" deshabilitado={ocupado || !correoValido(correo)}
                  onPress={() => correr(async () => { await pedirCodigo(correo.trim()); setCodigoEnviado(true); })} />
              </>
            ) : (
              <>
                <T v="tenue">Te mandamos un código a {correo.trim()}. Revisa también la carpeta de spam.</T>
                <Campo etiqueta="Código" value={codigo} onChangeText={(t) => setCodigo(t.replace(/\D/g, ''))} placeholder="123456"
                  keyboardType="number-pad" maxLength={10} autoComplete="one-time-code" textContentType="oneTimeCode" autoFocus />
                <Boton texto="Entrar" deshabilitado={ocupado || codigo.length < 6}
                  onPress={() => correr(() => entrarConCodigo(correo.trim(), codigo))} />
                <Boton v="fantasma" texto="Usar otro correo" onPress={() => { setCodigoEnviado(false); setCodigo(''); setError(null); }} style={{ minHeight: 40 }} />
              </>
            )}
          </Tarjeta>

          <T v="chico" style={{ textAlign: 'center' }}>
            Tus datos se guardan en este teléfono y se respaldan en tu cuenta. Si cambias de teléfono, al entrar vuelven todos.
          </T>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
