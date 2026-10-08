import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { entrarConCodigo, entrarConContrasena, entrarConGoogle, googleHabilitado, pedirCodigo } from '@/sync/entrar';
import { Aviso, Boton, Campo, T, Tarjeta } from '@/ui/kit';
import { C, E } from '@/ui/theme';

const correoValido = (c: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.trim());

/** Traduce los errores de Supabase que puede ver el fisio. */
function explicar(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/expired|invalid/i.test(m) && /token|otp|code/i.test(m)) return 'El código no es válido o ya venció. Pide uno nuevo.';
  if (/rate limit|too many|seconds/i.test(m)) return 'Espera un minuto antes de pedir otro código.';
  if (/provider is not enabled|unsupported provider/i.test(m)) return 'La entrada con Google todavía no está activada. Usa tu correo.';
  if (/invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/network|fetch/i.test(m)) return 'Sin conexión. Para entrar la primera vez necesitas internet.';
  return m;
}

export default function Entrar() {
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [conContrasena, setConContrasena] = useState(false);
  const [contrasena, setContrasena] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conGoogle, setConGoogle] = useState(false);
  const scroll = useRef<ScrollView>(null);
  // El campo está abajo: al enfocarlo, sube la pantalla para que el teclado no lo tape.
  const mostrarCampo = () => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 250);

  useEffect(() => {
    let vivo = true;
    googleHabilitado().then((g) => { if (vivo) setConGoogle(g); });
    return () => { vivo = false; };
  }, []);

  const correr = async (fn: () => Promise<unknown>) => {
    setOcupado(true);
    setError(null);
    try { await fn(); } catch (e) { setError(explicar(e)); } finally { setOcupado(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.fondo }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView ref={scroll} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: E.l }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: E.s, marginBottom: E.l }}>
            <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: C.acento, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="activity" size={32} color={C.blanco} />
            </View>
            <T v="titulo">Fisio</T>
            <T v="tenue" style={{ textAlign: 'center' }}>Tu agenda, tus pacientes y tus cobros, respaldados en tu cuenta.</T>
          </View>

          {error ? <Aviso tipo="error" texto={error} /> : null}

          {conGoogle ? (
            <>
              <Boton icono="log-in" texto="Entrar con Google" deshabilitado={ocupado} onPress={() => correr(entrarConGoogle)} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: E.m }}>
                <View style={{ flex: 1, height: 1, backgroundColor: C.linea }} />
                <T v="chico">o con tu correo</T>
                <View style={{ flex: 1, height: 1, backgroundColor: C.linea }} />
              </View>
            </>
          ) : null}

          <Tarjeta style={{ gap: E.m }}>
            {conContrasena ? (
              <>
                <Campo etiqueta="Correo" value={correo} onChangeText={setCorreo} placeholder="tu@correo.com"
                  keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" onFocus={mostrarCampo} />
                <Campo etiqueta="Contraseña" value={contrasena} onChangeText={setContrasena} secureTextEntry
                  autoCapitalize="none" autoComplete="password" textContentType="password" onFocus={mostrarCampo} />
                <Boton texto="Entrar" deshabilitado={ocupado || !correoValido(correo) || !contrasena}
                  onPress={() => correr(() => entrarConContrasena(correo.trim(), contrasena))} />
                <Boton v="fantasma" texto="Entrar con código por correo" onPress={() => { setConContrasena(false); setError(null); }} style={{ minHeight: 40 }} />
              </>
            ) : !codigoEnviado ? (
              <>
                <Campo etiqueta="Correo" value={correo} onChangeText={setCorreo} placeholder="tu@correo.com"
                  keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" onFocus={mostrarCampo} />
                <Boton v="secundario" texto="Mandarme un código" deshabilitado={ocupado || !correoValido(correo)}
                  onPress={() => correr(async () => { await pedirCodigo(correo.trim()); setCodigoEnviado(true); })} />
                <Boton v="fantasma" texto="Tengo contraseña" onPress={() => { setConContrasena(true); setError(null); }} style={{ minHeight: 40 }} />
              </>
            ) : (
              <>
                <T v="tenue">Te mandamos un código a {correo.trim()}. Si no lo ves, revisa la carpeta de no deseados.</T>
                <Campo etiqueta="Código" value={codigo} onChangeText={(t) => setCodigo(t.replace(/\D/g, ''))} placeholder="123456"
                  keyboardType="number-pad" maxLength={10} autoComplete="one-time-code" textContentType="oneTimeCode" autoFocus onFocus={mostrarCampo} />
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
