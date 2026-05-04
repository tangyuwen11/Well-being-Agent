import type { AgentInsight, AgentReport, AppData } from "./types";

const dayMs = 24 * 60 * 60 * 1000;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

function isSince(date: string, days: number) {
  return new Date(date) >= daysAgo(days);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sum<T>(items: T[], pick: (item: T) => number) {
  return items.reduce((total, item) => total + pick(item), 0);
}

function round(value: number) {
  return Math.round(value);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function makeInsight(
  tone: AgentInsight["tone"],
  title: string,
  body: string
): AgentInsight {
  return {
    id: `${tone}-${title}`,
    tone,
    title,
    body,
  };
}

function getWorkoutStreak(activeDates: Set<string>) {
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (activeDates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setTime(cursor.getTime() - dayMs);
  }

  return streak;
}

export function analyzeHealth(data: AppData): AgentReport {
  const today = todayKey();
  const todaysWorkouts = data.workouts.filter((entry) => entry.date === today);
  const todaysNutrition = data.nutrition.filter((entry) => entry.date === today);
  const weekWorkouts = data.workouts.filter((entry) => isSince(entry.date, 6));
  const weekNutrition = data.nutrition.filter((entry) => isSince(entry.date, 6));
  const activeDates = new Set(weekWorkouts.map((entry) => entry.date));

  const todayCalories = sum(todaysNutrition, (entry) => entry.calories);
  const todayProtein = sum(todaysNutrition, (entry) => entry.protein);
  const todayCarbs = sum(todaysNutrition, (entry) => entry.carbs);
  const todayFat = sum(todaysNutrition, (entry) => entry.fat);
  const todayFiber = sum(todaysNutrition, (entry) => entry.fiber);
  const todaySugar = sum(todaysNutrition, (entry) => entry.sugar);
  const todaySodium = sum(todaysNutrition, (entry) => entry.sodium);
  const todayVitaminC = sum(todaysNutrition, (entry) => entry.vitaminC);
  const todayVitaminD = sum(todaysNutrition, (entry) => entry.vitaminD);
  const todayCalcium = sum(todaysNutrition, (entry) => entry.calcium);
  const todayIron = sum(todaysNutrition, (entry) => entry.iron);
  const todayWater = sum(todaysNutrition, (entry) => entry.water);
  const todayWorkoutMinutes = sum(todaysWorkouts, (entry) => entry.minutes);
  const latestBody = [...data.bodyMetrics].sort((a, b) => b.date.localeCompare(a.date))[0];
  const height = latestBody?.height || data.goals.height;
  const weight = latestBody?.weight || 0;
  const bmi = height > 0 && weight > 0 ? weight / (height / 100) ** 2 : 0;
  const weeklyLoad = sum(weekWorkouts, (entry) => entry.minutes * entry.intensity);
  const avgRecovery =
    weekWorkouts.length > 0
      ? sum(weekWorkouts, (entry) => entry.recovery) / weekWorkouts.length
      : 3;
  const highIntensityMinutes = sum(
    weekWorkouts.filter((entry) => entry.intensity >= 4),
    (entry) => entry.minutes
  );

  const nutritionScore = round(
    (clamp(todayCalories / data.goals.dailyCalories, 0, 1) * 0.18 +
      clamp(todayProtein / data.goals.dailyProtein, 0, 1) * 0.22 +
      clamp(todayCarbs / data.goals.dailyCarbs, 0, 1) * 0.12 +
      clamp(todayFat / data.goals.dailyFat, 0, 1) * 0.08 +
      clamp(todayFiber / data.goals.dailyFiber, 0, 1) * 0.14 +
      clamp(todayWater / data.goals.dailyWater, 0, 1) * 0.16 +
      clamp(todayVitaminC / data.goals.dailyVitaminC, 0, 1) * 0.05 +
      clamp(todayCalcium / data.goals.dailyCalcium, 0, 1) * 0.05) *
      100
  );

  const loadTarget = data.goals.weeklyWorkoutMinutes * 3;
  const loadPressure = loadTarget > 0 ? clamp(weeklyLoad / loadTarget, 0, 1.3) : 0;
  const recoveryPenalty = avgRecovery < 3 ? (3 - avgRecovery) * 15 : 0;
  const intensityPenalty = highIntensityMinutes > 120 ? 10 : 0;
  const readiness = round(
    clamp(78 + nutritionScore * 0.18 - loadPressure * 12 - recoveryPenalty - intensityPenalty, 35, 98)
  );

  const insights: AgentInsight[] = [];

  if (todayWorkoutMinutes === 0) {
    insights.push(
      makeInsight("watch", "今天还没有训练记录", "如果今天是训练日，先记录一组最小可完成的动作；如果是休息日，agent 会把它看作恢复窗口。")
    );
  } else if (todayWorkoutMinutes >= 45) {
    insights.push(
      makeInsight("good", "训练量已经进入有效区间", `今天记录了 ${todayWorkoutMinutes} 分钟运动，建议把补水和蛋白质一起补上。`)
    );
  }

  if (todayProtein < data.goals.dailyProtein * 0.55 && todayCalories > 0) {
    insights.push(
      makeInsight("watch", "蛋白质偏低", `当前蛋白质 ${round(todayProtein)}g，距离目标还差 ${round(data.goals.dailyProtein - todayProtein)}g。下一餐优先补优质蛋白。`)
    );
  }

  if (todayFiber < data.goals.dailyFiber * 0.5 && todaysNutrition.length > 0) {
    insights.push(
      makeInsight("watch", "纤维偏低", `今天纤维 ${round(todayFiber)}g，距离目标还差 ${round(data.goals.dailyFiber - todayFiber)}g。下一餐可以加蔬菜、豆类或全谷物。`)
    );
  }

  if (todaySodium > data.goals.dailySodiumLimit) {
    insights.push(
      makeInsight("alert", "钠摄入超出目标", `今天记录钠 ${round(todaySodium)}mg，已经超过 ${data.goals.dailySodiumLimit}mg。晚些时候适合清淡一点并补水。`)
    );
  }

  if (todayVitaminC < data.goals.dailyVitaminC * 0.5 && todaysNutrition.length > 0) {
    insights.push(
      makeInsight("watch", "维生素 C 还没跟上", `当前维 C ${round(todayVitaminC)}mg。水果、深色蔬菜或补剂记录后，agent 会更新微量营养评分。`)
    );
  }

  if (todayWater < data.goals.dailyWater * 0.5 && todaysNutrition.length > 0) {
    insights.push(
      makeInsight("watch", "水分摄入需要跟上", `今天记录水分 ${round(todayWater)}ml。训练日可以分几次补到 ${data.goals.dailyWater}ml 左右。`)
    );
  }

  if (weekWorkouts.length >= data.goals.weeklyWorkoutCount) {
    insights.push(
      makeInsight("good", "本周训练频率达标", `过去 7 天有 ${weekWorkouts.length} 次训练，活跃天数 ${activeDates.size} 天。`)
    );
  }

  if (latestBody && data.goals.targetWeight > 0) {
    const delta = roundOne(latestBody.weight - data.goals.targetWeight);
    const direction = delta === 0 ? "已经贴近目标体重" : delta > 0 ? `比目标高 ${delta}kg` : `比目标低 ${Math.abs(delta)}kg`;
    insights.push(
      makeInsight("good", "身体指标已纳入观察", `最近体重 ${latestBody.weight}kg，BMI ${roundOne(bmi)}，${direction}。`)
    );
  }

  if (highIntensityMinutes > 150 && avgRecovery <= 3) {
    insights.push(
      makeInsight("alert", "高强度和恢复信号有冲突", "过去 7 天高强度训练较多，且恢复评分不高。下一次训练建议降强度或做技术/拉伸日。")
    );
  }

  if (insights.length === 0) {
    insights.push(
      makeInsight("good", "状态稳定", "记录看起来比较均衡。继续保持训练、蛋白质和补水的同步记录，趋势会越来越准。")
    );
  }

  return {
    readiness,
    weeklyLoad: round(weeklyLoad),
    nutritionScore,
    streak: getWorkoutStreak(new Set(data.workouts.map((entry) => entry.date))),
    today: {
      calories: round(todayCalories),
      protein: round(todayProtein),
      carbs: round(todayCarbs),
      fat: round(todayFat),
      fiber: round(todayFiber),
      sugar: round(todaySugar),
      sodium: round(todaySodium),
      vitaminC: round(todayVitaminC),
      vitaminD: round(todayVitaminD),
      calcium: round(todayCalcium),
      iron: round(todayIron),
      water: round(todayWater),
      workoutMinutes: round(todayWorkoutMinutes),
    },
    week: {
      calories: round(sum(weekNutrition, (entry) => entry.calories)),
      protein: round(sum(weekNutrition, (entry) => entry.protein)),
      carbs: round(sum(weekNutrition, (entry) => entry.carbs)),
      fat: round(sum(weekNutrition, (entry) => entry.fat)),
      fiber: round(sum(weekNutrition, (entry) => entry.fiber)),
      water: round(sum(weekNutrition, (entry) => entry.water)),
      workoutMinutes: round(sum(weekWorkouts, (entry) => entry.minutes)),
      workouts: weekWorkouts.length,
      activeDays: activeDates.size,
    },
    body: {
      height: roundOne(height),
      weight: roundOne(weight),
      bmi: roundOne(bmi),
      bodyFat: roundOne(latestBody?.bodyFat ?? 0),
      waist: roundOne(latestBody?.waist ?? 0),
      lastUpdated: latestBody?.date ?? "",
    },
    insights,
  };
}

export function lastNDays(days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - index - 1));
    return date.toISOString().slice(0, 10);
  });
}
