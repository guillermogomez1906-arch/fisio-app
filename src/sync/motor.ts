// Motor de respaldo: sube los cambios del teléfono y baja los de la nube.
// No sabe nada de Supabase ni de React: recibe un `Remoto` y la base local.
// Así se prueba en Node con una nube falsa (motor.test.ts).

import type { SQLiteDatabase } from 'expo-sqlite';

import { TABLAS_SYNC, type TablaSync } from '@/data/db';
import { CAMPOS_PACIENTE } from '@/data/repo';

export type TablaRemota = TablaSync | 'ajuste';
export type Fila = Record<string, unknown>;

/** Lo que el motor necesita de la nube. */
export interface Remoto {
  /** Crea o reemplaza filas por id (en ajuste, por clave). */
  subir(tabla: TablaRemota, filas: Fila[]): Promise<void>;
  /** Marca filas como borradas. */
  borrar(tabla: TablaSync, ids: string[]): Promise<void>;
  /** Filas con actualizado >= desde (todas si desde es null), en orden de actualizado. */
  bajar(tabla: TablaRemota, desde: string | null, desplazamiento: number, limite: number): Promise<Fila[]>;
}

interface Fk { col: string; tabla: TablaSync; opcional?: boolean }
interface Spec { tabla: TablaSync; campos: string[]; fks: Fk[] }

const SPECS: Record<TablaSync, Spec> = {
  paciente: { tabla: 'paciente', campos: [...CAMPOS_PACIENTE], fks: [] },
  cita: {
    tabla: 'cita',
    campos: ['fecha', 'hora', 'duracion_min', 'lugar', 'direccion', 'estado', 'recordatorio_enviado', 'calendar_event_id'],
    fks: [{ col: 'paciente_id', tabla: 'paciente' }],
  },
  paquete: { tabla: 'paquete', campos: ['sesiones', 'usadas', 'precio', 'fecha'], fks: [{ col: 'paciente_id', tabla: 'paciente' }] },
  sesion: {
    tabla: 'sesion',
    campos: ['fecha', 'dolor', 'trabajo', 'notas'],
    fks: [{ col: 'paciente_id', tabla: 'paciente' }, { col: 'cita_id', tabla: 'cita', opcional: true }],
  },
  cobro: {
    tabla: 'cobro',
    campos: ['fecha', 'monto', 'metodo', 'lugar', 'factura', 'concepto'],
    fks: [
      { col: 'paciente_id', tabla: 'paciente' },
      { col: 'cita_id', tabla: 'cita', opcional: true },
      { col: 'paquete_id', tabla: 'paquete', opcional: true },
    ],
  },
};

// ---------- Conversión entre SQLite y Postgres ----------

const BOOLEANOS = new Set(['recordatorio_enviado', 'factura']);
const NUMEROS = new Set(['duracion_min', 'sesiones', 'usadas', 'precio', 'dolor', 'monto']);

function aNube(campo: string, v: unknown): unknown {
  if (BOOLEANOS.has(campo)) return !!v;
  if (campo === 'nacimiento') return v ? v : null; // '' local = sin fecha
  return v;
}

function deNube(campo: string, v: unknown): unknown {
  if (BOOLEANOS.has(campo)) return v ? 1 : 0;
  if (NUMEROS.has(campo)) return Number(v ?? 0);
  if (campo === 'hora') return String(v ?? '').slice(0, 5); // Postgres devuelve HH:MM:SS
  if (campo === 'calendar_event_id') return v ?? null;
  return v ?? '';
}

// ---------- Estado ----------

interface Meta { cuenta: string | null; cursores: Record<string, string>; ultimo: string | null }

export async function leerMeta(db: SQLiteDatabase): Promise<Meta> {
  const m = await db.getFirstAsync<{ cuenta: string | null; cursores: string; ultimo: string | null }>(
    'SELECT cuenta, cursores, ultimo FROM sync_meta WHERE id = 1',
  );
  return { cuenta: m?.cuenta ?? null, cursores: JSON.parse(m?.cursores || '{}'), ultimo: m?.ultimo ?? null };
}

/** Cambios del teléfono que aún no llegan a la nube. */
export async function contarPendientes(db: SQLiteDatabase): Promise<number> {
  const partes = [...TABLAS_SYNC, 'ajuste'].map((t) => `(SELECT COUNT(*) FROM ${t} WHERE pendiente = 1)`);
  const r = await db.getFirstAsync<{ n: number }>(`SELECT ${partes.join(' + ')} + (SELECT COUNT(*) FROM sync_borrado) AS n`);
  return r?.n ?? 0;
}

