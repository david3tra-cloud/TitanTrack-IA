
import React from 'react';

export const EXERCISE_CATEGORIES = [
  'Pecho',
  'Espalda',
  'Piernas',
  'Hombros',
  'Brazos',
  'Core',
  'Cardio'
];

export const INITIAL_EXERCISES = [
  // PECHO (Extendido)
  'Press de Banca (Barra)',
  'Press de Banca (Mancuernas)',
  'Press Inclinado (Barra)',
  'Press Inclinado (Mancuernas)',
  'Press Declinado (Barra)',
  'Aperturas Planas (Mancuerna)',
  'Aperturas Inclinadas (Mancuerna)',
  'Cruces en Polea Alta',
  'Cruces en Polea Baja',
  'Peck Deck (Contractora)',
  'Press de Pecho en Máquina',
  'Flexiones de Brazo (Push-ups)',
  'Flexiones Diamante',
  'Flexiones Declinadas',
  'Fondos en Paralelas (Enfoque Pecho)',

  // ESPALDA
  'Peso Muerto Convencional',
  'Peso Muerto Sumo',
  'Dominadas (Pull-ups)',
  'Dominadas Supinas (Chin-ups)',
  'Jalón al Pecho (Agarre Ancho)',
  'Jalón al Pecho (Agarre Cerrado)',
  'Remo con Barra',
  'Remo con Mancuerna a una mano',
  'Remo en Polea Baja (Gironda)',
  'Remo T-Bar',
  'Remo en Máquina',
  'Pull-over con Mancuerna',
  'Pull-over en Polea Alta',
  'Hiperextensiones Lumbares',
  'Remo Pendlay',

  // PIERNAS
  'Sentadilla Trasera (Back Squat)',
  'Sentadilla Frontal',
  'Sentadilla Goblet',
  'Prensa de Piernas 45°',
  'Zancadas (Walking Lunges)',
  'Zancadas Estáticas',
  'Sentadilla Búlgara',
  'Extensión de Cuádriceps',
  'Curl Femoral Tumbado',
  'Curl Femoral Sentado',
  'Peso Muerto Rumano',
  'Peso Muerto Piernas Rígidas',
  'Prensa de Gemelos',
  'Elevación de Talones de pie',
  'Elevación de Talones sentado',
  'Hip Thrust (Empuje de Cadera)',
  'Máquina de Abductores',
  'Máquina de Adductores',

  // HOMBROS
  'Press Militar (Barra)',
  'Press de Hombros (Mancuernas)',
  'Press Arnold',
  'Elevaciones Laterales',
  'Elevaciones Laterales en Polea',
  'Elevaciones Frontales',
  'Pájaro (Deltoide Posterior)',
  'Face Pull',
  'Remo al Mentón',
  'Encogimientos de Hombros (Shrugs)',

  // BRAZOS
  'Curl de Bíceps con Barra EZ',
  'Curl de Bíceps con Mancuernas',
  'Curl Martillo',
  'Curl Predicador (Banco Scott)',
  'Curl Concentrado',
  'Curl de Bíceps en Polea Baja',
  'Press Francés',
  'Extensiones de Tríceps en Polea Alta',
  'Extensiones de Tríceps tras nuca',
  'Patada de Tríceps',
  'Press de Banca Agarre Cerrado',
  'Fondos entre Bancos (Tríceps)',

  // CORE
  'Plancha Abdominal (Plank)',
  'Crunches Abdominales',
  'Elevación de Piernas colgado',
  'Rueda Abdominal (Rollout)',
  'Russian Twists',
  'Deadbug',
  'Plancha Lateral',
  'Bicicleta Abdominal',

  // CARDIO (Extendido)
  'Burpees',
  'Mountain Climbers',
  'Jumping Jacks',
  'Salto a la Comba',
  'Box Jumps (Saltos al Cajón)',
  'Battle Ropes',
  'Sprints en Cinta',
  'Remo Erguido (Concept2)',
  'Elíptica (Nivel Alto)',
  'Bicicleta Estática (Intervalos)',
  'Shadow Boxing'
];

export interface ExerciseDetail {
  name: string;
  category: string;
  description: string;
  drawing: React.ReactNode; 
}

