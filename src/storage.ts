import type { AppData } from "./types";

const STORAGE_KEY = "fit-agent-data-v1";

export const defaultData: AppData = {
  workouts: [],
  nutrition: [],
  bodyMetrics: [],
  goals: {
    dailyCalories: 2200,
    dailyProtein: 130,
    dailyCarbs: 250,
    dailyFat: 70,
    dailyFiber: 30,
    dailySugarLimit: 45,
    dailySodiumLimit: 2300,
    dailyVitaminC: 90,
    dailyVitaminD: 15,
    dailyCalcium: 1000,
    dailyIron: 8,
    dailyWater: 2600,
    weeklyWorkoutMinutes: 240,
    weeklyWorkoutCount: 4,
    height: 175,
    targetWeight: 72,
  },
};

export function loadData(): AppData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultData;

  try {
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      workouts: parsed.workouts ?? [],
      nutrition: (parsed.nutrition ?? []).map((entry) => ({
        ...entry,
        fiber: entry.fiber ?? 0,
        sugar: entry.sugar ?? 0,
        sodium: entry.sodium ?? 0,
        vitaminC: entry.vitaminC ?? 0,
        vitaminD: entry.vitaminD ?? 0,
        calcium: entry.calcium ?? 0,
        iron: entry.iron ?? 0,
      })),
      bodyMetrics: parsed.bodyMetrics ?? [],
      goals: {
        ...defaultData.goals,
        ...(parsed.goals ?? {}),
      },
    };
  } catch {
    return defaultData;
  }
}

export function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportJson(data: AppData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fit-agent-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
