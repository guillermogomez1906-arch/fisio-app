// Calendario del mes en una ventana: para saltar a otro día o elegir la fecha de una cita.
// Hecho a mano (sin librería nativa) para que funcione igual en Expo Go y en la app instalada.

import Feather from '@expo/vector-icons/Feather';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { diasConCitas } from '@/data/repo';
import { isoLocal, mesLargo, moverMes, semanasDelMes } from '@/domain/logic';

import { Boton } from './kit';
import { C, E, R } from './theme';

const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

export function Calendario({ visible, fecha, onElegir, onCerrar, titulo }: {
  visible: boolean;
  /** Fecha seleccionada, YYYY-MM-DD. */
  fecha: string;
  onElegir: (iso: string) => void;
  onCerrar: () => void;
  titulo?: string;
}) {
  const db = useSQLiteContext();
  const hoy = isoLocal();
  const [mes, setMes] = useState(fecha.slice(0, 7));
  const [conCitas, setConCitas] = useState<Set<string>>(new Set());

  // Al abrir, el calendario se para en el mes de la fecha elegida.
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  if (visible && abiertoEn !== fecha) {
    setAbiertoEn(fecha);
    setMes(fecha.slice(0, 7));
  }
  if (!visible && abiertoEn !== null) setAbiertoEn(null);

  useEffect(() => {
    if (!visible) return;
    let vivo = true;
    diasConCitas(db, mes).then((s) => { if (vivo) setConCitas(s); });
    return () => { vivo = false; };
  }, [db, mes, visible]);

  const elegir = (iso: string) => { onElegir(iso); onCerrar(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable accessibilityLabel="Cerrar calendario" onPress={onCerrar}
        style={{ flex: 1, backgroundColor: 'rgba(23,32,29,0.45)', justifyContent: 'center', padding: E.xl }}>
        {/* Las pulsaciones dentro de la tarjeta no la cierran */}
        <Pressable onPress={() => {}} style={{ backgroundColor: C.tarjeta, borderRadius: R.xl, padding: E.l, gap: E.m }}>
          {titulo ? <Text style={{ fontSize: 13, color: C.tenue, fontWeight: '600' }}>{titulo}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable accessibilityLabel="Mes anterior" onPress={() => setMes(moverMes(mes, -1))} hitSlop={8} style={{ padding: 10 }}>
              <Feather name="chevron-left" size={22} color={C.tinta} />
            </Pressable>
            <Text style={{ fontSize: 17, fontWeight: '700', color: C.tinta, textTransform: 'capitalize' }}>{mesLargo(mes)}</Text>
            <Pressable accessibilityLabel="Mes siguiente" onPress={() => setMes(moverMes(mes, 1))} hitSlop={8} style={{ padding: 10 }}>
              <Feather name="chevron-right" size={22} color={C.tinta} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row' }}>
            {DIAS.map((d) => (
              <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 12, color: C.tenue, fontWeight: '600' }}>{d}</Text>
            ))}
          </View>

          {semanasDelMes(mes).map((semana, i) => (
            <View key={i} style={{ flexDirection: 'row' }}>
              {semana.map((iso, j) => {
                if (!iso) return <View key={j} style={{ flex: 1, height: 44 }} />;
                const elegido = iso === fecha;
                const esHoy = iso === hoy;
                return (
                  <Pressable key={iso} accessibilityRole="button" accessibilityLabel={iso} accessibilityState={{ selected: elegido }}
                    onPress={() => elegir(iso)} style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{
                      width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: elegido ? C.acento : 'transparent',
                      borderWidth: esHoy && !elegido ? 1.5 : 0, borderColor: C.acento,
                    }}>
                      <Text style={{ fontSize: 15, fontWeight: elegido || esHoy ? '700' : '500', color: elegido ? C.blanco : C.tinta }}>
                        {Number(iso.slice(8))}
                      </Text>
                      {conCitas.has(iso) ? (
                        <View style={{ position: 'absolute', bottom: 4, width: 5, height: 5, borderRadius: 3, backgroundColor: elegido ? C.blanco : C.acento }} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <View style={{ flexDirection: 'row', gap: E.s }}>
            <Boton v="secundario" texto="Hoy" onPress={() => elegir(hoy)} style={{ flex: 1, minHeight: 44 }} />
            <Boton v="fantasma" texto="Cerrar" onPress={onCerrar} style={{ flex: 1, minHeight: 44 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
