// Reglas de negocio puras: fechas, mensajes, paquetes, resumen para el contador.
// Todo aquí se prueba en Node (logic.test.ts); no importar nada de React Native.

import type { Cita, Cobro, EstadoCita, Lugar, MetodoPago, Paciente, Paquete } from './types';

// ---------- Fechas ----------

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const dos = (n: number) => String(n).padStart(2, '0');

/** Fecha local (no UTC) en formato YYYY-MM-DD. */
export function isoLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Interpreta YYYY-MM-DD como fecha local a mediodía, para que no se corra de día por zona horaria. */
export function desdeIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function sumarDias(iso: string, dias: number): string {
  const d = desdeIso(iso);
  d.setDate(d.getDate() + dias);
  return isoLocal(d);
}

/** "miércoles 7 de octubre" */
export function fechaLarga(iso: string): string {
  const d = desdeIso(iso);
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** "7 oct" */
export function fechaCorta(iso: string): string {
  const d = desdeIso(iso);
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
}

/** "octubre 2026" para un mes YYYY-MM */
export function mesLargo(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
}

/** Acepta dd/mm/aaaa (o con guiones) y devuelve YYYY-MM-DD, o null si no es una fecha válida. */
export function parseFechaMx(texto: string): string | null {
  const m = texto.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!m) return null;
  const [d, mes, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(y, mes - 1, d, 12);
  if (f.getFullYear() !== y || f.getMonth() !== mes - 1 || f.getDate() !== d) return null;
  return `${y}-${dos(mes)}-${dos(d)}`;
}

/** YYYY-MM-DD → dd/mm/aaaa */
export function formatoFechaMx(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function edad(nacimientoIso: string, hoyIso: string = isoLocal()): number | null {
  if (!nacimientoIso) return null;
  const n = desdeIso(nacimientoIso);
  const h = desdeIso(hoyIso);
  let e = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) e--;
  return e;
}

export function horaValida(hora: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
}

const minutos = (hora: string) => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};

// ---------- Agenda ----------

export function ordenarCitas<T extends Pick<Cita, 'fecha' | 'hora'>>(citas: T[]): T[] {
  return [...citas].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
}

export const MARGEN_TRASLADO_MIN = 30;

/**
 * Ids de citas a domicilio que empiezan con menos de MARGEN_TRASLADO_MIN minutos
 * después de que termina la cita anterior del mismo día.
 */
export function citasSinMargen(citas: Cita[]): Set<number> {
  const activas = ordenarCitas(citas.filter((c) => c.estado !== 'cancelada'));
  const avisos = new Set<number>();
  for (let i = 1; i < activas.length; i++) {
    const prev = activas[i - 1];
    const cur = activas[i];
    if (cur.fecha !== prev.fecha || cur.lugar !== 'domicilio') continue;
    const libre = minutos(cur.hora) - (minutos(prev.hora) + prev.duracion_min);
    const mismaDireccion = prev.lugar === 'domicilio' && prev.direccion.trim() === cur.direccion.trim();
    if (libre < MARGEN_TRASLADO_MIN && !mismaDireccion) avisos.add(cur.id);
  }
  return avisos;
}

export const ETIQUETA_ESTADO: Record<EstadoCita, string> = {
  agendada: 'Sin confirmar',
  confirmada: 'Confirmada',
  atendida: 'Atendida',
  cancelada: 'Cancelada',
  no_llego: 'No llegó',
};

export const ETIQUETA_LUGAR: Record<Lugar, string> = {
  consultorio: 'Consultorio',
  domicilio: 'Domicilio',
};

export const ETIQUETA_METODO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  paquete: 'Paquete',
};

// ---------- WhatsApp ----------

const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] || nombre;

function cuandoYDonde(cita: Pick<Cita, 'hora' | 'lugar' | 'direccion'>): string {
  const donde = cita.lugar === 'domicilio'
    ? `en tu domicilio${cita.direccion ? ` (${cita.direccion})` : ''}`
    : 'en el consultorio';
  return `a las ${cita.hora} ${donde}`;
}

/** Mensaje para confirmar una cita. hoyIso decide si se dice "hoy", "mañana" o la fecha. */
export function mensajeConfirmacion(
  paciente: Pick<Paciente, 'nombre'>,
  cita: Pick<Cita, 'fecha' | 'hora' | 'lugar' | 'direccion'>,
  hoyIso: string = isoLocal(),
): string {
  let dia: string;
  if (cita.fecha === hoyIso) dia = `hoy ${fechaLarga(cita.fecha).split(' ')[0]}`;
  else if (cita.fecha === sumarDias(hoyIso, 1)) dia = `mañana ${fechaLarga(cita.fecha).split(' ')[0]}`;
  else dia = `el ${fechaLarga(cita.fecha)}`;
  return `Hola ${primerNombre(paciente.nombre)}, te confirmo tu sesión de ${dia} ${cuandoYDonde(cita)}. ¿Me confirmas, por favor?`;
}

