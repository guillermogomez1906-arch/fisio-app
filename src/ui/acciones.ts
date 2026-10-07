// Acciones que salen de la app: WhatsApp, mapas y compartir archivos.

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Linking, Platform } from 'react-native';

import { urlMapa, urlWhatsapp } from '@/domain/logic';

/** Abre WhatsApp con el mensaje escrito. Devuelve false si no se pudo (sin teléfono válido). */
export async function abrirWhatsapp(telefono: string, mensaje: string): Promise<boolean> {
  const url = urlWhatsapp(telefono, mensaje);
  if (!url) {
    avisar('Falta el teléfono', 'Agrega un teléfono de 10 dígitos en la ficha del paciente para mandarle mensajes.');
    return false;
  }
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    avisar('No se pudo abrir WhatsApp', 'Revisa que WhatsApp esté instalado en este teléfono.');
    return false;
  }
}

export function abrirMapa(direccion: string): void {
  Linking.openURL(urlMapa(direccion)).catch(() => avisar('No se pudo abrir el mapa', direccion));
}

/** Comparte un CSV (WhatsApp, correo, Drive...). En web lo descarga. */
export async function compartirCsv(nombre: string, contenido: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const archivo = new File(Paths.cache, nombre);
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(contenido);
  if (!(await Sharing.isAvailableAsync())) {
    avisar('No se puede compartir', 'Este teléfono no permite compartir archivos desde la app.');
    return;
  }
  await Sharing.shareAsync(archivo.uri, { mimeType: 'text/csv', dialogTitle: 'Enviar a mi contador', UTI: 'public.comma-separated-values-text' });
}

export function avisar(titulo: string, mensaje?: string): void {
  if (Platform.OS === 'web') {
    window.alert(mensaje ? `${titulo}\n\n${mensaje}` : titulo);
  } else {
    Alert.alert(titulo, mensaje);
  }
}

/** Pide confirmación antes de algo que no se puede deshacer fácilmente. */
export function confirmar(titulo: string, mensaje: string, accion: string, alAceptar: () => void): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${titulo}\n\n${mensaje}`)) alAceptar();
    return;
  }
  Alert.alert(titulo, mensaje, [
    { text: 'Cancelar', style: 'cancel' },
    { text: accion, style: 'destructive', onPress: alAceptar },
  ]);
}
