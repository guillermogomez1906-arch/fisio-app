// Consultas a la base local. Las pantallas no escriben SQL: todo pasa por aquí.

import type { SQLiteDatabase } from 'expo-sqlite';

import { paqueteVigente, sumarDias } from '@/domain/logic';
import {
  AJUSTES_INICIALES, type Ajustes, type Cita, type Cobro, type EstadoCita, type Lugar,
  type MetodoPago, type Paciente, type Paquete, type Sesion,
} from '@/domain/types';

// ---------- Ajustes ----------

export async function obtenerAjustes(db: SQLiteDatabase): Promise<Ajustes> {
  const filas = await db.getAllAsync<{ clave: string; valor: string }>('SELECT clave, valor FROM ajuste');
  const a: Ajustes = { ...AJUSTES_INICIALES };
  for (const { clave, valor } of filas) {
    if (clave === 'nombre_fisio') a.nombre_fisio = valor;
    if (clave === 'tarifa_consultorio') a.tarifa_consultorio = Number(valor) || 0;
    if (clave === 'tarifa_domicilio') a.tarifa_domicilio = Number(valor) || 0;
    if (clave === 'duracion_min') a.duracion_min = Number(valor) || 60;
  }
  return a;
}

export async function guardarAjustes(db: SQLiteDatabase, cambios: Partial<Ajustes>): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const [clave, valor] of Object.entries(cambios)) {
      await db.runAsync(
        'INSERT INTO ajuste (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor',
        clave, String(valor),
      );
    }
  });
}

// ---------- Pacientes ----------

export interface PacienteListado {
  id: number;
  nombre: string;
  telefono: string;
  motivo: string;
  ultima_sesion: string | null;
  restantes_paquete: number | null;
}

export async function listarPacientes(db: SQLiteDatabase, busqueda = ''): Promise<PacienteListado[]> {
  const q = busqueda.trim();
  const digitos = q.replace(/\D/g, '');
  return db.getAllAsync<PacienteListado>(
    `SELECT p.id, p.nombre, p.telefono, p.motivo,
            (SELECT MAX(s.fecha) FROM sesion s WHERE s.paciente_id = p.id) AS ultima_sesion,
            (SELECT SUM(k.sesiones - k.usadas) FROM paquete k WHERE k.paciente_id = p.id AND k.usadas < k.sesiones) AS restantes_paquete
       FROM paciente p
      WHERE ? = '' OR p.nombre LIKE '%' || ? || '%'
            OR (? <> '' AND REPLACE(REPLACE(REPLACE(p.telefono, ' ', ''), '-', ''), '+', '') LIKE '%' || ? || '%')
      ORDER BY p.nombre COLLATE NOCASE`,
    q, q, digitos, digitos,
  );
}

export function obtenerPaciente(db: SQLiteDatabase, id: number): Promise<Paciente | null> {
  return db.getFirstAsync<Paciente>('SELECT * FROM paciente WHERE id = ?', id);
}

/** Columnas que se pueden editar desde la app. Lista cerrada: nunca se arma SQL con nombres libres. */
export const CAMPOS_PACIENTE = [
  'nombre', 'telefono', 'lugar', 'direccion', 'nacimiento', 'sexo', 'ocupacion', 'correo', 'emergencia',
  'patologicos', 'quirurgicos', 'medicamentos', 'alergias', 'actividad',
  'motivo', 'inicio', 'dx_fisio', 'dx_medico', 'refiere', 'objetivos', 'rfc', 'regimen',
] as const;
export type CampoPaciente = (typeof CAMPOS_PACIENTE)[number];

export async function crearPaciente(db: SQLiteDatabase, datos: Partial<Record<CampoPaciente, string>> & { nombre: string }): Promise<number> {
  const campos = CAMPOS_PACIENTE.filter((c) => datos[c] !== undefined);
  const r = await db.runAsync(
    `INSERT INTO paciente (${campos.join(', ')}) VALUES (${campos.map(() => '?').join(', ')})`,
    campos.map((c) => datos[c] as string),
  );
  return r.lastInsertRowId;
}

