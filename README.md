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
| **Ajustes** | Cuenta y estado del respaldo (respaldar ahora, salir), tarifas y duración de la sesión. |
| **Entrar** | Con Google o con un código que llega por correo. |

Sin nube configurada, la app funciona sin cuenta y la pantalla Hoy ofrece **Cargar datos de ejemplo**.

## Correrla

```bash
npm install
npx expo start
```

La app usa SQLite y vector icons, que ya vienen en Expo Go, así que se puede probar escaneando el QR con
Expo Go en Android.

### APK para instalar en un teléfono (sin Play Store)

Una vez, para ligar el proyecto con tu cuenta de Expo y darle las llaves de Supabase
(el `.env` no se sube a la nube de Expo):

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://TU-PROYECTO.supabase.co --visibility plaintext
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value sb_publishable_... --visibility plaintext
```

Cada vez que quieras un APK nuevo:

```bash
npx eas-cli@latest build --profile preview --platform android
```

Al terminar da un enlace y un QR para descargar el APK. En el teléfono hay que permitir instalar apps de
fuentes desconocidas. Las siguientes versiones se instalan encima sin perder datos.

Sin archivo `.env` corre en **modo local** (sin cuenta ni respaldo). Con `.env` pide entrar.

## Cuenta y respaldo (Supabase)

Cómo funciona: el teléfono es la fuente de verdad y funciona sin señal. Cada cambio queda marcado como
pendiente y se sube a la nube al entrar, al abrir la app, al mandarla al fondo y cada minuto mientras
está abierta. Si el fisio entra en otro teléfono, baja todo. Si dos teléfonos editan lo mismo, gana el
último que respalda. Al salir de la cuenta se borran los datos del teléfono (después de respaldarlos).

Configuración, una sola vez (si `schema.sql` cambia, se vuelve a correr completo; no borra datos):

1. **Proyecto**: crea un proyecto en supabase.com. No hay región en México; la más cercana es
   *East US*. Que los datos estén fuera de México debe decirlo el aviso de privacidad.
2. **Tablas**: en *SQL Editor* pega y corre `supabase/schema.sql` completo. Se puede volver a correr.
3. **Llaves**: copia `.env.example` como `.env` y llena *Project URL* y la *publishable key*
   (Project Settings → API Keys). Nunca pongas la llave secreta en la app.
4. **Regreso a la app**: en *Authentication → URL Configuration → Redirect URLs* agrega
   `fisioapp://**` (app instalada) y `exp://**` (para probar en Expo Go).
5. **Google**: en Google Cloud Console crea un *OAuth client ID* de tipo *Web application* con la
   redirect URI `https://TU-PROYECTO.supabase.co/auth/v1/callback`. Pega el Client ID y el secret en
   *Authentication → Sign In / Providers → Google* y actívalo.
6. **Código por correo**: en *Authentication → Emails → Magic Link* cambia la plantilla para que mande el
   código: por ejemplo `<p>Tu código para entrar es: <b>{{ .Token }}</b></p>`. El correo que trae Supabase
   de fábrica manda muy pocos mensajes por hora; para usarla con clientes configura un SMTP propio
   (*Authentication → Emails → SMTP Settings*).
7. **Cuenta para el revisor de Google Play**: en *Authentication → Users → Add user → Create new user*
   crea un correo y contraseña con *Auto Confirm User*. En la app se entra con "Tengo contraseña".
8. **Builds**: para `eas build`, da de alta las mismas dos variables en el proyecto de EAS
   (`npx eas-cli@latest env:create`), porque el `.env` no se sube.

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
- `src/sync/motor.test.ts`: dos "teléfonos" contra una nube falsa: restaurar todo en un teléfono nuevo,
  cambios y borrados en ambos sentidos, conflictos, paquetes cobrados en otro teléfono, no mezclar cuentas.

## Cómo está organizado

```
src/
  app/          pantallas (Expo Router): (tabs)/ Hoy, Pacientes, Resumen; cita/, paciente/, ajustes
  data/         base local: migraciones (db.ts) y consultas (repo.ts). Las pantallas no escriben SQL.
  domain/       reglas puras sin React Native: tipos, lógica, estructura de la historia clínica
  sync/         cuenta y respaldo: motor (sin Supabase, se prueba en Node), cliente de Supabase,
                formas de entrar y el proveedor que corre el respaldo
  ui/           tema, componentes y acciones externas (WhatsApp, mapas, compartir)
supabase/
  schema.sql    tablas en la nube con seguridad por fisio (cada quien solo ve lo suyo)
```

Reglas que conviene respetar:

- **Migraciones solo hacia adelante.** Para cambiar la base se agrega una entrada al final de
  `MIGRACIONES` en `src/data/db.ts`; nunca se edita una ya publicada.
- **Columnas editables en lista cerrada** (`CAMPOS_PACIENTE`). Nunca se arma SQL con nombres libres.
- **Fechas locales**, no UTC: `isoLocal()` y `desdeIso()` evitan que una cita de noche se corra de día.
- **El respaldo es automático**: unos triggers de SQLite marcan cada fila que cambia, así que el código
  nuevo no tiene que acordarse de nada. Una tabla nueva que se deba respaldar va en `TABLAS_SYNC`
  (`db.ts`), en `SPECS` (`sync/motor.ts`) y en `supabase/schema.sql`.
- **No borrar y volver a crear** una fila para "editarla": perdería su identidad en la nube. Actualizarla.

## Lo que sigue

Para que el fisio la use en serio:

1. **Reagendar y editar citas** (hoy solo se cancelan y se crea otra) y **borrar pacientes**
   (el paciente puede pedir que se borren sus datos).
2. **Probarla en su teléfono** con una build instalable (`eas build --profile preview`), no en Expo Go.
3. **Aviso de privacidad y consentimiento**: texto para el paciente y una marca en la ficha de que lo firmó.

Para venderla:

4. **Google Calendar** en los dos sentidos (cada cita ya guarda `calendar_event_id`).
5. **Nombre, ícono y marca**.
6. **Cobro de la suscripción**: precio, prueba gratis, y si se cobra dentro de la app (Google exige su
   sistema de pagos) o por fuera.
7. **Google Play**: cuenta de desarrollador, prueba cerrada, política de privacidad pública y la sección
   de seguridad de datos declarando datos de salud.

Versión 2: factura CFDI desde el cobro, acceso de solo lectura para el contador, gastos, y recordatorios
automáticos la tarde anterior (API de WhatsApp Business).
