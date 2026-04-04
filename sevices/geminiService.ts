import { GoogleGenAI, Type } from "@google/genai";
import { Workout, Routine } from "../types";

const getApiKey = () => {
  const key = import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
    console.log('API Key:', key ? 'Loaded' : 'Missing');
  if (!key) {
    throw new Error("VITE_GOOGLE_API_KEY or VITE_GEMINI_API_KEY no configurada en las variables de entorno. Contacta a soporte.");
  }
  return key;
};

export const getPersonalizedRecommendations = async (workouts: Workout[]) => {
  try {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    
    const historySummary = workouts.map(w => ({
      date: w.date,
      exercises: w.exercises.map(e => ({
        name: e.name,
        sets: e.sets.length,
        maxWeight: Math.max(...e.sets.map(s => s.weight), 0)
      }))
    })).slice(-10);
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analiza el siguiente historial de entrenamiento de gimnasio y proporciona 4 recomendaciones personalizadas para mejorar. Considera la sobrecarga progresiva, variedad de ejercicios y posibles debilidades.
      
      Historial: ${JSON.stringify(historySummary)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              category: { 
                type: Type.STRING, 
                enum: ['strength', 'recovery', 'nutrition', 'technique']
              }
            },
            required: ['title', 'description', 'category']
          }
        }
      }
    });
    
    try {
      return JSON.parse(response.text);
    } catch (error) {
      console.error("Failed to parse Gemini response", error);
      return [];
    }
  } catch (err: any) {
    console.error("Error in getPersonalizedRecommendations:", err.message);
    throw err;
  }
};

interface RoutineParams {
  daysPerWeek: string;
  objective: string;
  level: string;
  equipment?: string;
}

export const generateRoutine = async (params: RoutineParams): Promise<Routine> => {
  try {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `Crea una rutina de gimnasio personalizada con los siguientes parámetros:
    - Días por semana: ${params.daysPerWeek}
    - Objetivo principal: ${params.objective}
    - Nivel del usuario: ${params.level}
    - Equipo disponible: ${params.equipment || 'Gimnasio completo'}
    Para cada ejercicio, incluye un tiempo de descanso recomendado (ej. "60s", "90s", "2 min") basado en el objetivo de entrenamiento.
    La rutina debe estar estructurada de forma lógica para el objetivo indicado.
    Proporciona la respuesta en formato JSON.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Nombre atractivo para la rutina" },
            description: { type: Type.STRING, description: "Breve descripción de por qué esta rutina es ideal" },
            exercises: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  sets: { type: Type.INTEGER },
                  reps: { type: Type.STRING, description: "Rango de repeticiones, ej: '8-12' o '10'" },
                  restTime: { type: Type.STRING, description: "Tiempo de descanso recomendado, ej: '60s'" }
                },
                required: ['name', 'sets', 'reps', 'restTime']
              }
            }
          },
          required: ['name', 'description', 'exercises']
        }
      }
    });
    
    try {
      const data = JSON.parse(response.text);
      return {
        ...data,
        id: Math.random().toString(36).substr(2, 9),
        exercises: data.exercises.map((ex: any) => ({ ...ex, id: Math.random().toString(36).substr(2, 9) }))
      };
    } catch (parseError) {
      console.error("Failed to parse routine response", parseError);
      throw new Error("No se pudo parsear la respuesta de la rutina generada.");
    }
  } catch (error: any) {
    console.error("Error generating routine:", error.message);
    throw new Error(error.message || "No se pudo generar la rutina. Intenta nuevamente.");
  }
};
