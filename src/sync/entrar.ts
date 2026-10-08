// Formas de entrar: Google (navegador del sistema) o un código que llega por correo.

import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from './nube';

WebBrowser.maybeCompleteAuthSession(); // en web cierra la ventana emergente al volver

/** A dónde regresa Google: exp://…/--/auth en Expo Go, fisioapp://auth en la app instalada. */
export const urlRegreso = () => Linking.createURL('auth');

function leerParametros(url: string): Record<string, string> {
  const salida: Record<string, string> = {};
  const partes = [url.split('#')[1] ?? '', (url.split('?')[1] ?? '').split('#')[0]];
  for (const parte of partes) {
    for (const par of parte.split('&')) {
      if (!par) continue;
      const [k, v = ''] = par.split('=');
      salida[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    }
  }
  return salida;
}

/** Abre la sesión con los tokens que regresan en la URL. Devuelve false si la URL no traía sesión. */
export async function sesionDesdeUrl(url: string): Promise<boolean> {
  if (!supabase) return false;
  const p = leerParametros(url);
  if (p.error_description || p.error) throw new Error(p.error_description || p.error);
  if (!p.access_token || !p.refresh_token) return false;
  const { error } = await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token });
  if (error) throw new Error(error.message);
  return true;
}

export async function entrarConGoogle(): Promise<boolean> {
  if (!supabase) return false;
  const redirectTo = urlRegreso();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw new Error(error.message);
  const r = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (r.type !== 'success') return false; // canceló
  return sesionDesdeUrl(r.url);
}

export async function pedirCodigo(correo: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOtp({ email: correo, options: { shouldCreateUser: true } });
  if (error) throw new Error(error.message);
}

export async function entrarConCodigo(correo: string, codigo: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.verifyOtp({ email: correo, token: codigo, type: 'email' });
  if (error) throw new Error(error.message);
}
