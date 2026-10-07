import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { cobrarCita, obtenerAjustes, obtenerCita, paquetesDePaciente, type CitaDetalle } from '@/data/repo';
import { dinero, paqueteVigente, restantes } from '@/domain/logic';
import type { MetodoPago, Paquete } from '@/domain/types';
import { avisar } from '@/ui/acciones';
import { Boton, Campo, Cargando, FilaInterruptor, Opcion, Pantalla, T, Tarjeta } from '@/ui/kit';
import { E } from '@/ui/theme';

type Metodo = Exclude<MetodoPago, 'paquete'>;
const METODOS: [Metodo, string][] = [['efectivo', 'Efectivo'], ['transferencia', 'Transferencia'], ['tarjeta', 'Tarjeta']];

export default function CobrarCita() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const citaId = Number(id);

  const [cita, setCita] = useState<CitaDetalle | null>(null);
  const [paquete, setPaquete] = useState<Paquete | null>(null);
  const [usarPaquete, setUsarPaquete] = useState(false);
  const [monto, setMonto] = useState('');
  const [tarifa, setTarifa] = useState(0);
  const [metodo, setMetodo] = useState<Metodo>('efectivo');
  const [factura, setFactura] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      const c = await obtenerCita(db, citaId);
      if (!c) return;
      const [a, pqs] = await Promise.all([obtenerAjustes(db), paquetesDePaciente(db, c.paciente_id)]);
      const t = c.lugar === 'domicilio' ? a.tarifa_domicilio : a.tarifa_consultorio;
      const vigente = paqueteVigente(pqs);
      setCita(c);
      setTarifa(t);
      setMonto(t ? String(t) : '');
      setPaquete(vigente);
      setUsarPaquete(!!vigente);
    })();
  }, [db, citaId]);

  if (!cita) return <Cargando />;
  const montoNum = Number(monto.replace(/[^\d.]/g, '')) || 0;

  const guardar = async () => {
    if (!usarPaquete && montoNum <= 0) return avisar('Escribe el monto');
    setGuardando(true);
    try {
      await cobrarCita(db, cita, { usarPaquete, monto: montoNum, metodo, factura });
      router.back();
    } catch (e) {
      avisar('No se pudo registrar', (e as Error).message);
      setGuardando(false);
    }
  };

  return (
    <Pantalla abajo={
      <Boton deshabilitado={guardando} texto={usarPaquete ? 'Registrar sesión de paquete' : `Registrar cobro de ${dinero(montoNum)}`} onPress={guardar} />
    }>
      <T v="tenue">{cita.paciente_nombre}</T>
      {paquete ? (
        <FilaInterruptor
          titulo="Descontar del paquete"
          detalle={`Le quedan ${restantes(paquete)} de ${paquete.sesiones}; quedarían ${restantes(paquete) - 1}`}
          activo={usarPaquete}
          onPress={() => setUsarPaquete(!usarPaquete)}
        />
      ) : null}

      {!usarPaquete ? (
        <>
          <Tarjeta>
            <Campo etiqueta="Monto" value={monto} onChangeText={setMonto} keyboardType="decimal-pad" placeholder="$0"
              ayuda={tarifa ? `Tarifa de ${cita.lugar === 'domicilio' ? 'domicilio' : 'consultorio'}: ${dinero(tarifa)}` : 'Define tus tarifas en Ajustes para que se llenen solas'} />
          </Tarjeta>
          <Tarjeta style={{ gap: E.m }}>
            <T v="seccion">Cómo pagó</T>
            <View style={{ flexDirection: 'row', gap: E.s }}>
              {METODOS.map(([m, txt]) => <Opcion key={m} texto={txt} activo={metodo === m} onPress={() => setMetodo(m)} style={{ flex: 1 }} />)}
            </View>
          </Tarjeta>
        </>
      ) : null}

      <FilaInterruptor titulo="Pidió factura" detalle="Aparece marcado en el resumen para tu contador" activo={factura} onPress={() => setFactura(!factura)} />
    </Pantalla>
  );
}
