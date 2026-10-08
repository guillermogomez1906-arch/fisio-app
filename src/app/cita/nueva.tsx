import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { crearCita, crearPaciente, listarPacientes, obtenerAjustes, obtenerPaciente, type PacienteListado } from '@/data/repo';
import { fechaLarga, horaValida, isoLocal, sumarDias } from '@/domain/logic';
import type { Lugar } from '@/domain/types';
import { avisar } from '@/ui/acciones';
import { Calendario } from '@/ui/calendario';
import { Boton, Campo, Opcion, Pantalla, T, Tarjeta } from '@/ui/kit';
import { C, E } from '@/ui/theme';

export default function NuevaCita() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ fecha?: string; pacienteId?: string }>();
  const hoy = isoLocal();

  const [busqueda, setBusqueda] = useState('');
  const [pacientes, setPacientes] = useState<PacienteListado[]>([]);
  const [pacienteId, setPacienteId] = useState<number | null>(params.pacienteId ? Number(params.pacienteId) : null);
  const [nuevo, setNuevo] = useState(false);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');

  const [fecha, setFecha] = useState(params.fecha ?? hoy);
  const [verCalendario, setVerCalendario] = useState(false);
  const [hora, setHora] = useState('');
  const [lugar, setLugar] = useState<Lugar>('consultorio');
  const [direccion, setDireccion] = useState('');
  const [duracion, setDuracion] = useState(60);

  useEffect(() => { obtenerAjustes(db).then((a) => setDuracion(a.duracion_min)); }, [db]);
  useEffect(() => { listarPacientes(db, busqueda).then(setPacientes); }, [db, busqueda]);

  // Al elegir paciente, toma su lugar y dirección habituales.
  useEffect(() => {
    if (pacienteId == null) return;
    obtenerPaciente(db, pacienteId).then((p) => {
      if (!p) return;
      setLugar(p.lugar);
      setDireccion(p.direccion);
    });
  }, [db, pacienteId]);

  const elegido = pacientes.find((p) => p.id === pacienteId);
  const dias = [
    { iso: hoy, texto: 'Hoy' },
    { iso: sumarDias(hoy, 1), texto: 'Mañana' },
    { iso: sumarDias(hoy, 2), texto: fechaLarga(sumarDias(hoy, 2)).split(' ').slice(0, 2).join(' ') },
  ];

  const guardar = async () => {
    if (!nuevo && pacienteId == null) return avisar('Elige un paciente', 'O da de alta uno nuevo.');
    if (nuevo && !nombre.trim()) return avisar('Falta el nombre del paciente');
    if (!horaValida(hora)) return avisar('Revisa la hora', 'Escríbela en formato de 24 horas, por ejemplo 09:30 o 17:00.');
    if (lugar === 'domicilio' && !direccion.trim()) return avisar('Falta la dirección del domicilio');

    let pid = pacienteId;
    if (nuevo) {
      pid = await crearPaciente(db, { nombre: nombre.trim(), telefono: telefono.trim(), lugar, direccion: direccion.trim(), motivo: 'Primera consulta' });
    }
    const id = await crearCita(db, { paciente_id: pid!, fecha, hora, duracion_min: duracion, lugar, direccion: lugar === 'domicilio' ? direccion.trim() : '' });
    router.replace(`/cita/${id}`);
  };

  return (
    <Pantalla abajo={<Boton texto="Agendar cita" onPress={guardar} />}>
      <Tarjeta style={{ gap: E.m }}>
        <T v="seccion">Paciente</T>
        {!nuevo ? (
          <>
            {elegido && busqueda === '' ? null : (
              <Campo etiqueta="Buscar" value={busqueda} onChangeText={setBusqueda} placeholder="Nombre o teléfono" />
            )}
            <View style={{ gap: 6 }}>
              {(pacienteId != null && elegido && busqueda === '' ? [elegido] : pacientes.slice(0, 6)).map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => { setPacienteId(p.id); setBusqueda(''); }}
                  style={{
                    minHeight: 48, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14,
                    borderWidth: pacienteId === p.id ? 2 : 1, borderColor: pacienteId === p.id ? C.acento : C.linea,
                    backgroundColor: pacienteId === p.id ? C.acentoSuave : C.tarjeta,
                  }}>
                  <T v="fuerte">{p.nombre}</T>
                  {p.motivo ? <T v="chico">{p.motivo}</T> : null}
                </Pressable>
              ))}
              {pacienteId != null && busqueda === '' ? (
                <Boton v="fantasma" texto="Cambiar paciente" onPress={() => setPacienteId(null)} style={{ minHeight: 40 }} />
              ) : null}
            </View>
            <Boton v="secundario" icono="user-plus" texto="Paciente nuevo" onPress={() => { setNuevo(true); setPacienteId(null); }} />
          </>
        ) : (
          <>
            <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} placeholder="Nombre y apellido" autoFocus />
            <Campo etiqueta="Teléfono (WhatsApp)" value={telefono} onChangeText={setTelefono} placeholder="10 dígitos" keyboardType="phone-pad" ayuda="El resto de la historia clínica se llena en su ficha." />
            <Boton v="fantasma" texto="Elegir un paciente existente" onPress={() => setNuevo(false)} style={{ minHeight: 40 }} />
          </>
        )}
      </Tarjeta>

      <Tarjeta style={{ gap: E.m }}>
        <T v="seccion">Día y hora</T>
        <View style={{ flexDirection: 'row', gap: E.s }}>
          {dias.map((d) => (
            <Opcion key={d.iso} texto={d.texto} activo={fecha === d.iso} onPress={() => setFecha(d.iso)} style={{ flex: 1 }} />
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Elegir fecha en el calendario" onPress={() => setVerCalendario(true)}
          style={{ minHeight: 48, borderWidth: 1, borderColor: C.linea, borderRadius: 10, paddingHorizontal: 12, backgroundColor: C.campo, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T style={{ textTransform: 'capitalize' }}>{fechaLarga(fecha)}</T>
          <Feather name="calendar" size={18} color={C.acento} />
        </Pressable>
        <Calendario visible={verCalendario} fecha={fecha} titulo="Fecha de la cita" onElegir={setFecha} onCerrar={() => setVerCalendario(false)} />
        <Campo etiqueta="Hora" value={hora} onChangeText={setHora} placeholder="Ej. 17:00" keyboardType="numbers-and-punctuation" maxLength={5} />
      </Tarjeta>

      <Tarjeta style={{ gap: E.m }}>
        <T v="seccion">Dónde</T>
        <View style={{ flexDirection: 'row', gap: E.s }}>
          <Opcion texto="Consultorio" activo={lugar === 'consultorio'} onPress={() => setLugar('consultorio')} style={{ flex: 1 }} />
          <Opcion texto="Domicilio" activo={lugar === 'domicilio'} onPress={() => setLugar('domicilio')} style={{ flex: 1 }} />
        </View>
        {lugar === 'domicilio' ? (
          <Campo etiqueta="Dirección" value={direccion} onChangeText={setDireccion} placeholder="Calle, número, colonia y municipio" />
        ) : null}
      </Tarjeta>
    </Pantalla>
  );
}
