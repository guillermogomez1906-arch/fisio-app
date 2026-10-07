import Feather from '@expo/vector-icons/Feather';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { cobrosDelMes, pacientesParaCsv } from '@/data/repo';
import { csvContador, dinero, isoLocal, mesLargo, resumenMes } from '@/domain/logic';
import { avisar, compartirCsv } from '@/ui/acciones';
import { Barra, Boton, Cargando, Pantalla, T, Tarjeta, Titulo, useAlEnfocar } from '@/ui/kit';
import { C, E } from '@/ui/theme';

function moverMes(mes: string, delta: number): string {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Resumen() {
  const db = useSQLiteContext();
  const mesActual = isoLocal().slice(0, 7);
  const [mes, setMes] = useState(mesActual);
  const { datos } = useAlEnfocar(() => cobrosDelMes(db, mes), [mes]);

  if (!datos) return <Cargando />;
  const r = resumenMes(datos, mes);

  const exportar = async () => {
    if (r.movimientos === 0) return avisar('No hay movimientos en este mes');
    const csv = csvContador(datos, await pacientesParaCsv(db), mes);
    await compartirCsv(`resumen-${mes}.csv`, csv);
  };

  const metodos: [string, number][] = [['Efectivo', r.porMetodo.efectivo], ['Transferencia', r.porMetodo.transferencia], ['Tarjeta', r.porMetodo.tarjeta]];

  return (
    <Pantalla>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityLabel="Mes anterior" onPress={() => setMes(moverMes(mes, -1))} style={{ padding: 10 }}>
          <Feather name="chevron-left" size={22} color={C.tinta} />
        </Pressable>
        <T v="grande" style={{ textTransform: 'capitalize' }}>{mesLargo(mes)}</T>
        <Pressable accessibilityLabel="Mes siguiente" disabled={mes >= mesActual} onPress={() => setMes(moverMes(mes, 1))} style={{ padding: 10, opacity: mes >= mesActual ? 0.3 : 1 }}>
          <Feather name="chevron-right" size={22} color={C.tinta} />
        </Pressable>
      </View>

      <View style={{ backgroundColor: C.acento, borderRadius: 18, padding: 18, gap: 4 }}>
        <T v="chico" style={{ color: C.blanco, opacity: 0.85 }}>Ingresos del mes</T>
        <T style={{ color: C.blanco, fontSize: 34, fontWeight: '700' }}>{dinero(r.total)}</T>
        <T v="chico" style={{ color: C.blanco, opacity: 0.85 }}>{r.movimientos} movimientos · {r.sesionesPaquete} sesiones de paquete</T>
      </View>

      <Tarjeta style={{ gap: E.m }}>
        <T v="seccion">Por forma de pago</T>
        {metodos.map(([nombre, monto]) => (
          <View key={nombre} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T>{nombre}</T>
              <T v="fuerte">{dinero(monto)}</T>
            </View>
            <Barra fraccion={r.total ? monto / r.total : 0} alto={8} />
          </View>
        ))}
      </Tarjeta>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Tarjeta style={{ flex: 1, gap: 2 }}>
          <T v="chico">Consultorio</T>
          <T v="numero" style={{ fontSize: 18 }}>{dinero(r.porLugar.consultorio)}</T>
        </Tarjeta>
        <Tarjeta style={{ flex: 1, gap: 2 }}>
          <T v="chico">Domicilio</T>
          <T v="numero" style={{ fontSize: 18 }}>{dinero(r.porLugar.domicilio)}</T>
        </Tarjeta>
      </View>

      <Tarjeta style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ gap: 2 }}>
          <T v="fuerte">Pidieron factura</T>
          <T v="chico">{dinero(r.montoFacturar)} por facturar</T>
        </View>
        <T v="numero" style={{ fontSize: 18 }}>{r.facturas}</T>
      </Tarjeta>

      <Titulo>Para tu contador</Titulo>
      <Boton icono="share" texto="Exportar para mi contador" onPress={exportar} />
      <T v="chico">Se genera una hoja (CSV) con cada cobro del mes: fecha, paciente, forma de pago, monto, y RFC de quien pidió factura. Se abre en Excel y la puedes mandar por WhatsApp o correo.</T>
    </Pantalla>
  );
}
