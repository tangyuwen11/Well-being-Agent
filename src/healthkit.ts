import { unzipSync } from "fflate";
import type {
  BodyMetricEntry,
  HealthKitImportResult,
  NutritionEntry,
  WorkoutEntry,
  WorkoutType,
} from "./types";

const quantityMap: Record<string, keyof Omit<NutritionEntry, "id" | "date" | "meal" | "note">> = {
  HKQuantityTypeIdentifierDietaryEnergyConsumed: "calories",
  HKQuantityTypeIdentifierDietaryProtein: "protein",
  HKQuantityTypeIdentifierDietaryCarbohydrates: "carbs",
  HKQuantityTypeIdentifierDietaryFatTotal: "fat",
  HKQuantityTypeIdentifierDietaryFiber: "fiber",
  HKQuantityTypeIdentifierDietarySugar: "sugar",
  HKQuantityTypeIdentifierDietarySodium: "sodium",
  HKQuantityTypeIdentifierDietaryVitaminC: "vitaminC",
  HKQuantityTypeIdentifierDietaryVitaminD: "vitaminD",
  HKQuantityTypeIdentifierDietaryCalcium: "calcium",
  HKQuantityTypeIdentifierDietaryIron: "iron",
  HKQuantityTypeIdentifierDietaryWater: "water",
};