export async function actualizarPaciente(db: SQLiteDatabase, id: number, cambios: Partial<Record<CampoPaciente, string>>): Promise<void> {
  const campos = CAMPOS_PACIENTE.filter((c) => cambios[c] !== undefined);
  if (!campos.length) return;
  await db.runAsync(
    `UPDATE paciente SET ${campos.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
    [...campos.map((c) => cambios[c] as string), id],
  );
}

// ---------- Citas ----------

export type CitaDetalle = Cita & {
  paciente_nombre: string;
  paciente_telefono: string;
  paciente_motivo: string;
  pagado: number;
  con_sesion: number;
};

const SELECT_CITA = `
  SELECT c.*, p.nombre AS paciente_nombre, p.telefono AS paciente_telefono, p.motivo AS paciente_motivo,
         EXISTS (SELECT 1 FROM cobro k WHERE k.cita_id = c.id) AS pagado,
         EXISTS (SELECT 1 FROM sesion s WHERE s.cita_id = c.id) AS con_sesion
    FROM cita c JOIN paciente p ON p.id = c.paciente_id`;

export function citasDelDia(db: SQLiteDatabase, fecha: string): Promise<CitaDetalle[]> {
  return db.getAllAsync<CitaDetalle>(`${SELECT_CITA} WHERE c.fecha = ? ORDER BY c.hora`, fecha);
}

export function citasDePaciente(db: SQLiteDatabase, pacienteId: number): Promise<CitaDetalle[]> {
  return db.getAllAsync<CitaDetalle>(`${SELECT_CITA} WHERE c.paciente_id = ? ORDER BY c.fecha DESC, c.hora DESC`, pacienteId);
}

export function obtenerCita(db: SQLiteDatabase, id: number): Promise<CitaDetalle | null> {
  return db.getFirstAsync<CitaDetalle>(`${SELECT_CITA} WHERE c.id = ?`, id);
}

export async function crearCita(
  db: SQLiteDatabase,
  c: { paciente_id: number; fecha: string; hora: string; duracion_min: number; lugar: Lugar; direccion: string },
): Promise<number> {
  const r = await db.runAsync(
    'INSERT INTO cita (paciente_id, fecha, hora, duracion_min, lugar, direccion) VALUES (?, ?, ?, ?, ?, ?)',
    c.paciente_id, c.fecha, c.hora, c.duracion_min, c.lugar, c.direccion,
  );
  return r.lastInsertRowId;
}

export async function cambiarEstadoCita(db: SQLiteDatabase, id: number, estado: EstadoCita): Promise<void> {
  await db.runAsync('UPDATE cita SET estado = ? WHERE id = ?', estado, id);
}

export async function marcarRecordatorio(db: SQLiteDatabase, ids: number[]): Promise<void> {
  if (!ids.length) return;
  await db.runAsync(`UPDATE cita SET recordatorio_enviado = 1 WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
}

// ---------- Sesiones ----------

export function sesionesDePaciente(db: SQLiteDatabase, pacienteId: number): Promise<Sesion[]> {
  return db.getAllAsync<Sesion>('SELECT * FROM sesion WHERE paciente_id = ? ORDER BY fecha, id', pacienteId);
}

export function sesionDeCita(db: SQLiteDatabase, citaId: number): Promise<Sesion | null> {
  return db.getFirstAsync<Sesion>('SELECT * FROM sesion WHERE cita_id = ?', citaId);
}

/** Guarda (o reemplaza) la nota de la sesión de una cita y la marca como atendida. */
export async function guardarSesion(
  db: SQLiteDatabase,
  s: { cita_id: number; paciente_id: number; fecha: string; dolor: number; trabajo: string; notas: string },
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM sesion WHERE cita_id = ?', s.cita_id);
    await db.runAsync(
      'INSERT INTO sesion (cita_id, paciente_id, fecha, dolor, trabajo, notas) VALUES (?, ?, ?, ?, ?, ?)',
      s.cita_id, s.paciente_id, s.fecha, s.dolor, s.trabajo, s.notas,
    );
    await db.runAsync("UPDATE cita SET estado = 'atendida' WHERE id = ?", s.cita_id);
  });
}

// ---------- Paquetes y cobros ----------

export function paquetesDePaciente(db: SQLiteDatabase, pacienteId: number): Promise<Paquete[]> {
  return db.getAllAsync<Paquete>('SELECT * FROM paquete WHERE paciente_id = ? ORDER BY fecha, id', pacienteId);
}

export async function venderPaquete(
  db: SQLiteDatabase,
  p: { paciente_id: number; sesiones: number; precio: number; fecha: string; metodo: Exclude<MetodoPago, 'paquete'>; lugar: Lugar; factura: boolean },
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const r = await db.runAsync(
      'INSERT INTO paquete (paciente_id, sesiones, precio, fecha) VALUES (?, ?, ?, ?)',
      p.paciente_id, p.sesiones, p.precio, p.fecha,
    );
    await db.runAsync(
      'INSERT INTO cobro (paciente_id, paquete_id, fecha, monto, metodo, lugar, factura, concepto) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      p.paciente_id, r.lastInsertRowId, p.fecha, p.precio, p.metodo, p.lugar, p.factura ? 1 : 0, `Paquete de ${p.sesiones} sesiones`,
    );
  });
}

/**
 * Registra el cobro de una cita. Con usarPaquete descuenta una sesión del paquete vigente
 * y deja un movimiento en cero para que el contador vea la sesión.
 */
