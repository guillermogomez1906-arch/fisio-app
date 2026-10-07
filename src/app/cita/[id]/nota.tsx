import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { guardarSesion, obtenerCita, sesionDeCita, sesionesDePaciente, type CitaDetalle } from '@/data/repo';
import { fechaCorta } from '@/domain/logic';
import { Boton, Campo, Cargando, Opcion, Pantalla, T, Tarjeta } from '@/ui/kit';
import { E } from '@/ui/theme';

const TRABAJOS = ['Terapia manual', 'Ejercicio terapéutico', 'Electroterapia', 'Vendaje', 'Estiramientos', 'Punción seca', 'Termoterapia'];

export default function NotaSesion() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const citaId = Number(id);

  const [cita, setCita] = useState<CitaDetalle | null>(null);
  const [anterior, setAnterior] = useState<{ fecha: string; dolor: number } | null>(null);
  const [dolor, setDolor] = useState(5);
  const [trabajos, setTrabajos] = useState<string[]>([]);
  const [notas, setNotas] = useState('');

  useEffect(() => {
    (async () => {
      const c = await obtenerCita(db, citaId);
      setCita(c);
      if (!c) return;
      const existente = await sesionDeCita(db, citaId);
      const previas = (await sesionesDePaciente(db, c.paciente_id)).filter((s) => s.cita_id !== citaId);
      const ultima = previas[previas.length - 1];
      if (ultima) setAnterior({ fecha: ultima.fecha, dolor: ultima.dolor });
      if (existente) {
        setDolor(existente.dolor);
        setTrabajos(existente.trabajo ? existente.trabajo.split(', ') : []);
        setNotas(existente.notas);
      } else if (ultima) {
        setDolor(ultima.dolor);
      }
    })();
  }, [db, citaId]);

  if (!cita) return <Cargando />;

  const alternar = (t: string) => setTrabajos((xs) => (xs.includes(t) ? xs.filter((x) => x !== t) : [...xs, t]));

  const guardar = async () => {
    await guardarSesion(db, { cita_id: cita.id, paciente_id: cita.paciente_id, fecha: cita.fecha, dolor, trabajo: trabajos.join(', '), notas: notas.trim() });
    router.back();
  };

  return (
    <Pantalla abajo={<Boton texto="Guardar sesión" onPress={guardar} />}>
      <T v="tenue">{cita.paciente_nombre}</T>
      <Tarjeta style={{ gap: E.m }}>
        <T v="seccion">Dolor hoy, del 1 al 10</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: E.s }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <Opcion key={n} texto={String(n)} activo={dolor === n} onPress={() => setDolor(n)} style={{ width: '18%', minHeight: 48 }} />
          ))}
        </View>
        <T v="chico">{anterior ? `Sesión anterior (${fechaCorta(anterior.fecha)}): dolor ${anterior.dolor}` : 'Primera sesión de este paciente'}</T>
      </Tarjeta>

      <Tarjeta style={{ gap: E.m }}>
        <T v="seccion">Qué se trabajó</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: E.s }}>
          {TRABAJOS.map((t) => <Opcion key={t} texto={t} activo={trabajos.includes(t)} onPress={() => alternar(t)} />)}
        </View>
      </Tarjeta>

      <Tarjeta>
        <Campo etiqueta="Notas" multilinea value={notas} onChangeText={setNotas} placeholder="Escribe o dicta con el micrófono del teclado" />
      </Tarjeta>
    </Pantalla>
  );
}
