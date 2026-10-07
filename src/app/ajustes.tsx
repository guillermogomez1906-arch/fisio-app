import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { guardarAjustes, obtenerAjustes } from '@/data/repo';
import { Boton, Campo, Cargando, Pantalla, T, Tarjeta } from '@/ui/kit';
import { E } from '@/ui/theme';

export default function Ajustes() {
  const db = useSQLiteContext();
  const [listo, setListo] = useState(false);
  const [nombre, setNombre] = useState('');
  const [consultorio, setConsultorio] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [duracion, setDuracion] = useState('60');

  useEffect(() => {
    obtenerAjustes(db).then((a) => {
      setNombre(a.nombre_fisio);
      setConsultorio(a.tarifa_consultorio ? String(a.tarifa_consultorio) : '');
      setDomicilio(a.tarifa_domicilio ? String(a.tarifa_domicilio) : '');
      setDuracion(String(a.duracion_min));
      setListo(true);
    });
  }, [db]);

  if (!listo) return <Cargando />;

  const num = (s: string) => Number(s.replace(/[^\d.]/g, '')) || 0;
  const guardar = async () => {
    await guardarAjustes(db, {
      nombre_fisio: nombre.trim(),
      tarifa_consultorio: num(consultorio),
      tarifa_domicilio: num(domicilio),
      duracion_min: Math.max(15, Math.round(num(duracion)) || 60),
    });
    router.back();
  };

  return (
    <Pantalla abajo={<Boton texto="Guardar" onPress={guardar} />}>
      <Tarjeta style={{ gap: E.m }}>
        <Campo etiqueta="Tu nombre" value={nombre} onChangeText={setNombre} placeholder="Como lo verán tus pacientes" />
      </Tarjeta>
      <Tarjeta style={{ gap: E.m }}>
        <T v="seccion">Tarifas</T>
        <Campo etiqueta="Sesión en consultorio" value={consultorio} onChangeText={setConsultorio} keyboardType="decimal-pad" placeholder="$0" />
        <Campo etiqueta="Sesión a domicilio" value={domicilio} onChangeText={setDomicilio} keyboardType="decimal-pad" placeholder="$0" />
        <Campo etiqueta="Duración de cada sesión (minutos)" value={duracion} onChangeText={setDuracion} keyboardType="number-pad"
          ayuda="Se usa para avisarte si no te da tiempo de llegar a un domicilio." />
      </Tarjeta>
    </Pantalla>
  );
}