/** Mensaje de recordatorio para el día siguiente. */
export function mensajeRecordatorio(
  paciente: Pick<Paciente, 'nombre'>,
  cita: Pick<Cita, 'fecha' | 'hora' | 'lugar' | 'direccion'>,
): string {
  return `Hola ${primerNombre(paciente.nombre)}, te recuerdo tu sesión de mañana ${cuandoYDonde(cita)}. Si necesitas cambiarla, avísame por aquí.`;
}

/**
 * Normaliza un teléfono mexicano para wa.me: 10 dígitos → 52 + número.
 * Devuelve null si no hay suficientes dígitos.
 */
export function telefonoWhatsapp(telefono: string): string | null {
  let d = telefono.replace(/\D/g, '');
  if (d.startsWith('521') && d.length === 13) d = '52' + d.slice(3); // formato viejo con 1 de celular
  if (d.length === 10) return '52' + d;
  if (d.length === 12 && d.startsWith('52')) return d;
  if (d.length >= 11) return d; // otro país, ya con lada
  return null;
}

export function urlWhatsapp(telefono: string, texto: string): string | null {
  const tel = telefonoWhatsapp(telefono);
  if (!tel) return null;
  return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
}

export function urlMapa(direccion: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}

// ---------- Paquetes ----------

export function restantes(p: Pick<Paquete, 'sesiones' | 'usadas'>): number {
  return Math.max(0, p.sesiones - p.usadas);
}

/** El paquete vigente de un paciente: el más antiguo que aún tiene sesiones. */
export function paqueteVigente<T extends Pick<Paquete, 'id' | 'sesiones' | 'usadas' | 'fecha'>>(paquetes: T[]): T | null {
  const vivos = paquetes.filter((p) => restantes(p) > 0).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
  return vivos[0] ?? null;
}

// ---------- Historia clínica ----------

export function historiaIncompleta(p: Pick<Paciente, 'nacimiento' | 'dx_fisio' | 'telefono'>): boolean {
  return !p.nacimiento || !p.dx_fisio.trim() || !p.telefono.trim();
}

// ---------- Dinero y resumen ----------

export function dinero(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-MX');
}

export interface ResumenMes {
  total: number;
  porMetodo: Record<Exclude<MetodoPago, 'paquete'>, number>;
  porLugar: Record<Lugar, number>;
  movimientos: number;
  sesionesPaquete: number;
  facturas: number;
  montoFacturar: number;
}

/** Resumen de los cobros de un mes (YYYY-MM). Las sesiones de paquete cuentan como movimiento sin dinero. */
export function resumenMes(cobros: Cobro[], mes: string): ResumenMes {
  const r: ResumenMes = {
    total: 0,
    porMetodo: { efectivo: 0, transferencia: 0, tarjeta: 0 },
    porLugar: { consultorio: 0, domicilio: 0 },
    movimientos: 0,
    sesionesPaquete: 0,
    facturas: 0,
    montoFacturar: 0,
  };
  for (const c of cobros) {
    if (!c.fecha.startsWith(mes)) continue;
    r.movimientos++;
    if (c.metodo === 'paquete') {
      r.sesionesPaquete++;
      continue;
    }
    r.total += c.monto;
    r.porMetodo[c.metodo] += c.monto;
    r.porLugar[c.lugar] += c.monto;
    if (c.factura) {
      r.facturas++;
      r.montoFacturar += c.monto;
    }
  }
  return r;
}

const csvCampo = (v: string | number) => {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * CSV del mes para el contador. Lo abre Excel en español sin problema:
 * empieza con BOM para que respete acentos.
 */
export function csvContador(
  cobros: Cobro[],
  pacientes: Pick<Paciente, 'id' | 'nombre' | 'rfc'>[],
  mes: string,
): string {
  const porId = new Map(pacientes.map((p) => [p.id, p]));
  const filas = cobros
    .filter((c) => c.fecha.startsWith(mes))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id)
    .map((c) => {
      const p = porId.get(c.paciente_id);
      return [
        formatoFechaMx(c.fecha),
        p?.nombre ?? '',
        c.concepto,
        ETIQUETA_LUGAR[c.lugar],
        ETIQUETA_METODO[c.metodo],
        c.monto.toFixed(2),
        c.factura ? 'Sí' : 'No',
        c.factura ? (p?.rfc ?? '') : '',
      ].map(csvCampo).join(',');
    });
  const encabezado = ['Fecha', 'Paciente', 'Concepto', 'Lugar', 'Forma de pago', 'Monto', 'Pidió factura', 'RFC'].join(',');
  return '﻿' + [encabezado, ...filas].join('\n') + '\n';
}
