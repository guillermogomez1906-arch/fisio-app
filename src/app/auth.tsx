// Aquí cae la app cuando Google regresa (fisioapp://auth#access_token=…).
// Normalmente la sesión ya la abrió entrarConGoogle(); si no, se abre con la URL.

import * as Linking from 'expo-linking';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { sesionDesdeUrl } from '@/sync/entrar';
import { Cargando } from '@/ui/kit';

export default function Auth() {
  const url = Linking.useLinkingURL();
  const [hecho, setHecho] = useState(false);
  const listo = !url || hecho;

  useEffect(() => {
    if (!url) return;
    sesionDesdeUrl(url).catch(() => {}).finally(() => setHecho(true));
  }, [url]);

  return listo ? <Redirect href="/" /> : <Cargando />;
}