export class CuentaDistintaError extends Error {
  constructor() {
    super('Los datos de este teléfono pertenecen a otra cuenta.');
  }
}

export interface Resultado { subidas: number; bajadas: number; borradas: number; primeraVez: boolean }

/**
 * Una vuelta completa: sube lo pendiente y luego baja lo nuevo.
 * Si el teléfono no tenía cuenta, adopta la de quien entró (sus datos se suben).
 */
export async function sincronizar(db: SQLiteDatabase, remoto: Remoto, cuenta: string, ahora: () => string = () => new Date().toISOString()): Promise<Resultado> {
  const meta = await leerMeta(db);
  if (meta.cuenta && meta.cuenta !== cuenta) throw new CuentaDistintaError();
  if (!meta.cuenta) await db.runAsync('UPDATE sync_meta SET cuenta = ? WHERE id = 1', cuenta);
  const primeraVez = Object.keys(meta.cursores).length === 0;

  const subidas = await subirTodo(db, remoto);
  const { bajadas, borradas } = await bajarTodo(db, remoto, meta.cursores);
  await db.runAsync('UPDATE sync_meta SET ultimo = ? WHERE id = 1', ahora());
  return { subidas, bajadas, borradas, primeraVez };
}

// ---------- Subir ----------

const LOTE = 200;
const MAX_VUELTAS = 25;

async function subirTodo(db: SQLiteDatabase, remoto: Remoto): Promise<number> {
  let total = 0;
  for (const t of TABLAS_SYNC) total += await subirTabla(db, remoto, SPECS[t]);
  total += await subirAjustes(db, remoto);

  // Borrados
  const borrados = await db.getAllAsync<{ tabla: TablaSync; uid: string }>('SELECT tabla, uid FROM sync_borrado');
  for (const t of TABLAS_SYNC) {
    const ids = borrados.filter((b) => b.tabla === t).map((b) => b.uid);
    if (!ids.length) continue;
    await remoto.borrar(t, ids);
    await db.runAsync(`DELETE FROM sync_borrado WHERE tabla = ? AND uid IN (${ids.map(() => '?').join(',')})`, [t, ...ids]);
    total += ids.length;
  }
  return total;
}

async function subirTabla(db: SQLiteDatabase, remoto: Remoto, spec: Spec): Promise<number> {
  const joins = spec.fks.map((f, i) => `LEFT JOIN ${f.tabla} f${i} ON f${i}.id = t.${f.col}`).join(' ');
  const colsFk = spec.fks.map((f, i) => `, f${i}.uid AS fk_${f.col}`).join('');
  const sql = `SELECT t.id, t.rev, t.uid, ${spec.campos.map((c) => `t.${c}`).join(', ')}${colsFk}
                 FROM ${spec.tabla} t ${joins} WHERE t.pendiente = 1 ORDER BY t.id LIMIT ${LOTE}`;
  let total = 0;
  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const filas = await db.getAllAsync<Fila>(sql);
    if (!filas.length) break;
    const salida: Fila[] = [];
    for (const f of filas) {
      const r: Fila = { id: f.uid };
      for (const c of spec.campos) r[c] = aNube(c, f[c]);
      for (const k of spec.fks) r[k.col] = f[`fk_${k.col}`] ?? null;
      salida.push(r);
    }
    await remoto.subir(spec.tabla, salida);
    // Sin transacción a propósito: el respaldo corre mientras el fisio usa la app, y una transacción
    // abierta aquí chocaría con las de las pantallas. Cada UPDATE es atómico; si algo falla, se reintenta.
    for (const f of filas) {
      await db.runAsync(`UPDATE ${spec.tabla} SET pendiente = 0 WHERE id = ? AND rev = ?`, f.id as number, f.rev as number);
    }
    total += filas.length;
    if (filas.length < LOTE) break;
  }
  return total;
}

async function subirAjustes(db: SQLiteDatabase, remoto: Remoto): Promise<number> {
  const filas = await db.getAllAsync<{ clave: string; valor: string; rev: number }>('SELECT clave, valor, rev FROM ajuste WHERE pendiente = 1');
  if (!filas.length) return 0;
  await remoto.subir('ajuste', filas.map((f) => ({ clave: f.clave, valor: f.valor })));
  for (const f of filas) await db.runAsync('UPDATE ajuste SET pendiente = 0 WHERE clave = ? AND rev = ?', f.clave, f.rev);
  return filas.length;
}

