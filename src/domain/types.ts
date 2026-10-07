// Tipos del dominio. Sin dependencias de React Native para poder probarlos en Node.

export type Lugar = 'consultorio' | 'domicilio';

export type EstadoCita = 'agendada' | 'confirmada' | 'atendida' | 'cancelada' | 'no_llego';

export type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta' | 'paquete';

export interface Paciente {
  id: number;
  nombre: string;
  telefono: string;
  lugar: Lugar; // dónde se atiende normalmente
  direccion: string;
  // Datos personales
  nacimiento: string; // ISO YYYY-MM-DD o ''
  sexo: string;
  ocupacion: string;
  correo: string;
  emergencia: string;
  // Antecedentes
  patologicos: string;
  quirurgicos: string;
  medicamentos: string;
  alergias: string;
  actividad: string;
  // Diagnóstico y plan
  motivo: string;
  inicio: string;
  dx_fisio: string;
  dx_medico: string;
  refiere: string;
  objetivos: string;
  // Facturación (versión 2)
  rfc: string;
  regimen: string;
  creado: string;
}

export interface Cita {
  id: number;
  paciente_id: number;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  duracion_min: number;
  lugar: Lugar;
  direccion: string;
  estado: EstadoCita;
  recordatorio_enviado: number; // 0 | 1
  calendar_event_id: string | null;
}

export interface Sesion {
  id: number;
  cita_id: number | null;
  paciente_id: number;
  fecha: string;
  dolor: number; // 1 a 10
  trabajo: string;
  notas: string;
}

export interface Paquete {
  id: number;
  paciente_id: number;
  sesiones: number;
  usadas: number;
  precio: number;
  fecha: string;
}

export interface Cobro {
  id: number;
  paciente_id: number;
  cita_id: number | null;
  paquete_id: number | null;
  fecha: string;
  monto: number;
  metodo: MetodoPago;
  lugar: Lugar;
  factura: number; // 0 | 1
  concepto: string;
}

export interface Ajustes {
  nombre_fisio: string;
  tarifa_consultorio: number;
  tarifa_domicilio: number;
  duracion_min: number;
}

export const AJUSTES_INICIALES: Ajustes = {
  nombre_fisio: '',
  tarifa_consultorio: 0,
  tarifa_domicilio: 0,
  duracion_min: 60,
};