function uid() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function dateKey(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function num(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function convertQuantity(type: string, value: number, unit: string | null) {
  const normalizedUnit = (unit ?? "").toLowerCase();

  if (type === "HKQuantityTypeIdentifierDietaryWater") {
    if (normalizedUnit === "l") return value * 1000;
    return value;
  }

  if (
    type === "HKQuantityTypeIdentifierDietarySodium" ||
    type === "HKQuantityTypeIdentifierDietaryVitaminC" ||
    type === "HKQuantityTypeIdentifierDietaryCalcium" ||
    type === "HKQuantityTypeIdentifierDietaryIron"
  ) {
    if (normalizedUnit === "g") return value * 1000;
    return value;
  }

  if (type === "HKQuantityTypeIdentifierBodyMass") {
    if (normalizedUnit === "lb" || normalizedUnit === "lbs") return value * 0.45359237;
    return value;
  }

  if (type === "HKQuantityTypeIdentifierHeight" || type === "HKQuantityTypeIdentifierWaistCircumference") {
    if (normalizedUnit === "m") return value * 100;
    if (normalizedUnit === "in" || normalizedUnit === "inch") return value * 2.54;
    return value;
  }

  return value;
}

function durationMinutes(workout: Element) {
  const duration = num(workout.getAttribute("duration"));
  const unit = (workout.getAttribute("durationUnit") ?? "min").toLowerCase();

  if (unit === "s" || unit === "sec" || unit === "second") return duration / 60;
  if (unit === "h" || unit === "hr" || unit === "hour") return duration * 60;
  return duration;
}

function emptyNutrition(date: string): NutritionEntry {
  return {
    id: uid(),
    date,
    meal: "补剂",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    vitaminC: 0,
    vitaminD: 0,
    calcium: 0,
    iron: 0,
    water: 0,
    note: "HealthKit 导入",
  };
}

function toWorkoutType(activity: string | null): WorkoutType {
  const normalized = activity ?? "";
  if (normalized.includes("Running")) return "跑步";
  if (normalized.includes("Cycling")) return "骑行";
  if (normalized.includes("Swimming")) return "游泳";
  if (normalized.includes("Yoga")) return "瑜伽";
  if (normalized.includes("Walking")) return "步行";
  if (normalized.includes("TraditionalStrengthTraining") || normalized.includes("Strength")) return "力量";
  return "其他";
}

function readEnergy(workout: Element) {
  const direct = num(workout.getAttribute("totalEnergyBurned"));
  if (direct > 0) return Math.round(direct);

  const stats = Array.from(workout.getElementsByTagName("WorkoutStatistics"));
  const energy = stats.find(
    (stat) => stat.getAttribute("type") === "HKQuantityTypeIdentifierActiveEnergyBurned"
  );
  return Math.round(num(energy?.getAttribute("sum") ?? "0"));
}

function textFromZip(buffer: ArrayBuffer) {
  const files = unzipSync(new Uint8Array(buffer));
  const exportPath = Object.keys(files).find((path) => path.endsWith("export.xml"));
  if (!exportPath) {
    throw new Error("ZIP 里没有找到 export.xml");
  }
  return new TextDecoder().decode(files[exportPath]);
}

export async function parseHealthKitFile(file: File): Promise<HealthKitImportResult> {
  const buffer = await file.arrayBuffer();
  const xmlText = file.name.toLowerCase().endsWith(".zip")
    ? textFromZip(buffer)
    : new TextDecoder().decode(buffer);
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const parserError = doc.querySelector("parsererror");

  if (parserError) {
    throw new Error("无法解析 HealthKit XML");
  }

  const nutritionByDate = new Map<string, NutritionEntry>();
  const bodyByDate = new Map<string, BodyMetricEntry>();
  const records = Array.from(doc.getElementsByTagName("Record"));

  for (const record of records) {
    const type = record.getAttribute("type") ?? "";
    const date = dateKey(record.getAttribute("startDate") ?? record.getAttribute("creationDate"));
    const value = convertQuantity(type, num(record.getAttribute("value")), record.getAttribute("unit"));

    if (type in quantityMap) {
      const key = quantityMap[type];
      const nutrition = nutritionByDate.get(date) ?? emptyNutrition(date);
      nutrition[key] += value;
      nutritionByDate.set(date, nutrition);
    }

    if (
      type === "HKQuantityTypeIdentifierBodyMass" ||
      type === "HKQuantityTypeIdentifierHeight" ||
      type === "HKQuantityTypeIdentifierBodyFatPercentage" ||
      type === "HKQuantityTypeIdentifierWaistCircumference"
    ) {
      const body = bodyByDate.get(date) ?? {
        id: uid(),
        date,
        height: 0,
        weight: 0,
        bodyFat: 0,
        waist: 0,
        note: "HealthKit 导入",
      };

      if (type === "HKQuantityTypeIdentifierBodyMass") body.weight = value;
      if (type === "HKQuantityTypeIdentifierHeight") body.height = value;
      if (type === "HKQuantityTypeIdentifierBodyFatPercentage") body.bodyFat = value > 1 ? value : value * 100;
      if (type === "HKQuantityTypeIdentifierWaistCircumference") body.waist = value;
      bodyByDate.set(date, body);
    }
  }

  const workouts: WorkoutEntry[] = Array.from(doc.getElementsByTagName("Workout")).map((workout) => {
    const minutes = durationMinutes(workout);
    const calories = readEnergy(workout);

    return {
      id: uid(),
      date: dateKey(workout.getAttribute("startDate") ?? workout.getAttribute("creationDate")),
      type: toWorkoutType(workout.getAttribute("workoutActivityType")),
      minutes: Math.round(minutes),
      intensity: minutes >= 45 || calories >= 350 ? 4 : 3,
      calories,
      recovery: 3,
      note: "HealthKit 导入",
    };
  });

  return {
    workouts,
    nutrition: Array.from(nutritionByDate.values()).filter(
      (entry) =>
        entry.calories ||
        entry.protein ||
        entry.carbs ||
        entry.fat ||
        entry.fiber ||
        entry.water ||
        entry.vitaminC ||
        entry.vitaminD ||
        entry.calcium ||
        entry.iron
    ),
    bodyMetrics: Array.from(bodyByDate.values()).filter(
      (entry) => entry.height || entry.weight || entry.bodyFat || entry.waist
    ),
    sourceRecords: records.length,
  };
}
