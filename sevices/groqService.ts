// services/groqService.ts
import { Routine, Workout } from "../types";

const getGroqApiKey = () => {
  const key = import.meta.env.VITE_GROQ_API_KEY;
  console.log("Groq API Key:", key ? "Loaded" : "Missing");
  if (!key) {
    throw new Error(
      "VITE_GROQ_API_KEY no está configurada en las variables de entorno."
    );
  }
  return key;
};

const GROQ_MODEL = "llama-3.3-70b-versatile";

type RecommendationCategory =
  | "strength"
  | "recovery"
  | "nutrition"
  | "technique";

interface RoutineParams {
  daysPerWeek: string;
  objective: string;
  level: string;
  equipment?: string;
  mode?: "basic" | "pro_plan";
  sessionMinutes?: number;
}

// Helpers ----------------------

const cleanJsonText = (text: string) => {
  let cleaned = text.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  return cleaned;
};

const safeParseJson = (text: string) => {
  const cleaned = cleanJsonText(text);
  return JSON.parse(cleaned);
};

const generateId = () => Math.random().toString(36).slice(2, 11);

const getDayCountFromText = (value?: string) => {
  const parsed = parseInt(value || "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) return 3;
  return Math.min(parsed, 7);
};

const normalizeExercise = (ex: any) => ({
  id: generateId(),
  name: String(ex?.name || "Ejercicio"),
  sets: Number(ex?.sets) > 0 ? Number(ex.sets) : 3,
  reps: String(ex?.reps || "10-12"),
  restTime: String(ex?.restTime || "60s"),
});

const normalizeRoutine = (routine: any): Routine => {
  return {
    id: generateId(),
    name: String(routine?.name || "Rutina generada"),
    description: String(routine?.description || ""),
    exercises: Array.isArray(routine?.exercises)
      ? routine.exercises.map(normalizeExercise)
      : [],
  };
};

const extractMessageContent = (data: any): string => {
  return data?.choices?.[0]?.message?.content || JSON.stringify(data);
};

// ==============================
// Recomendaciones personalizadas
// ==============================
export const getPersonalizedRecommendationsGroq = async (
  workouts: Workout[]
) => {
  try {
    const apiKey = getGroqApiKey();

    const historySummary = workouts
      .map((w) => ({
        date: w.date,
        exercises: w.exercises.map((e) => ({
          name: e.name,
          sets: e.sets.length,
          maxWeight: Math.max(...e.sets.map((s) => s.weight), 0),
        })),
      }))
      .slice(-10);

    const prompt = `Eres un entrenador personal experto.

Analiza el siguiente historial de entrenamiento de gimnasio y proporciona 4 recomendaciones personalizadas para mejorar.
Ten en cuenta sobrecarga progresiva, variedad de ejercicios, equilibrio de grupos musculares y posibles debilidades.

Devuelve SOLO un JSON con este formato exacto, sin texto adicional:

[
  {
    "title": "string",
    "description": "string",
    "category": "strength"
  }
]

"category" solo puede ser uno de estos valores:
- "strength"
- "recovery"
- "nutrition"
- "technique"

Historial:
${JSON.stringify(historySummary)}`;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(
        "Error response from Groq (recommendations):",
        errorData || response.statusText
      );
      return [];
    }

    const data = await response.json();
    const text = extractMessageContent(data);

    try {
      const parsed = safeParseJson(text);
      if (!Array.isArray(parsed)) return [];

      return parsed.filter(
        (item) =>
          item &&
          typeof item.title === "string" &&
          typeof item.description === "string" &&
          ["strength", "recovery", "nutrition", "technique"].includes(
            item.category as RecommendationCategory
          )
      );
    } catch (e) {
      console.error("Failed to parse Groq recommendations", e, text);
      return [];
    }
  } catch (err: any) {
    console.error(
      "Error in getPersonalizedRecommendationsGroq:",
      err.message
    );
    return [];
  }
};

