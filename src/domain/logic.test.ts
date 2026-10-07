/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  citasSinMargen, csvContador, edad, fechaLarga, mensajeConfirmacion, mensajeRecordatorio,
  paqueteVigente, parseFechaMx, resumenMes, sumarDias, telefonoWhatsapp, urlWhatsapp, historiaIncompleta,
} from './logic.ts';
import type { Cita, Cobro } from './types.ts';

const cita = (p: Partial<Cita>): Cita => ({
  id: 1, paciente_id: 1, fecha: '2026-10-07', hora: '09:00', duracion_min: 60, lugar: 'consultorio',
  direccion: '', estado: 'agendada', recordatorio_enviado: 0, calendar_event_id: null, ...p,
});

const cobro = (p: Partial<Cobro>): Cobro => ({
  id: 1, paciente_id: 1, cita_id: null, paquete_id: null, fecha: '2026-10-01', monto: 500,
  metodo: 'efectivo', lugar: 'consultorio', factura: 0, concepto: 'Sesión', ...p,
});

test('fechas: largas, suma de días a fin de mes y sin corrimiento por zona horaria', () => {
  assert.equal(fechaLarga('2026-10-07'), 'miércoles 7 de octubre');
  assert.equal(sumarDias('2026-10-31', 1), '2026-11-01');
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
});

test('parseFechaMx acepta dd/mm/aaaa y rechaza fechas que no existen', () => {
  assert.equal(parseFechaMx('14/03/1991'), '1991-03-14');
  assert.equal(parseFechaMx('1-2-2000'), '2000-02-01');
  assert.equal(parseFechaMx('31/02/2020'), null);
  assert.equal(parseFechaMx('1991-03-14'), null);
});

test('edad cumple el día exacto', () => {
  assert.equal(edad('1991-03-14', '2026-03-13'), 34);
  assert.equal(edad('1991-03-14', '2026-03-14'), 35);
  assert.equal(edad('', '2026-03-14'), null);
});

test('teléfonos mexicanos a formato de WhatsApp', () => {
  assert.equal(telefonoWhatsapp('33 1111 2233'), '523311112233');
  assert.equal(telefonoWhatsapp('+52 33 1111 2233'), '523311112233');
  assert.equal(telefonoWhatsapp('521 33 1111 2233'), '523311112233');
  assert.equal(telefonoWhatsapp('1234'), null);
  assert.equal(urlWhatsapp('', 'hola'), null);
  assert.ok(urlWhatsapp('3311112233', 'Hola Ana')!.endsWith('?text=Hola%20Ana'));
});

test('mensajes dicen hoy, mañana o la fecha, y la dirección si es domicilio', () => {
  const p = { nombre: 'Roberto Díaz' };
  const hoy = '2026-10-07';
  assert.match(mensajeConfirmacion(p, cita({ fecha: hoy }), hoy), /^Hola Roberto, .* hoy miércoles a las 09:00 en el consultorio/);
  assert.match(mensajeConfirmacion(p, cita({ fecha: '2026-10-08' }), hoy), /mañana jueves/);
  assert.match(mensajeConfirmacion(p, cita({ fecha: '2026-10-09' }), hoy), /el viernes 9 de octubre/);
  assert.match(mensajeRecordatorio(p, cita({ lugar: 'domicilio', direccion: 'Av. Patria 1200' })), /en tu domicilio \(Av\. Patria 1200\)/);
});

test('aviso de traslado: domicilio sin 30 minutos libres desde la cita anterior', () => {
  const citas = [
    cita({ id: 1, hora: '11:00', lugar: 'domicilio', direccion: 'Zapopan' }),
    cita({ id: 2, hora: '12:20', lugar: 'domicilio', direccion: 'Tlaquepaque' }), // 20 min libres
    cita({ id: 3, hora: '14:00', lugar: 'domicilio', direccion: 'Tonalá' }), // 40 min libres
    cita({ id: 4, hora: '15:00', lugar: 'consultorio' }), // consultorio: no aplica
  ];
  assert.deepEqual([...citasSinMargen(citas)], [2]);
});

test('aviso de traslado ignora citas canceladas y la misma dirección', () => {
  const citas = [
    cita({ id: 1, hora: '11:00', lugar: 'domicilio', direccion: 'Zapopan', estado: 'cancelada' }),
    cita({ id: 2, hora: '11:30', lugar: 'domicilio', direccion: 'Tlaquepaque' }),
    cita({ id: 3, hora: '12:30', lugar: 'domicilio', direccion: 'Tlaquepaque' }),
  ];
  assert.equal(citasSinMargen(citas).size, 0);
});

test('paquete vigente: el más antiguo con sesiones restantes', () => {
  const pqs = [
    { id: 1, sesiones: 5, usadas: 5, fecha: '2026-08-01' },
    { id: 2, sesiones: 10, usadas: 3, fecha: '2026-09-01' },
    { id: 3, sesiones: 10, usadas: 0, fecha: '2026-10-01' },
  ];
  assert.equal(paqueteVigente(pqs)?.id, 2);
  assert.equal(paqueteVigente([pqs[0]]), null);
});

test('resumen del mes separa dinero, paquete y facturas', () => {
  const cobros = [
    cobro({ id: 1, monto: 700, metodo: 'transferencia', lugar: 'domicilio' }),
    cobro({ id: 2, monto: 500, metodo: 'efectivo', factura: 1 }),
    cobro({ id: 3, monto: 0, metodo: 'paquete' }),
    cobro({ id: 4, monto: 900, fecha: '2026-09-30' }), // otro mes
  ];
  const r = resumenMes(cobros, '2026-10');
  assert.equal(r.total, 1200);
  assert.equal(r.porMetodo.transferencia, 700);
  assert.equal(r.porLugar.domicilio, 700);
  assert.equal(r.movimientos, 3);
  assert.equal(r.sesionesPaquete, 1);
  assert.equal(r.facturas, 1);
  assert.equal(r.montoFacturar, 500);
});

test('CSV para el contador: BOM, comas escapadas y RFC solo si pidió factura', () => {
  const csv = csvContador(
    [cobro({ id: 2, fecha: '2026-10-05', factura: 1 }), cobro({ id: 1, fecha: '2026-10-02', paciente_id: 2 })],
    [{ id: 1, nombre: 'López, Ana', rfc: 'LOAA910314XX1' }, { id: 2, nombre: 'Carmen', rfc: 'XXX' }],
    '2026-10',
  );
  const lineas = csv.replace('﻿', '').trim().split('\n');
  assert.ok(csv.startsWith('﻿'));
  assert.equal(lineas.length, 3);
  assert.match(lineas[1], /^02\/10\/2026,Carmen,.*,No,$/);
  assert.match(lineas[2], /^05\/10\/2026,"López, Ana",.*,Sí,LOAA910314XX1$/);
});

test('historia incompleta sin nacimiento, diagnóstico o teléfono', () => {
  assert.equal(historiaIncompleta({ nacimiento: '1990-01-01', dx_fisio: 'Lumbalgia', telefono: '33' }), false);
  assert.equal(historiaIncompleta({ nacimiento: '', dx_fisio: 'Lumbalgia', telefono: '33' }), true);
  assert.equal(historiaIncompleta({ nacimiento: '1990-01-01', dx_fisio: ' ', telefono: '33' }), true);
});
