import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { actualizarPaciente, obtenerPaciente, type CampoPaciente } from '@/data/repo';
import { SECCIONES, type SeccionHistoria } from '@/domain/historia';
import { formatoFechaMx, parseFechaMx } from '@/domain/logic';
import type { Lugar, Paciente } from '@/domain/types';
import { avisar } from '@/ui/acciones';
import { Boton, Campo, Cargando, Opcion, Pantalla, T, Tarjeta } from '@/ui/kit';
import { E } from '@/ui/theme';

export default function EditarHistoria() {
  const db = useSQLiteContext();
  const { id, seccion } = useLocalSearchParams<{ id: string; seccion?: SeccionHistoria }>();
  const pid = Number(id);
  const sec = SECCIONES[seccion ?? 'datos'] ?? SECCIONES.datos;

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [valores, setValores] = useState<Partial<Record<CampoPaciente, string>>>({});
  const [lugar, setLugar] = useState<Lugar>('consultorio');

  useEffect(() => {
    obtenerPaciente(db, pid).then((p) => {
      if (!p) return;
      setPaciente(p);
      setLugar(p.lugar);
      const v: Partial<Record<CampoPaciente, string>> = {};
      for (const c of sec.campos) v[c.campo] = c.tipo === 'fecha' ? formatoFechaMx(p[c.campo]) : String(p[c.campo] ?? '');
      setValores(v);
    });
  }, [db, pid, sec]);

  if (!paciente) return <Cargando />;

  const guardar = async () => {
    const cambios: Partial<Record<CampoPaciente, string>> = {};
    for (const c of sec.campos) {
      let v = (valores[c.campo] ?? '').trim();
      if (c.tipo === 'fecha' && v) {
        const iso = parseFechaMx(v);
        if (!iso) return avisar(`Revisa "${c.etiqueta}"`, 'Escríbela como dd/mm/aaaa.');
        v = iso;
      }
      cambios[c.campo] = v;
    }
    if (cambios.nombre !== undefined && !cambios.nombre) return avisar('El nombre no puede quedar vacío');
    if (seccion === 'datos' || !seccion) {
      cambios.lugar = lugar;
      if (valores.rfc !== undefined) cambios.rfc = valores.rfc.trim();
    }
    await actualizarPaciente(db, pid, cambios);
    router.back();
  };

  return (
    <Pantalla abajo={<Boton texto="Guardar" onPress={guardar} />}>
      <Stack.Screen options={{ title: sec.titulo }} />
      <T v="tenue">{paciente.nombre}</T>
      <Tarjeta style={{ gap: 14 }}>
        {sec.campos.map((c) => (
          <Campo
            key={c.campo}
            etiqueta={c.etiqueta}
            value={valores[c.campo] ?? ''}
            onChangeText={(t) => setValores((v) => ({ ...v, [c.campo]: t }))}
            placeholder={c.ayuda}
            multilinea={c.largo}
            keyboardType={c.tipo === 'telefono' ? 'phone-pad' : c.tipo === 'correo' ? 'email-address' : c.tipo === 'fecha' ? 'numbers-and-punctuation' : 'default'}
            autoCapitalize={c.tipo === 'correo' ? 'none' : 'sentences'}
          />
        ))}
        {(seccion === 'datos' || !seccion) ? (
          <View style={{ gap: E.s }}>
            <T v="chico" style={{ fontWeight: '600' }}>Dónde lo atiendes normalmente</T>
            <View style={{ flexDirection: 'row', gap: E.s }}>
              <Opcion texto="Consultorio" activo={lugar === 'consultorio'} onPress={() => setLugar('consultorio')} style={{ flex: 1 }} />
              <Opcion texto="Domicilio" activo={lugar === 'domicilio'} onPress={() => setLugar('domicilio')} style={{ flex: 1 }} />
            </View>
          </View>
        ) : null}
      </Tarjeta>
      {(seccion === 'datos' || !seccion) ? (
        <Tarjeta style={{ gap: 14 }}>
          <T v="seccion">Para facturar</T>
          <Campo etiqueta="RFC" value={valores.rfc ?? paciente.rfc} onChangeText={(t) => setValores((v) => ({ ...v, rfc: t.toUpperCase() }))} autoCapitalize="characters" placeholder="Solo si pide factura" />
        </Tarjeta>
      ) : null}
    </Pantalla>
  );
}
