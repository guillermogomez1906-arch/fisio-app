import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { listarPacientes } from '@/data/repo';
import { fechaCorta } from '@/domain/logic';
import { Boton, Campo, Cargando, Pantalla, T, Tarjeta, Vacio, useAlEnfocar } from '@/ui/kit';
import { C } from '@/ui/theme';

export default function Pacientes() {
  const db = useSQLiteContext();
  const [busqueda, setBusqueda] = useState('');
  const { datos } = useAlEnfocar(() => listarPacientes(db, busqueda), [busqueda]);

  return (
    <Pantalla>
      <Campo etiqueta="Buscar por nombre o teléfono" value={busqueda} onChangeText={setBusqueda} placeholder="Ej. Ana" />
      <Boton v="secundario" icono="user-plus" texto="Paciente nuevo" onPress={() => router.push('/paciente/nuevo')} />
      {!datos ? <Cargando /> : datos.length === 0 ? (
        <Vacio texto={busqueda ? 'Ningún paciente coincide con la búsqueda.' : 'Todavía no tienes pacientes.'} />
      ) : datos.map((p) => (
        <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/paciente/${p.id}`)}>
          <Tarjeta style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <T v="grande" style={{ flex: 1 }}>{p.nombre}</T>
              <T v="chico">{p.ultima_sesion ? `Última: ${fechaCorta(p.ultima_sesion)}` : 'Sin sesiones'}</T>
            </View>
            {p.motivo ? <T v="chico">{p.motivo}</T> : null}
            {p.restantes_paquete ? <T v="chico" style={{ color: C.acento, fontWeight: '600' }}>Paquete: le quedan {p.restantes_paquete}</T> : null}
          </Tarjeta>
        </Pressable>
      ))}
    </Pantalla>
  );
}
