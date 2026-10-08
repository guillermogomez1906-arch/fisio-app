// Base de datos local. El teléfono es la fuente de verdad: todo funciona sin señal.
// La sincronización con Supabase (ver supabase/schema.sql) se monta encima en una fase posterior.

import type { SQLiteDatabase } from 'expo-sqlite';

export const NOMBRE_BD = 'fisio.db';

/** Tablas que se respaldan, en orden de dependencia (padres primero). */
export const TABLAS_SYNC = ['paciente', 'cita', 'paquete', 'sesion', 'cobro'] as const;
export type TablaSync = (typeof TABLAS_SYNC)[number];

/** UUID v4 generado dentro de SQLite. */
const UUID_SQL = `(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))))`;

/**
 * Respaldo en la nube. Cada fila recibe:
 *  - uid: su id en la nube (uuid), igual en todos los teléfonos de la cuenta.
 *  - pendiente: 1 si cambió aquí y falta subirla.
 *  - rev: contador de cambios; al subir, solo se limpia "pendiente" si nadie la tocó mientras tanto.
 * Los triggers marcan las filas sin que el resto de la app se entere. La sincronización escribe
 * con pendiente = 0 y rev + 1, que es justo lo que los triggers ignoran.
 */
function migracionRespaldo(): string {
  const porTabla = TABLAS_SYNC.map((t) => `
  ALTER TABLE ${t} ADD COLUMN uid TEXT;
  ALTER TABLE ${t} ADD COLUMN pendiente INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE ${t} ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;
  UPDATE ${t} SET uid = ${UUID_SQL};
  CREATE UNIQUE INDEX ${t}_uid ON ${t}(uid);
  CREATE TRIGGER ${t}_alta AFTER INSERT ON ${t} WHEN NEW.pendiente = 1
  BEGIN
    UPDATE ${t} SET uid = COALESCE(NEW.uid, ${UUID_SQL}), rev = rev + 1 WHERE id = NEW.id;
  END;
  CREATE TRIGGER ${t}_cambio AFTER UPDATE ON ${t} WHEN NEW.pendiente = OLD.pendiente AND NEW.rev = OLD.rev
  BEGIN
    UPDATE ${t} SET pendiente = 1, rev = rev + 1 WHERE id = NEW.id;
  END;
  CREATE TRIGGER ${t}_baja AFTER DELETE ON ${t} WHEN OLD.uid IS NOT NULL
  BEGIN
    INSERT OR IGNORE INTO sync_borrado (tabla, uid) VALUES ('${t}', OLD.uid);
  END;`).join('\n');

  return `
  CREATE TABLE sync_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    cuenta TEXT,
    cursores TEXT NOT NULL DEFAULT '{}',
    ultimo TEXT
  );
  INSERT INTO sync_meta (id) VALUES (1);
  CREATE TABLE sync_borrado (
    tabla TEXT NOT NULL,
    uid TEXT NOT NULL,
    PRIMARY KEY (tabla, uid)
  );
  ${porTabla}
  ALTER TABLE ajuste ADD COLUMN pendiente INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE ajuste ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;
  CREATE TRIGGER ajuste_cambio AFTER UPDATE ON ajuste WHEN NEW.pendiente = OLD.pendiente AND NEW.rev = OLD.rev
  BEGIN
    UPDATE ajuste SET pendiente = 1, rev = rev + 1 WHERE clave = NEW.clave;
  END;
  `;
}

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
  migracionRespaldo(),
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