export async function cobrarCita(
  db: SQLiteDatabase,
  cita: Pick<Cita, 'id' | 'paciente_id' | 'fecha' | 'lugar'>,
  pago: { usarPaquete: boolean; monto: number; metodo: Exclude<MetodoPago, 'paquete'>; factura: boolean },
): Promise<void> {
  await db.withTransactionAsync(async () => {
    if (pago.usarPaquete) {
      const vigente = paqueteVigente(await paquetesDePaciente(db, cita.paciente_id));
      if (!vigente) throw new Error('El paciente no tiene sesiones de paquete disponibles.');
      await db.runAsync('UPDATE paquete SET usadas = usadas + 1 WHERE id = ?', vigente.id);
      await db.runAsync(
        "INSERT INTO cobro (paciente_id, cita_id, paquete_id, fecha, monto, metodo, lugar, factura, concepto) VALUES (?, ?, ?, ?, 0, 'paquete', ?, ?, ?)",
        cita.paciente_id, cita.id, vigente.id, cita.fecha, cita.lugar, pago.factura ? 1 : 0,
        `Sesión ${vigente.usadas + 1} de ${vigente.sesiones} del paquete`,
      );
    } else {
      await db.runAsync(
        'INSERT INTO cobro (paciente_id, cita_id, fecha, monto, metodo, lugar, factura, concepto) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        cita.paciente_id, cita.id, cita.fecha, pago.monto, pago.metodo, cita.lugar, pago.factura ? 1 : 0,
        `Sesión ${cita.lugar === 'domicilio' ? 'a domicilio' : 'en consultorio'}`,
      );
    }
  });
}

export function cobrosDelMes(db: SQLiteDatabase, mes: string): Promise<Cobro[]> {
  return db.getAllAsync<Cobro>("SELECT * FROM cobro WHERE fecha LIKE ? || '%' ORDER BY fecha, id", mes);
}

export function cobrosDePaciente(db: SQLiteDatabase, pacienteId: number): Promise<Cobro[]> {
  return db.getAllAsync<Cobro>('SELECT * FROM cobro WHERE paciente_id = ? ORDER BY fecha DESC, id DESC', pacienteId);
}

export async function cobradoEnFecha(db: SQLiteDatabase, fecha: string): Promise<number> {
  const r = await db.getFirstAsync<{ total: number | null }>('SELECT SUM(monto) AS total FROM cobro WHERE fecha = ?', fecha);
  return r?.total ?? 0;
}

export function pacientesParaCsv(db: SQLiteDatabase): Promise<Pick<Paciente, 'id' | 'nombre' | 'rfc'>[]> {
  return db.getAllAsync('SELECT id, nombre, rfc FROM paciente');
}

// ---------- Datos de ejemplo ----------

export async function hayPacientes(db: SQLiteDatabase): Promise<boolean> {
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM paciente');
  return (r?.n ?? 0) > 0;
}

