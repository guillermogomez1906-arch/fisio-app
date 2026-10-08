/// <reference types="node" />
// Dos "teléfonos" (bases SQLite reales) sincronizando contra una nube falsa en memoria.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { migrar } from '../data/db';
import {
  actualizarPaciente, cargarEjemplo, citasDelDia, cobrosDelMes, guardarAjustes, guardarSesion, listarPacientes,
  obtenerAjustes, obtenerCita, obtenerPaciente, paquetesDePaciente, sesionesDePaciente,
} from '../data/repo';
import { abrirBdPrueba } from '../data/sqlite-node';
import { resumenMes } from '../domain/logic';
import { borrarDatosLocales, contarPendientes, CuentaDistintaError, sincronizar, type Fila, type Remoto, type TablaRemota } from './motor';

const HOY = '2026-10-07';
const CUENTA = 'fisio-1';

/** Nube falsa: guarda filas por tabla y les pone "actualizado" como lo haría Postgres. */
function nubeFalsa(): Remoto & { tablas: Map<TablaRemota, Map<string, Fila>> } {
  const tablas = new Map<TablaRemota, Map<string, Fila>>();
  let reloj = 0;
  const marca = () => new Date(Date.UTC(2026, 9, 7) + ++reloj).toISOString();
  const de = (t: TablaRemota) => { if (!tablas.has(t)) tablas.set(t, new Map()); return tablas.get(t)!; };
  return {
    tablas,
    async subir(t, filas) {
      const m = de(t);
      for (const f of filas) {
        const llave = t === 'ajuste' ? String(f.clave) : String(f.id);
        m.set(llave, { ...m.get(llave), ...f, actualizado: marca(), borrado: null });
      }
    },
    async borrar(t, ids) {
      const m = de(t);
      for (const id of ids) { const f = m.get(id); if (f) m.set(id, { ...f, borrado: marca(), actualizado: marca() }); }
    },
    async bajar(t, desde, off, lim) {
      return [...de(t).values()]
        .filter((f) => !desde || String(f.actualizado) >= desde)
        .sort((a, b) => String(a.actualizado).localeCompare(String(b.actualizado)))
        .slice(off, off + lim)
        .map((f) => ({ ...f, hora: f.hora ? `${f.hora}:00` : f.hora })); // Postgres devuelve HH:MM:SS
    },
  };
}

async function telefono() {
  const db = abrirBdPrueba();
  await migrar(db);
  return db;
}

test('lo capturado en un teléfono se restaura completo en otro', async () => {
  const nube = nubeFalsa();
  const a = await telefono();
  await cargarEjemplo(a, HOY);
  await guardarAjustes(a, { nombre_fisio: 'Lic. Pérez' });
  assert.ok((await contarPendientes(a)) > 0);

  const r1 = await sincronizar(a, nube, CUENTA);
  assert.ok(r1.subidas > 0);
  assert.equal(await contarPendientes(a), 0, 'tras subir no queda nada pendiente');

  const b = await telefono();
  const r2 = await sincronizar(b, nube, CUENTA);
  assert.equal(r2.primeraVez, true);
  assert.equal(await contarPendientes(b), 0, 'lo bajado no se vuelve a subir');

  // Mismos pacientes, citas, sesiones, paquetes, cobros y ajustes
  const [pa, pb] = [await listarPacientes(a), await listarPacientes(b)];
  assert.deepEqual(pb.map((p) => [p.nombre, p.restantes_paquete, p.ultima_sesion]), pa.map((p) => [p.nombre, p.restantes_paquete, p.ultima_sesion]));
  const [ca, cb] = [await citasDelDia(a, HOY), await citasDelDia(b, HOY)];
  assert.deepEqual(cb.map((c) => [c.hora, c.paciente_nombre, c.lugar, c.estado]), ca.map((c) => [c.hora, c.paciente_nombre, c.lugar, c.estado]));
  assert.deepEqual(resumenMes(await cobrosDelMes(b, '2026-10'), '2026-10'), resumenMes(await cobrosDelMes(a, '2026-10'), '2026-10'));
  assert.equal((await obtenerAjustes(b)).nombre_fisio, 'Lic. Pérez');
  assert.equal((await obtenerAjustes(b)).tarifa_domicilio, 700);

  const robertoB = pb.find((p) => p.nombre === 'Roberto Díaz')!;
  const fichaB = (await obtenerPaciente(b, robertoB.id))!;
  assert.equal(fichaB.alergias, 'Penicilina');
  assert.equal(fichaB.nacimiento, '1958-08-02');
  const sinFecha = (await obtenerPaciente(b, pb.find((p) => p.nombre === 'Jorge Méndez')!.id))!;
  assert.equal(sinFecha.nacimiento, '', 'fecha vacía ida y vuelta');

  // Las sesiones siguen ligadas a su cita
  const anaB = pb.find((p) => p.nombre === 'Ana López')!;
  const sesiones = await sesionesDePaciente(b, anaB.id);
  assert.equal(sesiones.length, 4);
  assert.ok(sesiones.every((s) => s.cita_id != null));
  assert.equal((await obtenerCita(b, sesiones[0].cita_id!))!.con_sesion, 1);
});

