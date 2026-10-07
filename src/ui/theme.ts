// Paleta y medidas. Los mismos colores del prototipo que aprobó el fisio.

export const C = {
  fondo: '#F4F5F1',
  tarjeta: '#FFFFFF',
  tinta: '#17201D',
  tenue: '#55605B',
  apagado: '#8A948F',
  linea: '#DDE1DB',
  campo: '#FAFBF9',
  acento: '#1E6B58',
  acentoOscuro: '#14493C',
  acentoSuave: '#E3EFEA',
  whatsapp: '#1D7F4E',
  whatsappSuave: '#DCF2E4',
  domicilio: '#7E3B0E',
  domicilioSuave: '#F6E7DA',
  consultorio: '#2C3E66',
  consultorioSuave: '#E8ECF4',
  aviso: '#7A4F00',
  avisoSuave: '#FBF0D9',
  error: '#8A1F1F',
  errorSuave: '#F7E1E1',
  barra: '#F0F2EE',
  blanco: '#FFFFFF',
};

export const R = { s: 10, m: 14, l: 16, xl: 18 };
export const E = { xs: 4, s: 8, m: 12, l: 16, xl: 20 };

/** Color de la barra de dolor: alto → naranja, medio → ámbar, bajo → verde. */
export function colorDolor(n: number): string {
  if (n >= 7) return '#B5541C';
  if (n >= 4) return '#C99A2E';
  return C.acento;
}
