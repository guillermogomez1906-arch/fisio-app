// Base de datos local. El teléfono es la fuente de verdad: todo funciona sin señal.
// La sincronización con Supabase (ver supabase/schema.sql) se monta encima en una fase posterior.

import type { SQLiteDatabase } from 'expo-sqlite';

export const NOMBRE_BD = 'fisio.db';

/**
 * Migraciones en orden. Nunca editar una ya publicada: agregar una nueva al final.
 * La versión vive en PRAGMA user_version.
 */
const MIGRACIONES: string[] = [
  `
  CREATE TABLE paciente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    telefono TEXT NOT NULL DEFAULT '',
    lugar TEXT NOT NULL DEFAULT 'consultorio' CHECK (lugar IN ('consultorio','domicilio')),
    direccion TEXT NOT NULL DEFAULT '',
    nacimiento TEXT NOT NULL DEFAULT '',
    sexo TEXT NOT NULL DEFAULT '',
    ocupacion TEXT NOT NULL DEFAULT '',
    correo TEXT NOT NULL DEFAULT '',
    emergencia TEXT NOT NULL DEFAULT '',
    patologicos TEXT NOT NULL DEFAULT '',
    quirurgicos TEXT NOT NULL DEFAULT '',
    medicamentos TEXT NOT NULL DEFAULT '',
    alergias TEXT NOT NULL DEFAULT '',
    actividad TEXT NOT NULL DEFAULT '',
    motivo TEXT NOT NULL DEFAULT '',
    inicio TEXT NOT NULL DEFAULT '',
    dx_fisio TEXT NOT NULL DEFAULT '',
    dx_medico TEXT NOT NULL DEFAULT '',
    refiere TEXT NOT NULL DEFAULT '',
    objetivos TEXT NOT NULL DEFAULT '',
    rfc TEXT NOT NULL DEFAULT '',
    regimen TEXT NOT NULL DEFAULT '',
    creado TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE cita (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER NOT NULL REFERENCES paciente(id) ON DELETE CASCADE,
    fecha TEXT NOT NULL,
    hora TEXT NOT NULL,
    duracion_min INTEGER NOT NULL DEFAULT 60,
    lugar TEXT NOT NULL CHECK (lugar IN ('consultorio','domicilio')),
    direccion TEXT NOT NULL DEFAULT '',
    estado TEXT NOT NULL DEFAULT 'agendada'
      CHECK (estado IN ('agendada','confirmada','atendida','cancelada','no_llego')),
    recordatorio_enviado INTEGER NOT NULL DEFAULT 0,
    calendar_event_id TEXT
  );
  CREATE INDEX cita_fecha ON cita(fecha, hora);

  CREATE TABLE sesion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cita_id INTEGER REFERENCES cita(id) ON DELETE SET NULL,
    paciente_id INTEGER NOT NULL REFERENCES paciente(id) ON DELETE CASCADE,
    fecha TEXT NOT NULL,
    dolor INTEGER NOT NULL CHECK (dolor BETWEEN 1 AND 10),
    trabajo TEXT NOT NULL DEFAULT '',
    notas TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX sesion_paciente ON sesion(paciente_id, fecha);

  CREATE TABLE paquete (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER NOT NULL REFERENCES paciente(id) ON DELETE CASCADE,
    sesiones INTEGER NOT NULL CHECK (sesiones > 0),
    usadas INTEGER NOT NULL DEFAULT 0,
    precio REAL NOT NULL DEFAULT 0,
    fecha TEXT NOT NULL
  );

  CREATE TABLE cobro (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER NOT NULL REFERENCES paciente(id) ON DELETE CASCADE,
    cita_id INTEGER REFERENCES cita(id) ON DELETE SET NULL,
    paquete_id INTEGER REFERENCES paquete(id) ON DELETE SET NULL,
    fecha TEXT NOT NULL,
    monto REAL NOT NULL DEFAULT 0,
    metodo TEXT NOT NULL CHECK (metodo IN ('efectivo','transferencia','tarjeta','paquete')),
    lugar TEXT NOT NULL CHECK (lugar IN ('consultorio','domicilio')),
    factura INTEGER NOT NULL DEFAULT 0,
    concepto TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX cobro_fecha ON cobro(fecha);

  CREATE TABLE ajuste (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );
  `,
];

export async function migrar(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = fila?.user_version ?? 0;
  while (version < MIGRACIONES.length) {
    const sql = MIGRACIONES[version];
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
    });
    version++;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}
