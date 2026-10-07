// Etiquetas de colores para estado de cita y lugar, iguales en todas las pantallas.

import { View } from 'react-native';

import { ETIQUETA_ESTADO, ETIQUETA_LUGAR } from '@/domain/logic';
import type { EstadoCita, Lugar } from '@/domain/types';

import { Pill } from './kit';
import { C } from './theme';

const COLOR_ESTADO: Record<EstadoCita, [string, string]> = {
  agendada: [C.avisoSuave, C.aviso],
  confirmada: [C.acentoSuave, C.acentoOscuro],
  atendida: [C.tinta, C.blanco],
  cancelada: [C.barra, C.tenue],
  no_llego: [C.errorSuave, C.error],
};

export function PillLugar({ lugar }: { lugar: Lugar }) {
  return lugar === 'domicilio'
    ? <Pill texto={ETIQUETA_LUGAR.domicilio} fondo={C.domicilioSuave} color={C.domicilio} />
    : <Pill texto={ETIQUETA_LUGAR.consultorio} fondo={C.consultorioSuave} color={C.consultorio} />;
}

export function PillEstado({ estado }: { estado: EstadoCita }) {
  const [fondo, color] = COLOR_ESTADO[estado];
  return <Pill texto={ETIQUETA_ESTADO[estado]} fondo={fondo} color={color} />;
}

export function Etiquetas({ lugar, estado, pagado }: { lugar: Lugar; estado: EstadoCita; pagado?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      <PillLugar lugar={lugar} />
      <PillEstado estado={estado} />
      {pagado ? <Pill texto="Pagado" fondo={C.acentoSuave} color={C.acentoOscuro} /> : null}
    </View>
  );
}
