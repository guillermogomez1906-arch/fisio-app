import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { crearPaciente } from '@/data/repo';
import type { Lugar } from '@/domain/types';
import { avisar } from '@/ui/acciones';
import { Boton, Campo, Opcion, Pantalla, T, Tarjeta } from '@/ui/kit';
import { E } from '@/ui/theme';

export default function PacienteNuevo() {
  const db = useSQLiteContext();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [motivo, setMotivo] = useState('');
  const [lugar, setLugar] = useState<Lugar>('consultorio');
  const [direccion, setDireccion] = useState('');

  const guardar = async () => {
    if (!nombre.trim()) return avisar('Falta el nombre');
    const id = await crearPaciente(db, { nombre: nombre.trim(), telefono: telefono.trim(), motivo: motivo.trim(), lugar, direccion: direccion.trim() });
    router.replace(`/paciente/${id}`);
  };

  return (
    <Pantalla abajo={<Boton texto="Guardar y abrir ficha" onPress={guardar} />}>
      <Tarjeta style={{ gap: E.m }}>
        <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} placeholder="Nombre y apellido" autoFocus />
        <Campo etiqueta="Teléfono (WhatsApp)" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" placeholder="10 dígitos" />
        <Campo etiqueta="Motivo de consulta" value={motivo} onChangeText={setMotivo} placeholder="Ej. dolor de espalda baja" />
      </Tarjeta>
      <Tarjeta style={{ gap: E.m }}>
        <T v="seccion">Dónde lo atiendes normalmente</T>
        <View style={{ flexDirection: 'row', gap: E.s }}>
          <Opcion texto="Consultorio" activo={lugar === 'consultorio'} onPress={() => setLugar('consultorio')} style={{ flex: 1 }} />
          <Opcion texto="Domicilio" activo={lugar === 'domicilio'} onPress={() => setLugar('domicilio')} style={{ flex: 1 }} />
        </View>
        <Campo etiqueta="Dirección" value={direccion} onChangeText={setDireccion} placeholder={lugar === 'domicilio' ? 'Calle, número, colonia y municipio' : 'Opcional'} />
      </Tarjeta>
      <T v="chico">Antecedentes y diagnóstico se capturan después, en la ficha.</T>
    </Pantalla>
  );
}
