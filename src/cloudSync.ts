import type { User } from "@supabase/supabase-js";
import { defaultData } from "./storage";
import { supabase } from "./supabase";
import type { AppData, BodyMetricEntry, NutritionEntry, WorkoutEntry } from "./types";

const TABLE = "fit_agent_data";

type CloudRow = {
  data: AppData;
  updated_at: string;
};

function mergeById<T extends { id: string; date: string }>(local: T[], remote: T[]) {
  return Array.from(new Map([...remote, ...local].map((entry) => [entry.id, entry])).values()).sort(
    (a, b) => b.date.localeCompare(a.date)
  );
}

function normalizeNutrition(entry: NutritionEntry): NutritionEntry {
  return {
    ...entry,
    fiber: entry.fiber ?? 0,
    sugar: entry.sugar ?? 0,
    sodium: entry.sodium ?? 0,
    vitaminC: entry.vitaminC ?? 0,
    vitaminD: entry.vitaminD ?? 0,
    calcium: entry.calcium ?? 0,
    iron: entry.iron ?? 0,
  };
}

export function normalizeAppData(data: Partial<AppData> | null | undefined): AppData {
  return {
    workouts: ((data?.workouts ?? []) as WorkoutEntry[]).filter(Boolean),
    nutrition: ((data?.nutrition ?? []) as NutritionEntry[]).filter(Boolean).map(normalizeNutrition),
    bodyMetrics: ((data?.bodyMetrics ?? []) as BodyMetricEntry[]).filter(Boolean),
    goals: {
      ...defaultData.goals,
      ...(data?.goals ?? {}),
    },
  };
}

export function mergeAppData(local: AppData, remote: AppData): AppData {
  return {
    workouts: mergeById(local.workouts, remote.workouts),
    nutrition: mergeById(local.nutrition, remote.nutrition).map(normalizeNutrition),
    bodyMetrics: mergeById(local.bodyMetrics, remote.bodyMetrics),
    goals: {
      ...defaultData.goals,
      ...remote.goals,
      ...local.goals,
    },
  };
}

export async function fetchCloudData(user: User) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select("data, updated_at")
    .eq("user_id", user.id)
    .maybeSingle<CloudRow>();

  if (error) throw error;
  return data ? normalizeAppData(data.data) : null;
}

export async function saveCloudData(user: User, data: AppData) {
  if (!supabase) return;

  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: user.id,
      data: normalizeAppData(data),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
}
