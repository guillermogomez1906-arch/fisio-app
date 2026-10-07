// Estructura de la historia clínica: secciones y campos, en el orden en que se muestran.

import type { CampoPaciente } from '@/data/repo';

export type SeccionHistoria = 'datos' | 'antecedentes' | 'diagnostico';

export interface CampoHistoria {
  campo: CampoPaciente;
  etiqueta: string;
  ayuda?: string;
  largo?: boolean;
  tipo?: 'fecha' | 'telefono' | 'correo';
}

export const SECCIONES: Record<SeccionHistoria, { titulo: string; campos: CampoHistoria[] }> = {
  datos: {
    titulo: 'Datos personales',
    campos: [
      { campo: 'nombre', etiqueta: 'Nombre' },
      { campo: 'nacimiento', etiqueta: 'Fecha de nacimiento', ayuda: 'dd/mm/aaaa', tipo: 'fecha' },
      { campo: 'sexo', etiqueta: 'Sexo' },
      { campo: 'ocupacion', etiqueta: 'Ocupación', ayuda: 'Ej. oficina, trabajo de pie' },
      { campo: 'telefono', etiqueta: 'Teléfono (WhatsApp)', tipo: 'telefono' },
      { campo: 'correo', etiqueta: 'Correo', tipo: 'correo' },
      { campo: 'direccion', etiqueta: 'Dirección' },
      { campo: 'emergencia', etiqueta: 'Contacto de emergencia', ayuda: 'Nombre, parentesco y teléfono' },
    ],
  },
  antecedentes: {
    titulo: 'Antecedentes',
    campos: [
      { campo: 'patologicos', etiqueta: 'Enfermedades', ayuda: 'Diabetes, hipertensión…', largo: true },
      { campo: 'quirurgicos', etiqueta: 'Cirugías', ayuda: 'Cuál y cuándo', largo: true },
      { campo: 'medicamentos', etiqueta: 'Medicamentos', largo: true },
      { campo: 'alergias', etiqueta: 'Alergias' },
      { campo: 'actividad', etiqueta: 'Actividad física', ayuda: 'Qué y cuántas veces por semana' },
    ],
  },
  diagnostico: {
    titulo: 'Diagnóstico y plan',
    campos: [
      { campo: 'motivo', etiqueta: 'Motivo de consulta' },
      { campo: 'inicio', etiqueta: 'Inicio de los síntomas', ayuda: 'Cuándo y cómo empezó', largo: true },
      { campo: 'dx_fisio', etiqueta: 'Diagnóstico fisioterapéutico', largo: true },
      { campo: 'dx_medico', etiqueta: 'Diagnóstico médico', ayuda: 'Si viene referido', largo: true },
      { campo: 'refiere', etiqueta: 'Médico que refiere' },
      { campo: 'objetivos', etiqueta: 'Objetivos del tratamiento', largo: true },
    ],
  },
};
