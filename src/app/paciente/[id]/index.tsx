import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, View } from 'react-native';

import { citasDePaciente, cobrosDePaciente, obtenerPaciente, paquetesDePaciente, sesionesDePaciente } from '@/data/repo';
import { SECCIONES, type SeccionHistoria } from '@/domain/historia';
import {
  dinero, edad, ETIQUETA_METODO, fechaCorta, fechaLarga, formatoFechaMx, historiaIncompleta, isoLocal, paqueteVigente, restantes,
} from '@/domain/logic';
import { abrirWhatsapp } from '@/ui/acciones';
import { PillEstado } from '@/ui/etiquetas';
import { Aviso, Barra, Boton, Cargando, Pantalla, T, Tarjeta, Titulo, Vacio, useAlEnfocar } from '@/ui/kit';
import { C, colorDolor, E } from '@/ui/theme';

export default function Ficha() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pid = Number(id);

  const { datos } = useAlEnfocar(async () => {
    const [paciente, sesiones, paquetes, cobros, citas] = await Promise.all([
      obtenerPaciente(db, pid), sesionesDePaciente(db, pid), paquetesDePaciente(db, pid), cobrosDePaciente(db, pid), citasDePaciente(db, pid),
    ]);
    return { paciente, sesiones, paquetes, cobros, citas };
  }, [pid]);

  if (!datos) return <Cargando />;
  const { paciente: p, sesiones, paquetes, cobros, citas } = datos;
  if (!p) return <Pantalla><Vacio texto="Este paciente ya no existe." /></Pantalla>;

  const hoy = isoLocal();
  const anios = edad(p.nacimiento);
  const vigente = paqueteVigente(paquetes);
  const proximas = citas.filter((c) => c.fecha >= hoy && c.estado !== 'cancelada' && c.estado !== 'atendida').reverse();

  const valor = (campo: keyof typeof p) => {
    const v = String(p[campo] ?? '').trim();
    if (campo === 'nacimiento' && v) return `${formatoFechaMx(v)}${anios != null ? ` (${anios} años)` : ''}`;
    return v;
  };

  return (
    <Pantalla>
      <Stack.Screen options={{ title: p.nombre }} />
      {historiaIncompleta(p) ? <Aviso texto="Historia clínica incompleta: faltan teléfono, fecha de nacimiento o diagnóstico." /> : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Boton icono="calendar" texto="Agendar" onPress={() => router.push({ pathname: '/cita/nueva', params: { pacienteId: String(p.id) } })} style={{ flex: 1 }} />
        <Boton v="whatsapp" icono="message-circle" texto="WhatsApp" onPress={() => abrirWhatsapp(p.telefono, `Hola ${p.nombre.split(' ')[0]}, `)} style={{ flex: 1 }} />
      </View>

      {proximas.length ? (
        <Tarjeta>
          <T v="seccion">Próximas citas</T>
          {proximas.map((c) => (
            <Pressable key={c.id} onPress={() => router.push(`/cita/${c.id}`)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
              <T style={{ textTransform: 'capitalize' }}>{fechaLarga(c.fecha)} · {c.hora}</T>
              <PillEstado estado={c.estado} />
            </Pressable>
          ))}
        </Tarjeta>
      ) : null}

      {(Object.keys(SECCIONES) as SeccionHistoria[]).map((sec) => (
        <Tarjeta key={sec} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T v="seccion">{SECCIONES[sec].titulo}</T>
            <Boton v="secundario" texto="Editar" onPress={() => router.push({ pathname: '/paciente/[id]/historia', params: { id: String(p.id), seccion: sec } })} style={{ minHeight: 36, paddingHorizontal: 12, borderColor: C.linea }} />
          </View>
          {SECCIONES[sec].campos.filter((c) => c.campo !== 'nombre').map((c) => {
            const v = valor(c.campo);
            return (
              <View key={c.campo} style={{ gap: 2 }}>
                <T v="chico">{c.etiqueta}</T>
                <T style={v ? undefined : { color: C.apagado, fontStyle: 'italic', fontSize: 14 }}>{v || 'Sin capturar'}</T>
              </View>
            );
          })}
        </Tarjeta>
      ))}

      <Tarjeta style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T v="seccion">Paquete</T>
          <Boton v="secundario" texto="Vender paquete" onPress={() => router.push(`/paciente/${p.id}/paquete`)} style={{ minHeight: 36, paddingHorizontal: 12, borderColor: C.linea }} />
        </View>
        {vigente ? (
          <>
            <T v="fuerte" style={{ color: C.acento }}>{restantes(vigente)} de {vigente.sesiones} sesiones restantes</T>
            <Barra fraccion={restantes(vigente) / vigente.sesiones} />
          </>
        ) : <T v="tenue">Sin paquete vigente.</T>}
      </Tarjeta>

      <Titulo>Evolución del dolor</Titulo>
      <Tarjeta style={{ gap: 10 }}>
        {sesiones.length === 0 ? <T v="tenue">Todavía no hay sesiones anotadas.</T> : sesiones.map((s) => (
          <View key={s.id} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <T v="chico" style={{ width: 52 }}>{fechaCorta(s.fecha)}</T>
              <View style={{ flex: 1 }}><Barra fraccion={s.dolor / 10} color={colorDolor(s.dolor)} alto={14} /></View>
              <T v="fuerte" style={{ width: 22, textAlign: 'right' }}>{s.dolor}</T>
            </View>
            {s.trabajo || s.notas ? <T v="chico" style={{ paddingLeft: 62 }}>{[s.trabajo, s.notas].filter(Boolean).join(' · ')}</T> : null}
          </View>
        ))}
      </Tarjeta>

      <Titulo>Cobros</Titulo>
      <Tarjeta style={{ gap: 8 }}>
        {cobros.length === 0 ? <T v="tenue">Sin cobros registrados.</T> : cobros.map((k) => (
          <View key={k.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: E.s }}>
            <T v="tenue" style={{ flex: 1 }}>{fechaCorta(k.fecha)} · {k.metodo === 'paquete' ? k.concepto : ETIQUETA_METODO[k.metodo]}{k.factura ? ' · factura' : ''}</T>
            <T v="fuerte">{k.metodo === 'paquete' ? '—' : dinero(k.monto)}</T>
          </View>
        ))}
      </Tarjeta>
    </Pantalla>
  );
}