export const EXERCISE_DATABASE: ExerciseDetail[] = [
  {
    name: 'Press de Banca (Barra)',
    category: 'Pecho',
    description: 'El estándar de oro para la fuerza del torso. Trabaja pectorales, deltoides anterior y tríceps. Clave: retracción escapular y pies plantados.',
    drawing: (
      <>
        <path d="M 15 75 L 85 75 M 30 75 L 30 90 M 70 75 L 70 90" stroke="#334155" strokeWidth="3" fill="none" />
        <circle cx="25" cy="70" r="5" fill="#00f2ff" />
        <path d="M 30 70 L 75 70 M 75 70 L 85 85" stroke="#00f2ff" strokeWidth="4" fill="none" />
        <path d="M 50 40 L 50 65" stroke="#ff00f7" strokeWidth="2" strokeDasharray="4 2" />
        <path d="M 20 55 L 80 55" stroke="#f8fafc" strokeWidth="3" />
        <rect x="15" y="48" width="6" height="14" rx="1" fill="#ff00f7" />
        <rect x="79" y="48" width="6" height="14" rx="1" fill="#ff00f7" />
      </>
    )
  },
  {
    name: 'Cruces en Polea Alta',
    category: 'Pecho',
    description: 'Aislamiento máximo para la parte inferior y externa del pectoral. Mantén una ligera flexión de codos y aprieta al centro.',
    drawing: (
      <>
        <path d="M 10 20 L 10 90 M 90 20 L 90 90" stroke="#334155" strokeWidth="4" />
        <circle cx="50" cy="40" r="6" fill="#00f2ff" />
        <path d="M 50 46 L 50 70 L 40 90 M 50 70 L 60 90" stroke="#00f2ff" strokeWidth="4" fill="none" />
        <path d="M 10 25 L 40 42 M 90 25 L 60 42" stroke="#ff00f7" strokeWidth="3" />
      </>
    )
  },
  {
    name: 'Burpees',
    category: 'Cardio',
    description: 'Movimiento de cuerpo completo para acondicionamiento metabólico extremo. Combina sentadilla, flexión y salto vertical.',
    drawing: (
      <>
        <circle cx="50" cy="30" r="5" fill="#ff00f7" />
        <path d="M 50 35 L 50 55 L 40 75 M 50 55 L 60 75" stroke="#00f2ff" strokeWidth="4" fill="none" />
        <path d="M 30 45 L 70 45" stroke="#00f2ff" strokeWidth="3" />
        <path d="M 50 20 L 50 5" stroke="#ff00f7" strokeWidth="2" strokeDasharray="3 2" />
        <path d="M 40 5 L 60 5" stroke="#ff00f7" strokeWidth="2" />
      </>
    )
  },
  {
    name: 'Sentadilla Trasera (Back Squat)',
    category: 'Piernas',
    description: 'Ejercicio fundamental de potencia. Recluta toda la cadena posterior y cuádriceps. Mantén el pecho arriba y rompe el paralelo.',
    drawing: (
      <>
        <circle cx="50" cy="25" r="5" fill="#00f2ff" />
        <path d="M 50 30 L 50 55 L 35 70 L 50 85" stroke="#00f2ff" strokeWidth="4" fill="none" />
        <path d="M 25 35 L 75 35" stroke="#f8fafc" strokeWidth="3" />
        <rect x="20" y="28" width="6" height="14" rx="1" fill="#ff00f7" />
        <rect x="74" y="28" width="6" height="14" rx="1" fill="#ff00f7" />
      </>
    )
  },
  {
    name: 'Remo con Barra',
    category: 'Espalda',
    description: 'Constructor de masa para el dorsal y el trapecio medio. Mantén la espalda a 45 grados y tira de la barra hacia el ombligo.',
    drawing: (
      <>
        <path d="M 10 90 L 90 90" stroke="#334155" strokeWidth="2" />
        <circle cx="60" cy="45" r="5" fill="#00f2ff" />
        <path d="M 55 47 L 35 60 L 40 88" stroke="#00f2ff" strokeWidth="4" fill="none" />
        <path d="M 30 65 L 70 65" stroke="#f8fafc" strokeWidth="3" />
        <circle cx="35" cy="65" r="6" fill="#ff00f7" />
        <circle cx="65" cy="65" r="6" fill="#ff00f7" />
      </>
    )
  },
  {
    name: 'Face Pull',
    category: 'Hombros',
    description: 'Esencial para la salud del hombro y deltoides posterior. Tira de la cuerda hacia la frente separando los extremos.',
    drawing: (
      <>
        <path d="M 10 10 L 10 90" stroke="#334155" strokeWidth="4" />
        <circle cx="50" cy="40" r="6" fill="#00f2ff" />
        <path d="M 50 46 L 50 85" stroke="#00f2ff" strokeWidth="4" />
        <path d="M 10 35 L 45 40 M 10 35 L 45 40" stroke="#ff00f7" strokeWidth="3" />
        <path d="M 45 35 L 45 45" stroke="#ff00f7" strokeWidth="3" />
      </>
    )
  }
];