/** Carga pacientes y citas ficticias para probar la app. Solo se ofrece con la base vacía. */
export async function cargarEjemplo(db: SQLiteDatabase, hoy: string): Promise<void> {
  const ayer = (n: number) => sumarDias(hoy, -n);
  await db.withTransactionAsync(async () => {
    const ins = async (p: Partial<Record<CampoPaciente, string>> & { nombre: string }) => {
      const campos = Object.keys(p) as CampoPaciente[];
      const r = await db.runAsync(
        `INSERT INTO paciente (${campos.join(', ')}) VALUES (${campos.map(() => '?').join(', ')})`,
        campos.map((c) => p[c] as string),
      );
      return r.lastInsertRowId;
    };
    const ana = await ins({ nombre: 'Ana López', telefono: '33 1111 2233', motivo: 'Lumbalgia', nacimiento: '1991-03-14', sexo: 'Mujer', ocupacion: 'Diseñadora, trabaja sentada', patologicos: 'Ninguna', alergias: 'Ninguna conocida', actividad: 'Camina 2 veces por semana', inicio: 'Hace 2 meses, sin causa clara', dx_fisio: 'Lumbalgia mecánica por postura sostenida', refiere: 'Viene por su cuenta', objetivos: 'Quitar el dolor al estar sentada y fortalecer zona media' });
    const roberto = await ins({ nombre: 'Roberto Díaz', telefono: '33 2222 3344', lugar: 'domicilio', direccion: 'Av. Patria 1200, Zapopan', motivo: 'Rehabilitación de rodilla tras cirugía', nacimiento: '1958-08-02', sexo: 'Hombre', ocupacion: 'Jubilado', emergencia: 'Laura Díaz (hija) · 33 2222 8811', patologicos: 'Hipertensión controlada', quirurgicos: 'Reemplazo total de rodilla derecha', medicamentos: 'Losartán', alergias: 'Penicilina', dx_fisio: 'Limitación de flexión y debilidad de cuádriceps post artroplastia', dx_medico: 'Artroplastia total de rodilla derecha', objetivos: 'Flexión a 110°, caminar sin bastón' });
    const carmen = await ins({ nombre: 'Carmen Ruiz', telefono: '33 3333 4455', motivo: 'Cervicalgia', nacimiento: '1979-11-21', sexo: 'Mujer', ocupacion: 'Contadora', patologicos: 'Migraña', dx_fisio: 'Cervicalgia tensional', objetivos: 'Bajar dolor y enseñar pausas activas' });
    const jorge = await ins({ nombre: 'Jorge Méndez', telefono: '33 4444 5566', lugar: 'domicilio', direccion: 'Calle Morelos 85, Tlaquepaque', motivo: 'Hombro doloroso', sexo: 'Hombre' });

    const cita = async (pid: number, fecha: string, hora: string, lugar: Lugar, dir: string, estado: EstadoCita) => {
      const r = await db.runAsync(
        'INSERT INTO cita (paciente_id, fecha, hora, lugar, direccion, estado) VALUES (?, ?, ?, ?, ?, ?)',
        pid, fecha, hora, lugar, dir, estado,
      );
      return r.lastInsertRowId;
    };
    await cita(ana, hoy, '09:00', 'consultorio', '', 'confirmada');
    await cita(roberto, hoy, '11:00', 'domicilio', 'Av. Patria 1200, Zapopan', 'agendada');
    await cita(jorge, hoy, '12:20', 'domicilio', 'Calle Morelos 85, Tlaquepaque', 'agendada');
    await cita(carmen, hoy, '16:00', 'consultorio', '', 'agendada');
    await cita(roberto, sumarDias(hoy, 1), '11:00', 'domicilio', 'Av. Patria 1200, Zapopan', 'agendada');
    await cita(ana, sumarDias(hoy, 1), '17:00', 'consultorio', '', 'agendada');

    // Historia previa de Ana con paquete
    const pq = await db.runAsync('INSERT INTO paquete (paciente_id, sesiones, usadas, precio, fecha) VALUES (?, 10, 4, 4500, ?)', ana, ayer(14));
    await db.runAsync("INSERT INTO cobro (paciente_id, paquete_id, fecha, monto, metodo, lugar, concepto) VALUES (?, ?, ?, 4500, 'transferencia', 'consultorio', 'Paquete de 10 sesiones')", ana, pq.lastInsertRowId, ayer(14));
    for (const [d, dolor, trabajo] of [[14, 7, 'Terapia manual, estiramientos'], [10, 6, 'Terapia manual, ejercicio terapéutico'], [7, 5, 'Ejercicio terapéutico'], [3, 4, 'Ejercicio terapéutico, estiramientos']] as const) {
      const c = await cita(ana, ayer(d), '09:00', 'consultorio', '', 'atendida');
      await db.runAsync('INSERT INTO sesion (cita_id, paciente_id, fecha, dolor, trabajo) VALUES (?, ?, ?, ?, ?)', c, ana, ayer(d), dolor, trabajo);
      await db.runAsync("INSERT INTO cobro (paciente_id, cita_id, paquete_id, fecha, monto, metodo, lugar, concepto) VALUES (?, ?, ?, ?, 0, 'paquete', 'consultorio', 'Sesión del paquete')", ana, c, pq.lastInsertRowId, ayer(d));
    }
    const cr = await cita(roberto, ayer(3), '11:00', 'domicilio', 'Av. Patria 1200, Zapopan', 'atendida');
    await db.runAsync("INSERT INTO sesion (cita_id, paciente_id, fecha, dolor, trabajo) VALUES (?, ?, ?, 6, 'Ejercicio terapéutico')", cr, roberto, ayer(3));
    await db.runAsync("INSERT INTO cobro (paciente_id, cita_id, fecha, monto, metodo, lugar, concepto) VALUES (?, ?, ?, 700, 'efectivo', 'domicilio', 'Sesión a domicilio')", roberto, cr, ayer(3));
    const cc = await cita(carmen, ayer(5), '16:00', 'consultorio', '', 'atendida');
    await db.runAsync("INSERT INTO sesion (cita_id, paciente_id, fecha, dolor, trabajo) VALUES (?, ?, ?, 5, 'Terapia manual')", cc, carmen, ayer(5));
    await db.runAsync("INSERT INTO cobro (paciente_id, cita_id, fecha, monto, metodo, lugar, factura, concepto) VALUES (?, ?, ?, 500, 'tarjeta', 'consultorio', 1, 'Sesión en consultorio')", carmen, cc, ayer(5));

    for (const [clave, valor] of [['tarifa_consultorio', '500'], ['tarifa_domicilio', '700']]) {
      await db.runAsync('INSERT INTO ajuste (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO NOTHING', clave, valor);
    }
  });
}
