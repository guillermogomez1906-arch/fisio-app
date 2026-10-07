# Fisio (nombre de trabajo)

App para el fisioterapeuta que trabaja solo, en consultorio y a domicilio: agenda, historia clínica,
notas de sesión, cobros y paquetes, recordatorios por WhatsApp y el resumen del mes para su contador.

Hecha con Expo SDK 57 + Expo Router + TypeScript. Los datos viven en el teléfono (SQLite), así que
funciona completa sin señal.

## Qué hay en esta versión

| Pantalla | Qué hace |
| --- | --- |
| **Hoy** | Citas del día (con flechas para otros días), citas atendidas y lo cobrado. Avisa si no da tiempo de llegar a un domicilio. Recordatorios de mañana por WhatsApp. |
| **Cita** | Confirmar por WhatsApp con el mensaje escrito, abrir mapa, anotar sesión, cobrar, marcar "no llegó" o cancelar. |
| **Nueva cita** | Paciente existente o nuevo, día, hora, consultorio o domicilio. |
| **Anotar sesión** | Dolor del 1 al 10, qué se trabajó y notas (se pueden dictar con el teclado). |
| **Cobrar** | Monto con la tarifa precargada, forma de pago, factura, o descontar del paquete. |
| **Pacientes / Ficha** | Búsqueda por nombre o teléfono. Historia clínica en tres bloques (datos personales, antecedentes, diagnóstico y plan), paquete vigente, evolución del dolor y cobros. |
| **Resumen** | Ingresos del mes por forma de pago y por lugar, facturas pendientes, y exportar el CSV para el contador. |
| **Ajustes** | Tarifas de consultorio y domicilio, duración de la sesión. |

Con la base vacía, la pantalla Hoy ofrece **Cargar datos de ejemplo** para conocer la app.

## Correrla

```bash
npm install
npx expo start
```

La app usa SQLite y vector icons, que ya vienen en Expo Go, así que se puede probar escaneando el QR con
Expo Go en Android. Para instalarla como app propia: `npx eas-cli@latest build --profile preview --platform android`.

## Pruebas

```bash
npm test          # reglas de negocio (Node) + capa de datos contra SQLite real
npm run typecheck
npm run lint
```

- `src/domain/logic.test.ts`: fechas, mensajes de WhatsApp, teléfonos mexicanos, aviso de traslado,
  paquetes, resumen del mes y CSV.
- `src/data/repo.test.ts`: migraciones, datos de ejemplo y el flujo completo de una cita (sesión, cobro
  con paquete, cobro normal) contra `node:sqlite`.

## Cómo está organizado

```
src/
  app/          pantallas (Expo Router): (tabs)/ Hoy, Pacientes, Resumen; cita/, paciente/, ajustes
  data/         base local: migraciones (db.ts) y consultas (repo.ts). Las pantallas no escriben SQL.
  domain/       reglas puras sin React Native: tipos, lógica, estructura de la historia clínica
  ui/           tema, componentes y acciones externas (WhatsApp, mapas, compartir)
supabase/
  schema.sql    respaldo en la nube con seguridad por fisio (todavía no conectado)
```

Reglas que conviene respetar:

- **Migraciones solo hacia adelante.** Para cambiar la base se agrega una entrada al final de
  `MIGRACIONES` en `src/data/db.ts`; nunca se edita una ya publicada.
- **Columnas editables en lista cerrada** (`CAMPOS_PACIENTE`). Nunca se arma SQL con nombres libres.
- **Fechas locales**, no UTC: `isoLocal()` y `desdeIso()` evitan que una cita de noche se corra de día.

## Lo que sigue

1. **Cuenta y respaldo**: entrar con Google en Supabase y sincronizar la base local con `supabase/schema.sql`.
   El teléfono sigue mandando; la nube respalda y permite cambiar de teléfono.
2. **Google Calendar en los dos sentidos**: cada cita guarda `calendar_event_id` para eso.
3. **Aviso de privacidad y consentimiento del paciente** antes de usarla con pacientes reales:
   la historia clínica son datos de salud, que la LFPDPPP trata como sensibles.
4. **Versión 2**: factura CFDI desde el cobro, acceso de solo lectura para el contador, registro de gastos.
5. Recordatorios automáticos la tarde anterior (requiere la API de WhatsApp Business; hoy se mandan con un toque).
