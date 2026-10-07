import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  cargarEjemplo, citasDelDia, cobradoEnFecha, hayPacientes, marcarRecordatorio, type CitaDetalle,
} from '@/data/repo';
import { citasSinMargen, dinero, fechaLarga, isoLocal, mensajeRecordatorio, sumarDias } from '@/domain/logic';
import { abrirWhatsapp } from '@/ui/acciones';
import { Etiquetas } from '@/ui/etiquetas';
import { Aviso, Boton, Cargando, Pantalla, T, Tarjeta, Titulo, Vacio, useAlEnfocar } from '@/ui/kit';
import { C, E } from '@/ui/theme';

export default function Hoy() {
  const db = useSQLiteContext();
  const hoy = isoLocal();
  const [fecha, setFecha] = useState(hoy);
  const manana = sumarDias(fecha, 1);

  const { datos, recargar } = useAlEnfocar(async () => {
    const [citas, citasManana, cobrado, conPacientes] = await Promise.all([
      citasDelDia(db, fecha), citasDelDia(db, manana), cobradoEnFecha(db, fecha), hayPacientes(db),
    ]);
    return { citas, citasManana: citasManana.filter((c) => c.estado !== 'cancelada'), cobrado, conPacientes };
  }, [fecha]);

  if (!datos) return <Cargando />;
  const { citas, citasManana, cobrado, conPacientes } = datos;
  const sinMargen = citasSinMargen(citas);
  const activas = citas.filter((c) => c.estado !== 'cancelada');
  const atendidas = citas.filter((c) => c.estado === 'atendida').length;
  const pendientesRec = citasManana.filter((c) => !c.recordatorio_enviado);

  const enviarRecordatorio = async (c: CitaDetalle) => {
    const ok = await abrirWhatsapp(c.paciente_telefono, mensajeRecordatorio({ nombre: c.paciente_nombre }, c));
    if (ok) { await marcarRecordatorio(db, [c.id]); recargar(); }
  };

  const etiquetaDia = fecha === hoy ? 'Hoy' : fecha === sumarDias(hoy, 1) ? 'Mañana' : fecha === sumarDias(hoy, -1) ? 'Ayer' : '';

  return (
    <Pantalla>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityLabel="Día anterior" onPress={() => setFecha(sumarDias(fecha, -1))} style={{ padding: 10 }}>
          <Feather name="chevron-left" size={22} color={C.tinta} />
        </Pressable>
        <Pressable onPress={() => setFecha(hoy)} style={{ alignItems: 'center', flex: 1 }}>
          <T v="grande" style={{ textTransform: 'capitalize' }}>{fechaLarga(fecha)}</T>
          {etiquetaDia ? <T v="chico">{etiquetaDia}</T> : <T v="chico" style={{ color: C.acento }}>Volver a hoy</T>}
        </Pressable>
        <Pressable accessibilityLabel="Día siguiente" onPress={() => setFecha(sumarDias(fecha, 1))} style={{ padding: 10 }}>
          <Feather name="chevron-right" size={22} color={C.tinta} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: E.s }}>
        <Dato valor={String(activas.length)} texto="citas" />
        <Dato valor={String(atendidas)} texto="atendidas" />
        <Dato valor={dinero(cobrado)} texto="cobrado" />
      </View>

      <Titulo>Agenda</Titulo>
      {citas.length === 0 ? (
        <Vacio texto={conPacientes ? 'No hay citas este día.' : 'Todavía no tienes pacientes. Agenda tu primera cita o carga datos de ejemplo para conocer la app.'} accion={
          !conPacientes ? <Boton v="secundario" texto="Cargar datos de ejemplo" onPress={async () => { await cargarEjemplo(db, hoy); recargar(); }} /> : undefined
        } />
      ) : (
        citas.map((c) => (
          <Pressable key={c.id} onPress={() => router.push(`/cita/${c.id}`)} accessibilityRole="button">
            <Tarjeta style={{ flexDirection: 'row', gap: 14, opacity: c.estado === 'cancelada' ? 0.55 : 1 }}>
              <T v="grande" style={{ width: 50 }}>{c.hora}</T>
              <View style={{ flex: 1, gap: 6 }}>
                <T v="grande">{c.paciente_nombre}</T>
                {c.paciente_motivo ? <T v="chico">{c.paciente_motivo}</T> : null}
                <Etiquetas lugar={c.lugar} estado={c.estado} pagado={!!c.pagado} />
                {sinMargen.has(c.id) ? <Aviso texto="Poco margen de traslado desde la cita anterior." /> : null}
              </View>
            </Tarjeta>
          </Pressable>
        ))
      )}
      <Boton v="secundario" icono="plus" texto="Nueva cita" onPress={() => router.push({ pathname: '/cita/nueva', params: { fecha } })} />

      <Tarjeta style={{ marginTop: E.s, gap: E.m }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name="bell" size={18} color={C.acento} />
            <T v="seccion">Recordatorios para {fecha === hoy ? 'mañana' : 'el día siguiente'}</T>
          </View>
          <T v="chico">{citasManana.length === 0 ? '' : pendientesRec.length ? `${pendientesRec.length} por enviar` : 'Todos enviados'}</T>
        </View>
        {citasManana.length === 0 ? <T v="tenue">No hay citas.</T> : citasManana.map((c) => (
          <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: E.m }}>
            <T v="fuerte" style={{ width: 46 }}>{c.hora}</T>
            <View style={{ flex: 1 }}>
              <T v="fuerte">{c.paciente_nombre}</T>
              <T v="chico" numberOfLines={1}>{c.lugar === 'domicilio' ? `Domicilio · ${c.direccion}` : 'Consultorio'}</T>
            </View>
            <Boton
              v={c.recordatorio_enviado ? 'fantasma' : 'whatsapp'}
              texto={c.recordatorio_enviado ? 'Enviado' : 'Enviar'}
              icono={c.recordatorio_enviado ? 'check' : undefined}
              onPress={() => enviarRecordatorio(c)}
              style={{ minHeight: 42, paddingHorizontal: 14 }}
            />
          </View>
        ))}
        {pendientesRec.length > 1 ? (
          <T v="chico">WhatsApp se abre una vez por paciente; al volver a la app sigue el siguiente.</T>
        ) : null}
      </Tarjeta>
    </Pantalla>
  );
}

function Dato({ valor, texto }: { valor: string; texto: string }) {
  return (
    <Tarjeta style={{ flex: 1, padding: E.m, gap: 0 }}>
      <T v="numero" numberOfLines={1}>{valor}</T>
      <T v="chico">{texto}</T>
    </Tarjeta>
  );
}
