import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { obtenerAjustes, obtenerPaciente, venderPaquete } from '@/data/repo';
import { dinero, isoLocal } from '@/domain/logic';
import type { Lugar, MetodoPago, Paciente } from '@/domain/types';
import { avisar } from '@/ui/acciones';
import { Boton, Campo, Cargando, FilaInterruptor, Opcion, Pantalla, T, Tarjeta } from '@/ui/kit';
import { E } from '@/ui/theme';

type Metodo = Exclude<MetodoPago, 'paquete'>;
const TAMANOS = [5, 10, 15];

export default function VenderPaquete() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pid = Number(id);

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [tarifa, setTarifa] = useState(0);
  const [sesiones, setSesiones] = useState('10');
  const [precio, setPrecio] = useState('');
  const [metodo, setMetodo] = useState<Metodo>('efectivo');
  const [factura, setFactura] = useState(false);

  useEffect(() => {
    Promise.all([obtenerPaciente(db, pid), obtenerAjustes(db)]).then(([p, a]) => {
      setPaciente(p);
      if (p) setTarifa(p.lugar === 'domicilio' ? a.tarifa_domicilio : a.tarifa_consultorio);
    });
  }, [db, pid]);

  if (!paciente) return <Cargando />;
  const n = Math.max(0, Math.floor(Number(sesiones) || 0));
  const total = Number(precio.replace(/[^\d.]/g, '')) || 0;

  const guardar = async () => {
    if (n <= 0) return avisar('¿De cuántas sesiones es el paquete?');
    if (total <= 0) return avisar('Escribe el precio del paquete');
    await venderPaquete(db, { paciente_id: pid, sesiones: n, precio: total, fecha: isoLocal(), metodo, lugar: paciente.lugar as Lugar, factura });
    router.back();
  };

  return (
    <Pantalla abajo={<Boton texto={`Registrar paquete de ${dinero(total)}`} onPress={guardar} />}>
      <T v="tenue">{paciente.nombre}</T>
      <Tarjeta style={{ gap: E.m }}>
        <T v="seccion">Sesiones</T>
        <View style={{ flexDirection: 'row', gap: E.s }}>
          {TAMANOS.map((t) => <Opcion key={t} texto={String(t)} activo={n === t} onPress={() => setSesiones(String(t))} style={{ flex: 1 }} />)}
        </View>
        <Campo etiqueta="Otro número" value={sesiones} onChangeText={setSesiones} keyboardType="number-pad" />
        <Campo etiqueta="Precio total" value={precio} onChangeText={setPrecio} keyboardType="decimal-pad" placeholder="$0"
          ayuda={tarifa && n ? `Sesión suelta: ${dinero(tarifa)} · ${n} sueltas serían ${dinero(tarifa * n)}` : undefined} />
      </Tarjeta>
      <Tarjeta style={{ gap: E.m }}>
        <T v="seccion">Cómo pagó</T>
        <View style={{ flexDirection: 'row', gap: E.s }}>
          {([['efectivo', 'Efectivo'], ['transferencia', 'Transferencia'], ['tarjeta', 'Tarjeta']] as [Metodo, string][]).map(([m, txt]) => (
            <Opcion key={m} texto={txt} activo={metodo === m} onPress={() => setMetodo(m)} style={{ flex: 1 }} />
          ))}
        </View>
      </Tarjeta>
      <FilaInterruptor titulo="Pidió factura" activo={factura} onPress={() => setFactura(!factura)} />
    </Pantalla>
  );
}
