// Cliente de Supabase y el "Remoto" que usa el motor de respaldo.
// Si faltan las variables EXPO_PUBLIC_SUPABASE_*, la app funciona solo local, sin cuenta.

import 'expo-sqlite/localStorage/install';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Fila, Remoto } from './motor';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const llave = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const nubeConfigurada = !!(url && llave);

export const supabase: SupabaseClient | null = nubeConfigurada
  ? createClient(url!, llave!, {
      auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// En el teléfono, la sesión se renueva solo mientras la app está abierta.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export function remotoSupabase(cliente: SupabaseClient, fisioId: string): Remoto {
  const revisar = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };
  return {
    async subir(tabla, filas) {
      const conDueno = filas.map((f): Fila => ({ ...f, fisio_id: fisioId }));
      const { error } = await cliente.from(tabla).upsert(conDueno, { onConflict: tabla === 'ajuste' ? 'fisio_id,clave' : 'id' });
      revisar(error);
    },
    async borrar(tabla, ids) {
      const { error } = await cliente.from(tabla).update({ borrado: new Date().toISOString() }).in('id', ids);
      revisar(error);
    },
    async bajar(tabla, desde, desplazamiento, limite) {
      let q = cliente.from(tabla).select('*').order('actualizado', { ascending: true });
      q = tabla === 'ajuste' ? q.order('clave') : q.order('id');
      if (desde) q = q.gte('actualizado', desde);
      const { data, error } = await q.range(desplazamiento, desplazamiento + limite - 1);
      revisar(error);
      return (data ?? []) as Fila[];
    },
  };
}