// ===================
// Generador de rutina
// ===================
export const generateRoutineGroq = async (
  params: RoutineParams
): Promise<Routine> => {
  try {
    const apiKey = getGroqApiKey();
    const requestedDayCount = getDayCountFromText(params.daysPerWeek);
    const isPlanMode = params.mode === "pro_plan";

    const minutes = params.sessionMinutes ?? 60;
    let targetExercisesPerDay = 4;
    if (minutes <= 40) targetExercisesPerDay = 3;
    else if (minutes >= 75) targetExercisesPerDay = 5;

    const basicPrompt = `Eres un entrenador personal especializado en rutinas de gimnasio.

Crea una rutina de gimnasio personalizada con estos parámetros:
- Días por semana: ${params.daysPerWeek}
- Objetivo principal: ${params.objective}
- Nivel del usuario: ${params.level}
- Equipo disponible: ${params.equipment || "Gimnasio completo"}
- Minutos por sesión: ${minutes}

Ajusta el número de ejercicios al tiempo disponible (menos ejercicios si hay pocos minutos, más si hay más tiempo), pero siempre con calidad.

Devuelve SOLO un JSON con este formato exacto, sin texto extra:

{
  "name": "Nombre atractivo de la rutina",
  "description": "Breve descripción de por qué esta rutina es ideal",
  "exercises": [
    {
      "name": "Ejercicio",
      "sets": 4,
      "reps": "8-12",
      "restTime": "60s"
    }
  ]
}`;

    const planPrompt = `Eres un entrenador personal especializado en planificación semanal de entrenamiento.

Crea un PLAN SEMANAL de gimnasio con estos parámetros:
- Días por semana: ${params.daysPerWeek}
- Objetivo principal: ${params.objective}
- Nivel del usuario: ${params.level}
- Equipo disponible: ${params.equipment || "Gimnasio completo"}
- Minutos por sesión: ${minutes}

NORMAS DE DISTRIBUCIÓN:
- Usa una estructura coherente de grupos musculares. Ejemplos válidos:
  - Pecho + tríceps
  - Espalda + bíceps
  - Piernas completas
  - Hombros + abdomen
- Evita mezclar músculos sin sentido como "pecho y piernas" en el mismo día.
- Grupos musculares grandes (pecho, espalda, piernas) deben tener alrededor de 4 ejercicios por día.
- Grupos musculares pequeños (bíceps, tríceps, hombros, gemelos, abdomen) deben tener alrededor de 2 ejercicios.
- Adapta el total de ejercicios por día al tiempo disponible (${minutes} minutos por sesión). Con menos tiempo, reduce accesorios; con más tiempo, puedes añadir algún ejercicio extra, pero no satures.

IMPORTANTE:
- El plan debe estar optimizado exactamente para ${requestedDayCount} días de entrenamiento.
- "days" debe tener exactamente ${requestedDayCount} elementos.
- Usa solo días de la semana en español ("Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo") y en orden.
- Cada día debe incluir varios ejercicios útiles siguiendo las normas de grupos musculares.
- Usa nombres realistas de ejercicios de gimnasio.
- No añadas texto fuera del JSON.

Devuelve SOLO un JSON con este formato exacto:

{
  "name": "PLAN SEMANAL <nombre atractivo>",
  "description": "Breve descripción del plan semanal",
  "days": [
    {
      "day": "Lunes",
      "focus": "Pecho y tríceps",
      "exercises": [
        {
          "name": "Press banca",
          "sets": 4,
          "reps": "6-8",
          "restTime": "90s"
        }
      ]
    }
  ]
}`;

    const prompt = isPlanMode ? planPrompt : basicPrompt;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(
        "Error response from Groq (routine):",
        errorData || response.statusText
      );
      throw new Error("La API de Groq devolvió un error.");
    }

    const data = await response.json();
    const text = extractMessageContent(data);

    let parsed: any;
    try {
      parsed = safeParseJson(text);
    } catch (e) {
      console.error("Error parsing routine JSON from Groq:", e, text);
      throw new Error(
        "No se pudo parsear la respuesta de la rutina generada."
      );
    }

    // Modo rutina básica
    if (!isPlanMode) {
      return normalizeRoutine(parsed);
    }

    // Modo PLAN SEMANAL (Infinity)
    const rawDays = Array.isArray(parsed?.days) ? parsed.days : [];

    const normalizedDays = rawDays
      .slice(0, requestedDayCount)
      .map((day: any) => ({
        day: String(day?.day || "Día"),
        focus: String(day?.focus || ""),
        exercises: Array.isArray(day?.exercises)
          ? day.exercises.map(normalizeExercise)
          : [],
      }));

    const flattenedExercises = normalizedDays.flatMap((day: any) =>
      day.exercises.map((exercise: any) => ({
        ...exercise,
        name: day.focus
          ? `${exercise.name} · ${day.day} · ${day.focus}`
          : `${exercise.name} · ${day.day}`,
        dayTag: day.day,
      }))
    );

    return {
      id: generateId(),
      name: String(parsed?.name || "PLAN SEMANAL GENERADO"),
      description: `${String(
        parsed?.description || "Plan semanal personalizado"
      )} [PLAN_DAYS:${requestedDayCount}]`,
      exercises: flattenedExercises,
    };
  } catch (error: any) {
    console.error("Error generating routine (Groq):", error.message);
    throw new Error(
      error.message || "No se pudo generar la rutina. Intenta nuevamente."
    );
  }
};
