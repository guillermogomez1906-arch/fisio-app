/// <reference types="node" />
// Prueba la capa de datos contra SQLite real (node:sqlite), con un adaptador mínimo
// que imita la API asíncrona de expo-sqlite. Se corre con: npm run test:datos

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { migrar } from './db';
import { abrirBdPrueba as abrir } from './sqlite-node';
import {
  actualizarPaciente, cargarEjemplo, citasDelDia, cobrarCita, cobrosDelMes, crearCita, crearPaciente,
  guardarSesion, listarPacientes, marcarRecordatorio, obtenerAjustes, obtenerCita, obtenerPaciente,
  paquetesDePaciente, sesionesDePaciente, venderPaquete, guardarAjustes,
} from './repo';
import { resumenMes, sumarDias } from '../domain/logic';

const HOY = '2026-10-07';

test('migración idempotente y datos de ejemplo coherentes', async () => {
  const db = abrir();
  await migrar(db);
  await migrar(db); // segunda vez no hace nada
  await cargarEjemplo(db, HOY);

  const hoy = await citasDelDia(db, HOY);
  assert.deepEqual(hoy.map((c) => c.hora), ['09:00', '11:00', '12:20', '16:00']);
  assert.equal(hoy[0].paciente_nombre, 'Ana López');

  const ana = (await listarPacientes(db, 'ana'))[0];
  assert.equal(ana.restantes_paquete, 6);
  assert.equal(ana.ultima_sesion, sumarDias(HOY, -3));

  const porTel = await listarPacientes(db, '33 2222');
  assert.deepEqual(porTel.map((p) => p.nombre), ['Roberto Díaz']);

  const a = await obtenerAjustes(db);
  assert.equal(a.tarifa_consultorio, 500);
});

test('flujo de una cita: sesión, cobro con paquete y cobro normal', async () => {
  const db = abrir();
  await migrar(db);
  const pid = await crearPaciente(db, { nombre: 'Prueba Uno', telefono: '3312345678', lugar: 'domicilio', direccion: 'Calle 1' });
  await venderPaquete(db, { paciente_id: pid, sesiones: 2, precio: 1000, fecha: HOY, metodo: 'transferencia', lugar: 'domicilio', factura: true });

  const c1 = await crearCita(db, { paciente_id: pid, fecha: HOY, hora: '10:00', duracion_min: 60, lugar: 'domicilio', direccion: 'Calle 1' });
  await guardarSesion(db, { cita_id: c1, paciente_id: pid, fecha: HOY, dolor: 6, trabajo: 'Vendaje', notas: '' });
  await guardarSesion(db, { cita_id: c1, paciente_id: pid, fecha: HOY, dolor: 5, trabajo: 'Vendaje', notas: 'corregida' }); // reemplaza
  const cita = (await obtenerCita(db, c1))!;
  assert.equal(cita.estado, 'atendida');
  assert.equal(cita.con_sesion, 1);
  assert.equal((await sesionesDePaciente(db, pid)).length, 1);

  await cobrarCita(db, cita, { usarPaquete: true, monto: 0, metodo: 'efectivo', factura: false });
  assert.equal((await paquetesDePaciente(db, pid))[0].usadas, 1);
  assert.equal((await obtenerCita(db, c1))!.pagado, 1);

  const c2 = await crearCita(db, { paciente_id: pid, fecha: HOY, hora: '12:00', duracion_min: 60, lugar: 'domicilio', direccion: 'Calle 1' });
  await cobrarCita(db, (await obtenerCita(db, c2))!, { usarPaquete: true, monto: 0, metodo: 'efectivo', factura: false });
  const c3 = await crearCita(db, { paciente_id: pid, fecha: HOY, hora: '14:00', duracion_min: 60, lugar: 'domicilio', direccion: 'Calle 1' });
  await assert.rejects(
    cobrarCita(db, (await obtenerCita(db, c3))!, { usarPaquete: true, monto: 0, metodo: 'efectivo', factura: false }),
    /no tiene sesiones/,
  );
  // el intento fallido no dejó rastro
  assert.equal((await obtenerCita(db, c3))!.pagado, 0);
  await cobrarCita(db, (await obtenerCita(db, c3))!, { usarPaquete: false, monto: 700, metodo: 'efectivo', factura: false });

  const r = resumenMes(await cobrosDelMes(db, '2026-10'), '2026-10');
  assert.equal(r.total, 1700); // paquete 1000 + sesión 700
  assert.equal(r.sesionesPaquete, 2);
  assert.equal(r.facturas, 1);
  assert.equal(r.porLugar.domicilio, 1700);
});

test('editar historia clínica solo toca columnas permitidas', async () => {
  const db = abrir();
  await migrar(db);
  const pid = await crearPaciente(db, { nombre: 'Prueba Dos' });
  await actualizarPaciente(db, pid, { dx_fisio: 'Esguince', alergias: 'Penicilina', nacimiento: '1990-05-09' });
  // Una clave no permitida se ignora en vez de llegar al SQL.
  await actualizarPaciente(db, pid, { ['id = 0; DROP TABLE paciente; --' as 'nombre']: 'x' });
  const p = (await obtenerPaciente(db, pid))!;
  assert.equal(p.dx_fisio, 'Esguince');
  assert.equal(p.alergias, 'Penicilina');
  assert.equal(p.nombre, 'Prueba Dos');
});

test('recordatorios y ajustes', async () => {
  const db = abrir();
  await migrar(db);
  const pid = await crearPaciente(db, { nombre: 'Prueba Tres' });
  const c = await crearCita(db, { paciente_id: pid, fecha: sumarDias(HOY, 1), hora: '09:00', duracion_min: 60, lugar: 'consultorio', direccion: '' });
  await marcarRecordatorio(db, [c]);
  assert.equal((await obtenerCita(db, c))!.recordatorio_enviado, 1);
  await guardarAjustes(db, { tarifa_domicilio: 800, duracion_min: 45 });
  await guardarAjustes(db, { tarifa_domicilio: 850 });
  const a = await obtenerAjustes(db);
  assert.equal(a.tarifa_domicilio, 850);
  assert.equal(a.duracion_min, 45);
});
