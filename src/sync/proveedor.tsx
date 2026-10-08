// Cuenta y respaldo para toda la app: quién entró, y cuándo se respaldó por última vez.
// El respaldo corre al entrar, al abrir la app, al mandarla al fondo, cada minuto mientras está abierta,
// y cuando el fisio toca "Respaldar ahora".

import type { Session } from '@supabase/supabase-js';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { borrarDatosLocales, contarPendientes, CuentaDistintaError, leerMeta, sincronizar as sincronizarMotor } from './motor';
import { nubeConfigurada, remotoSupabase, supabase } from './nube';

const CADA_MS = 60_000;

export interface Respaldo {
  /** true si la app tiene nube configurada; si no, todo es local y no hay cuenta. */
  conNube: boolean;
  sesion: Session | null;
  cargandoSesion: boolean;
  sincronizando: boolean;
  /** Primera bajada de la cuenta en este teléfono (restaurando). */
  restaurando: boolean;
  ultimo: string | null;
  pendientes: number;
  error: string | null;
  /** Sube cada vez que llegan datos de la nube; las pantallas lo usan para recargarse. */
  version: number;
  sincronizar: () => Promise<void>;
  /** Cierra sesión y borra los datos del teléfono. */
  salir: () => Promise<void>;
}

const Ctx = createContext<Respaldo | null>(null);

export function useRespaldo(): Respaldo {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRespaldo fuera de ProveedorRespaldo');
  return v;
}

function mensajeError(e: unknown): string {
  if (e instanceof CuentaDistintaError) return e.message;
  const m = e instanceof Error ? e.message : String(e);
  if (/network|fetch|failed to fetch|timeout/i.test(m)) return 'Sin conexión. Se respalda solo cuando vuelva el internet.';
  return m;
}

export function ProveedorRespaldo({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [sesion, setSesion] = useState<Session | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(nubeConfigurada);
  const [sincronizando, setSincronizando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [pendientes, setPendientes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const corriendo = useRef(false);

  // Sesión guardada y cambios de sesión
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargandoSesion(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSesion(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const refrescarEstado = useCallback(async () => {
    const [meta, n] = await Promise.all([leerMeta(db), contarPendientes(db)]);
    setUltimo(meta.ultimo);
    setPendientes(n);
  }, [db]);

  const fisioId = sesion?.user.id ?? null;

  const sincronizar = useCallback(async () => {
    await refrescarEstado();
    if (!supabase || !fisioId || corriendo.current) return;
    corriendo.current = true;
    setSincronizando(true);
    try {
      const meta = await leerMeta(db);
      if (Object.keys(meta.cursores).length === 0) setRestaurando(true);
      const r = await sincronizarMotor(db, remotoSupabase(supabase, fisioId), fisioId);
      if (r.bajadas || r.borradas) setVersion((v) => v + 1);
      setError(null);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      corriendo.current = false;
      setSincronizando(false);
      setRestaurando(false);
      await refrescarEstado();
    }
  }, [db, fisioId, refrescarEstado]);

  // Al entrar, al volver a la app, al irse al fondo, y cada minuto.
  useEffect(() => {
    if (!fisioId) return;
    const inicio = setTimeout(sincronizar, 0); // primera vuelta al entrar, fuera del render
    const reloj = setInterval(() => { if (AppState.currentState === 'active') sincronizar(); }, CADA_MS);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active' || s === 'background') sincronizar(); });
    return () => { clearTimeout(inicio); clearInterval(reloj); sub.remove(); };
  }, [fisioId, sincronizar]);

  const salir = useCallback(async () => {
    if (!supabase) return;
    // Espera a que termine un respaldo en curso y bloquea los siguientes; si no, uno podría
    // volver a bajar los datos justo después de borrarlos.
    for (let i = 0; i < 100 && corriendo.current; i++) await new Promise((r) => setTimeout(r, 100));
    corriendo.current = true;
    try {
      await supabase.auth.signOut({ scope: 'local' }); // no necesita internet
      await borrarDatosLocales(db);
    } finally {
      corriendo.current = false;
    }
    setVersion((v) => v + 1);
    await refrescarEstado();
  }, [db, refrescarEstado]);

  const valor = useMemo<Respaldo>(() => ({
    conNube: nubeConfigurada, sesion, cargandoSesion, sincronizando, restaurando, ultimo, pendientes, error, version, sincronizar, salir,
  }), [sesion, cargandoSesion, sincronizando, restaurando, ultimo, pendientes, error, version, sincronizar, salir]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