// ---------- Bajar ----------

async function bajarTodo(db: SQLiteDatabase, remoto: Remoto, cursores: Record<string, string>): Promise<{ bajadas: number; borradas: number }> {
  let bajadas = 0;
  let borradas = 0;
  const nuevos = { ...cursores };

  for (const t of TABLAS_SYNC) {
    const desde = cursores[t] ?? null;
    let max = desde;
    for (let off = 0; ; off += LOTE) {
      const filas = await remoto.bajar(t, desde, off, LOTE);
      for (const f of filas) {
        const r = await aplicar(db, SPECS[t], f);
        if (r === 'aplicada') bajadas++;
        if (r === 'borrada') borradas++;
        const act = String(f.actualizado);
        if (!max || act > max) max = act;
      }
      if (filas.length < LOTE) break;
    }
    if (max) nuevos[t] = max;
  }

  const desde = cursores.ajuste ?? null;
  let max = desde;
  for (let off = 0; ; off += LOTE) {
    const filas = await remoto.bajar('ajuste', desde, off, LOTE);
    for (const f of filas) {
      await db.runAsync(
        `INSERT INTO ajuste (clave, valor, pendiente) VALUES (?, ?, 0)
         ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, pendiente = 0, rev = rev + 1 WHERE ajuste.pendiente = 0`,
        String(f.clave), String(f.valor),
      );
      const act = String(f.actualizado);
      if (!max || act > max) max = act;
    }
    if (filas.length < LOTE) break;
  }
  if (max) nuevos.ajuste = max;

  await db.runAsync('UPDATE sync_meta SET cursores = ? WHERE id = 1', JSON.stringify(nuevos));
  return { bajadas, borradas };
}

/** Aplica una fila de la nube. Si aquí hay cambios sin subir, ganan los de aquí. */
async function aplicar(db: SQLiteDatabase, spec: Spec, f: Fila): Promise<'aplicada' | 'borrada' | 'omitida'> {
  const uid = String(f.id);
  const local = await db.getFirstAsync<{ id: number; pendiente: number }>(`SELECT id, pendiente FROM ${spec.tabla} WHERE uid = ?`, uid);

  if (f.borrado) {
    if (!local) return 'omitida';
    await db.runAsync(`DELETE FROM ${spec.tabla} WHERE id = ?`, local.id);
    // El borrado vino de la nube: no hay que volver a avisarle (si esto fallara, solo se reenvía).
    await db.runAsync('DELETE FROM sync_borrado WHERE tabla = ? AND uid = ?', spec.tabla, uid);
    return 'borrada';
  }
  if (local?.pendiente) return 'omitida';

  const valores: Record<string, unknown> = {};
  for (const c of spec.campos) valores[c] = deNube(c, f[c]);
  for (const k of spec.fks) {
    const ref = f[k.col];
    if (ref == null) {
      if (!k.opcional) return 'omitida';
      valores[k.col] = null;
      continue;
    }
    const padre = await db.getFirstAsync<{ id: number }>(`SELECT id FROM ${k.tabla} WHERE uid = ?`, String(ref));
    if (!padre) {
      if (!k.opcional) return 'omitida';
      valores[k.col] = null;
    } else {
      valores[k.col] = padre.id;
    }
  }

  const cols = Object.keys(valores);
  const params = cols.map((c) => valores[c] as string | number | null);
  if (local) {
    await db.runAsync(
      `UPDATE ${spec.tabla} SET ${cols.map((c) => `${c} = ?`).join(', ')}, pendiente = 0, rev = rev + 1 WHERE id = ? AND pendiente = 0`,
      [...params, local.id],
    );
  } else {
    await db.runAsync(
      `INSERT INTO ${spec.tabla} (uid, pendiente, ${cols.join(', ')}) VALUES (?, 0, ${cols.map(() => '?').join(', ')})`,
      [uid, ...params],
    );
  }
  return 'aplicada';
}

// ---------- Salir ----------

/** Borra todo del teléfono (al salir de la cuenta). Lo respaldado vuelve al entrar. */
export async function borrarDatosLocales(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const t of [...TABLAS_SYNC].reverse()) await db.runAsync(`DELETE FROM ${t}`);
    await db.runAsync('DELETE FROM ajuste');
    await db.runAsync('DELETE FROM sync_borrado');
    await db.runAsync("UPDATE sync_meta SET cuenta = NULL, cursores = '{}', ultimo = NULL WHERE id = 1");
  });
}
