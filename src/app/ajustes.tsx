import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { guardarAjustes, obtenerAjustes } from '@/data/repo';
import { haceCuanto } from '@/domain/logic';
import { contarPendientes } from '@/sync/motor';
import { useRespaldo } from '@/sync/proveedor';
import { avisar, confirmar } from '@/ui/acciones';
import { Aviso, Boton, Campo, Cargando, Pantalla, T, Tarjeta } from '@/ui/kit';
import { C, E } from '@/ui/theme';

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
      <CuentaYRespaldo />
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

function CuentaYRespaldo() {
  const db = useSQLiteContext();
  const { conNube, sesion, sincronizando, ultimo, pendientes, error, sincronizar, salir, eliminarCuenta } = useRespaldo();

  if (!conNube) {
    return (
      <Tarjeta>
        <T v="seccion">Respaldo</T>
        <T v="tenue">Esta versión guarda todo solo en este teléfono. Falta configurar la nube para tener cuenta y respaldo.</T>
      </Tarjeta>
    );
  }

  const estado = sincronizando
    ? 'Respaldando…'
    : pendientes > 0
      ? `${pendientes} ${pendientes === 1 ? 'cambio' : 'cambios'} por respaldar`
      : ultimo ? `Todo respaldado · ${haceCuanto(ultimo)}` : 'Aún no se respalda';

  const cerrarSesion = async () => {
    await sincronizar();
    const n = await contarPendientes(db);
    const mensaje = n > 0
      ? `Hay ${n} cambios sin respaldar (¿sin internet?). Si sales ahora se pierden. Mejor conéctate y espera a que se respalden.`
      : 'Todo está respaldado. Al salir se borran los datos de este teléfono y vuelven cuando entres de nuevo.';
    confirmar('¿Salir de tu cuenta?', mensaje, n > 0 ? 'Salir y perderlos' : 'Salir', () => { salir(); });
  };

  return (
    <Tarjeta style={{ gap: E.m }}>
      <T v="seccion">Cuenta y respaldo</T>
      <View style={{ gap: 2 }}>
        <T v="chico">Cuenta</T>
        <T v="fuerte">{sesion?.user.email ?? '—'}</T>
      </View>
      <View style={{ gap: 2 }}>
        <T v="chico">Respaldo</T>
        <T v="fuerte" style={{ color: pendientes > 0 || error ? C.aviso : C.acento }}>{estado}</T>
      </View>
      {error ? <Aviso texto={error} /> : null}
      <Boton v="secundario" icono="upload-cloud" texto="Respaldar ahora" deshabilitado={sincronizando} onPress={sincronizar} />
      <Boton v="peligro" icono="log-out" texto="Salir de la cuenta" onPress={cerrarSesion} />
      <View style={{ height: 1, backgroundColor: C.linea, marginVertical: E.xs }} />
      <Boton v="peligro" icono="trash-2" texto="Eliminar mi cuenta" onPress={() => confirmar(
        '¿Eliminar tu cuenta?',
        'Se borran para siempre tus pacientes, historias clínicas, citas y cobros, en este teléfono y en la nube. No se puede deshacer. Si los necesitas, exporta antes el resumen para tu contador.',
        'Eliminar para siempre',
        () => confirmar('¿Seguro?', `Se elimina la cuenta ${sesion?.user.email ?? ''} con todos sus datos.`, 'Sí, eliminar', async () => {
          try { await eliminarCuenta(); } catch (e) { avisar('No se pudo eliminar', `${(e as Error).message}. Revisa tu conexión e inténtalo de nuevo.`); }
        }),
      )} />
    </Tarjeta>
  );
}