test('cambios y borrados viajan en ambos sentidos', async () => {
  const nube = nubeFalsa();
  const a = await telefono();
  await cargarEjemplo(a, HOY);
  await sincronizar(a, nube, CUENTA);
  const b = await telefono();
  await sincronizar(b, nube, CUENTA);

  // B edita una ficha y anota una sesión
  const carmenB = (await listarPacientes(b, 'Carmen'))[0];
  await actualizarPaciente(b, carmenB.id, { dx_fisio: 'Cervicalgia tensional crónica' });
  const citaCarmenB = (await citasDelDia(b, HOY)).find((c) => c.paciente_nombre === 'Carmen Ruiz')!;
  await guardarSesion(b, { cita_id: citaCarmenB.id, paciente_id: carmenB.id, fecha: HOY, dolor: 3, trabajo: 'Terapia manual', notas: '' });
  assert.ok((await contarPendientes(b)) >= 3); // paciente, sesión nueva, cita atendida
  await sincronizar(b, nube, CUENTA);

  const r = await sincronizar(a, nube, CUENTA);
  assert.ok(r.bajadas >= 3);
  const carmenA = (await listarPacientes(a, 'Carmen'))[0];
  assert.equal((await obtenerPaciente(a, carmenA.id))!.dx_fisio, 'Cervicalgia tensional crónica');
  const citaCarmenA = (await citasDelDia(a, HOY)).find((c) => c.paciente_nombre === 'Carmen Ruiz')!;
  assert.equal(citaCarmenA.estado, 'atendida');
  assert.equal(citaCarmenA.con_sesion, 1);

  // A borra una cita: desaparece también en B
  const jorgeA = (await citasDelDia(a, HOY)).find((c) => c.paciente_nombre === 'Jorge Méndez')!;
  await a.runAsync('DELETE FROM cita WHERE id = ?', jorgeA.id);
  await sincronizar(a, nube, CUENTA);
  const rb = await sincronizar(b, nube, CUENTA);
  assert.equal(rb.borradas, 1);
  assert.equal((await citasDelDia(b, HOY)).some((c) => c.paciente_nombre === 'Jorge Méndez'), false);
  assert.equal(await contarPendientes(b), 0, 'un borrado que vino de la nube no se regresa');
});

test('si los dos teléfonos editan lo mismo, gana el último en respaldar', async () => {
  const nube = nubeFalsa();
  const a = await telefono();
  await cargarEjemplo(a, HOY);
  await sincronizar(a, nube, CUENTA);
  const b = await telefono();
  await sincronizar(b, nube, CUENTA);

  const idA = (await listarPacientes(a, 'Ana'))[0].id;
  const idB = (await listarPacientes(b, 'Ana'))[0].id;
  await actualizarPaciente(a, idA, { ocupacion: 'Desde A' });
  await actualizarPaciente(b, idB, { ocupacion: 'Desde B' });
  await sincronizar(a, nube, CUENTA);
  await sincronizar(b, nube, CUENTA); // B sube antes de bajar: su versión gana
  await sincronizar(a, nube, CUENTA);
  assert.equal((await obtenerPaciente(a, idA))!.ocupacion, 'Desde B');
  assert.equal((await obtenerPaciente(b, idB))!.ocupacion, 'Desde B');
});

test('cobrar con paquete en otro teléfono descuenta el mismo paquete', async () => {
  const nube = nubeFalsa();
  const a = await telefono();
  await cargarEjemplo(a, HOY);
  await sincronizar(a, nube, CUENTA);
  const b = await telefono();
  await sincronizar(b, nube, CUENTA);

  const { cobrarCita } = await import('../data/repo');
  const citaAnaB = (await citasDelDia(b, HOY)).find((c) => c.paciente_nombre === 'Ana López')!;
  await cobrarCita(b, citaAnaB, { usarPaquete: true, monto: 0, metodo: 'efectivo', factura: false });
  await sincronizar(b, nube, CUENTA);
  await sincronizar(a, nube, CUENTA);
  const anaA = (await listarPacientes(a, 'Ana'))[0];
  const pq = (await paquetesDePaciente(a, anaA.id))[0];
  assert.equal(pq.usadas, 5);
  assert.equal((await citasDelDia(a, HOY)).find((c) => c.paciente_nombre === 'Ana López')!.pagado, 1);
});

test('no mezcla cuentas y al salir se puede restaurar', async () => {
  const nube = nubeFalsa();
  const a = await telefono();
  await cargarEjemplo(a, HOY);
  await sincronizar(a, nube, CUENTA);
  await assert.rejects(sincronizar(a, nube, 'otra-cuenta'), CuentaDistintaError);

  await borrarDatosLocales(a);
  assert.equal((await listarPacientes(a)).length, 0);
  assert.equal(await contarPendientes(a), 0, 'borrar al salir no manda borrados a la nube');
  await sincronizar(a, nube, CUENTA);
  assert.equal((await listarPacientes(a)).length, 4);
});

test('una segunda vuelta sin cambios no sube nada', async () => {
  const nube = nubeFalsa();
  const a = await telefono();
  await cargarEjemplo(a, HOY);
  await sincronizar(a, nube, CUENTA);
  const r = await sincronizar(a, nube, CUENTA);
  assert.equal(r.subidas, 0);
  assert.equal(await contarPendientes(a), 0);
});
