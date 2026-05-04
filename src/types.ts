export type WorkoutType =
  | "力量"
  | "跑步"
  | "骑行"
  | "游泳"
  | "瑜伽"
  | "球类"
  | "步行"
  | "其他";

export type MealType = "早餐" | "午餐" | "晚餐" | "加餐" | "补剂";

export type WorkoutEntry = {
  id: string;
  date: string;
  type: WorkoutType;
  minutes: number;
  intensity: number;
  calories: number;
  recovery: number;
  note: string;
};

export type NutritionEntry = {
  id: string;
  date: string;
  meal: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  vitaminC: number;
  vitaminD: number;
  calcium: number;
  iron: number;
  water: number;
  note: string;
};

export type BodyMetricEntry = {
  id: string;
  date: string;
  height: number;
  weight: number;
  bodyFat: number;
  waist: number;
  note: string;
};

export type Goals = {
  dailyCalories: number;
  dailyProtein: number;
  dailyCarbs: number;
  dailyFat: number;
  dailyFiber: number;
  dailySugarLimit: number;
  dailySodiumLimit: number;
  dailyVitaminC: number;
  dailyVitaminD: number;
  dailyCalcium: number;
  dailyIron: number;
  dailyWater: number;
  weeklyWorkoutMinutes: number;
  weeklyWorkoutCount: number;
  height: number;
  targetWeight: number;
};

export type AppData = {
  workouts: WorkoutEntry[];
  nutrition: NutritionEntry[];
  bodyMetrics: BodyMetricEntry[];
  goals: Goals;
};

export type AgentInsight = {
  id: string;
  tone: "good" | "watch" | "alert";
  title: string;
  body: string;
};

export type AgentReport = {
  readiness: number;
  weeklyLoad: number;
  nutritionScore: number;
  streak: number;
  today: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
    vitaminC: number;
    vitaminD: number;
    calcium: number;
    iron: number;
    water: number;
    workoutMinutes: number;
  };
  week: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    water: number;
    workoutMinutes: number;
    workouts: number;
    activeDays: number;
  };
  body: {
    height: number;
    weight: number;
    bmi: number;
    bodyFat: number;
    waist: number;
    lastUpdated: string;
  };
  insights: AgentInsight[];
};

export type HealthKitImportResult = {
  workouts: WorkoutEntry[];
  nutrition: NutritionEntry[];
  bodyMetrics: BodyMetricEntry[];
  sourceRecords: number;
};
