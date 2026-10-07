import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { View } from 'react-native';

import { cambiarEstadoCita, obtenerCita, paquetesDePaciente, sesionDeCita } from '@/data/repo';
import { fechaLarga, isoLocal, mensajeConfirmacion, paqueteVigente, restantes } from '@/domain/logic';
import { abrirMapa, abrirWhatsapp, confirmar } from '@/ui/acciones';
import { Etiquetas } from '@/ui/etiquetas';
import { Boton, Cargando, Pantalla, T, Tarjeta, Vacio, useAlEnfocar } from '@/ui/kit';
import { C } from '@/ui/theme';

export default function DetalleCita() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const citaId = Number(id);

  const { datos, recargar } = useAlEnfocar(async () => {
    const cita = await obtenerCita(db, citaId);
    if (!cita) return { cita: null, sesion: null, paquete: null };
    const [sesion, paquetes] = await Promise.all([sesionDeCita(db, citaId), paquetesDePaciente(db, cita.paciente_id)]);
    return { cita, sesion, paquete: paqueteVigente(paquetes) };
  }, [citaId]);

  if (!datos) return <Cargando />;
  const { cita, sesion, paquete } = datos;
  if (!cita) return <Pantalla><Vacio texto="Esta cita ya no existe." /></Pantalla>;

  const cerrada = cita.estado === 'cancelada' || cita.estado === 'no_llego';

  const confirmarWhatsapp = async () => {
    const ok = await abrirWhatsapp(cita.paciente_telefono, mensajeConfirmacion({ nombre: cita.paciente_nombre }, cita, isoLocal()));
    if (ok && cita.estado === 'agendada') { await cambiarEstadoCita(db, cita.id, 'confirmada'); recargar(); }
  };

  return (
    <Pantalla>
      <Stack.Screen options={{ title: cita.paciente_nombre }} />
      <T v="tenue" style={{ textTransform: 'capitalize' }}>{fechaLarga(cita.fecha)} · {cita.hora}</T>

      <Tarjeta style={{ gap: 10 }}>
        <Etiquetas lugar={cita.lugar} estado={cita.estado} pagado={!!cita.pagado} />
        <Fila etiqueta="Motivo" valor={cita.paciente_motivo || 'Sin capturar'} />
        <Fila etiqueta="Paquete" valor={paquete ? `Le quedan ${restantes(paquete)} de ${paquete.sesiones} sesiones` : 'Sin paquete'} />
        {cita.lugar === 'domicilio' ? (
          <View style={{ gap: 6 }}>
            <Fila etiqueta="Dirección" valor={cita.direccion} />
            <Boton v="secundario" icono="map-pin" texto="Abrir mapa" onPress={() => abrirMapa(cita.direccion)} style={{ minHeight: 44 }} />
          </View>
        ) : null}
        {sesion ? <Fila etiqueta="Sesión" valor={`Dolor ${sesion.dolor}/10${sesion.trabajo ? ` · ${sesion.trabajo}` : ''}`} /> : null}
        <Boton v="fantasma" texto="Ver ficha completa" onPress={() => router.push(`/paciente/${cita.paciente_id}`)} style={{ minHeight: 40, alignSelf: 'flex-start', paddingHorizontal: 0 }} />
      </Tarjeta>

      {!cerrada ? (
        <>
          <Boton v="whatsapp" icono="message-circle" texto={cita.estado === 'agendada' ? 'Confirmar por WhatsApp' : 'Escribir por WhatsApp'} onPress={confirmarWhatsapp} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Boton v="secundario" texto={sesion ? 'Editar sesión' : 'Anotar sesión'} icono={sesion ? 'check' : 'edit-3'} onPress={() => router.push(`/cita/${cita.id}/nota`)} style={{ flex: 1 }} />
            <Boton texto={cita.pagado ? 'Cobrado' : 'Cobrar'} icono={cita.pagado ? 'check' : 'dollar-sign'} deshabilitado={!!cita.pagado} onPress={() => router.push(`/cita/${cita.id}/cobro`)} style={{ flex: 1 }} />
          </View>
          {cita.estado !== 'atendida' ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Boton v="fantasma" texto="No llegó" onPress={async () => { await cambiarEstadoCita(db, cita.id, 'no_llego'); recargar(); }} style={{ flex: 1 }} />
              <Boton v="peligro" texto="Cancelar cita" onPress={() => confirmar('¿Cancelar la cita?', `${cita.paciente_nombre}, ${fechaLarga(cita.fecha)} a las ${cita.hora}.`, 'Cancelar cita', async () => { await cambiarEstadoCita(db, cita.id, 'cancelada'); recargar(); })} style={{ flex: 1 }} />
            </View>
          ) : null}
        </>
      ) : (
        <Boton v="secundario" texto="Reactivar cita" onPress={async () => { await cambiarEstadoCita(db, cita.id, 'agendada'); recargar(); }} />
      )}
    </Pantalla>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={{ gap: 2 }}>
      <T v="chico">{etiqueta}</T>
      <T v="grande" style={{ color: valor === 'Sin capturar' ? C.apagado : C.tinta }}>{valor}</T>
    </View>
  );
}
