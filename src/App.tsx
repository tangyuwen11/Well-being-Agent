import {
  Activity,
  Apple,
  Brain,
  Camera,
  CalendarDays,
  Cloud,
  Download,
  Droplets,
  Dumbbell,
  Flame,
  Gauge,
  LogIn,
  LogOut,
  LucideIcon,
  Plus,
  RotateCcw,
  Ruler,
  Scale,
  Settings,
  Sparkles,
  Target,
  Timer,
  Trash2,
  UploadCloud,
  Utensils,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { analyzeHealth, lastNDays } from "./agent";
import { fetchCloudData, mergeAppData, saveCloudData } from "./cloudSync";
import { parseHealthKitFile } from "./healthkit";
import { defaultData, exportJson, loadData, saveData } from "./storage";
import { hasSupabaseConfig, supabase, type AuthSession } from "./supabase";
import type {
  AgentInsight,
  AppData,
  BodyMetricEntry,
  Goals,
  HealthKitImportResult,
  MealType,
  NutritionEntry,
  WorkoutEntry,
  WorkoutType,
} from "./types";

const workoutTypes: WorkoutType[] = [
  "力量",
  "跑步",
  "骑行",
  "游泳",
  "瑜伽",
  "球类",
  "步行",
  "其他",
];

const mealTypes: MealType[] = ["早餐", "午餐", "晚餐", "加餐", "补剂"];
type AppTab = "dashboard" | "record" | "history" | "sync" | "goals";
const appTabs: AppTab[] = ["dashboard", "record", "history", "sync", "goals"];

const today = () => new Date().toISOString().slice(0, 10);

const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function tabFromHash(): AppTab {
  const hash = window.location.hash.replace("#", "");
  return appTabs.includes(hash as AppTab) ? (hash as AppTab) : "dashboard";
}

const defaultNutritionEstimate = {
  calories: 650,
  protein: 35,
  carbs: 70,
  fat: 20,
  fiber: 8,
  sugar: 10,
  sodium: 650,
  vitaminC: 40,
  vitaminD: 2,
  calcium: 200,
  iron: 3,
  water: 700,
};

function estimateNutritionFromPhoto(file: File, hint: string) {
  const text = `${file.name} ${hint}`.toLowerCase();
  const estimate = { ...defaultNutritionEstimate };
  const foods: string[] = [];

  if (/salad|沙拉|蔬菜|菜/.test(text)) {
    Object.assign(estimate, {
      calories: 420,
      protein: 22,
      carbs: 38,
      fat: 18,
      fiber: 12,
      sugar: 9,
      sodium: 520,
      vitaminC: 75,
      calcium: 180,
      iron: 4,
    });
    foods.push("蔬菜/沙拉");
  }

  if (/chicken|鸡|turkey|fish|鱼|salmon|三文鱼|shrimp|虾/.test(text)) {
    estimate.calories += 160;
    estimate.protein += 28;
    estimate.fat += 6;
    estimate.sodium += 220;
    foods.push("高蛋白主菜");
  }

  if (/beef|牛|pork|猪|steak|排/.test(text)) {
    estimate.calories += 260;
    estimate.protein += 30;
    estimate.fat += 16;
    estimate.iron += 3;
    estimate.sodium += 260;
    foods.push("红肉");
  }

  if (/rice|饭|面|noodle|pasta|bread|面包|wrap|卷|potato|土豆/.test(text)) {
    estimate.calories += 240;
    estimate.carbs += 52;
    estimate.protein += 6;
    estimate.fiber += 3;
    foods.push("主食");
  }

  if (/fruit|水果|berry|莓|apple|banana|橙|orange/.test(text)) {
    estimate.calories += 95;
    estimate.carbs += 24;
    estimate.fiber += 4;
    estimate.sugar += 16;
    estimate.vitaminC += 55;
    foods.push("水果");
  }

  if (/soup|汤|ramen|拉面|hotpot|火锅/.test(text)) {
    estimate.calories += 180;
    estimate.carbs += 20;
    estimate.fat += 8;
    estimate.sodium += 1000;
    foods.push("汤/高钠餐");
  }

  if (foods.length === 0) {
    foods.push("混合餐盘");
  }

  return {
    estimate,
    summary: `${foods.join(" + ")}，按一人份估算。`,
  };
}

function seedData(): AppData {
  const days = lastNDays(7);
  return {
    goals: defaultData.goals,
    workouts: [
      {
        id: uid(),
        date: days[1],
        type: "力量",
        minutes: 55,
        intensity: 4,
        calories: 420,
        recovery: 4,
        note: "上肢推拉，动作稳定",
      },
      {
        id: uid(),
        date: days[3],
        type: "跑步",
        minutes: 36,
        intensity: 3,
        calories: 310,
        recovery: 3,
        note: "轻松跑",
      },
      {
        id: uid(),
        date: days[5],
        type: "力量",
        minutes: 62,
        intensity: 5,
        calories: 510,
        recovery: 3,
        note: "腿部训练，强度高",
      },
    ],
    nutrition: days.flatMap((date, index) => [
      {
        id: uid(),
        date,
        meal: "午餐",
        calories: 720 + index * 20,
        protein: 42,
        carbs: 78,
        fat: 22,
        fiber: 8,
        sugar: 12,
        sodium: 720,
        vitaminC: 45,
        vitaminD: 2,
        calcium: 180,
        iron: 3,
        water: 900,
        note: "主餐",
      },
      {
        id: uid(),
        date,
        meal: "晚餐",
        calories: 680,
        protein: 48,
        carbs: 58,
        fat: 24,
        fiber: 7,
        sugar: 9,
        sodium: 680,
        vitaminC: 36,
        vitaminD: 3,
        calcium: 220,
        iron: 4,
        water: 1000,
        note: "训练后补充",
      },
    ]),
    bodyMetrics: [
      {
        id: uid(),
        date: days[0],
        height: 175,
        weight: 73.4,
        bodyFat: 18.5,
        waist: 82,
        note: "晨起空腹",
      },
      {
        id: uid(),
        date: days[6],
        height: 175,
        weight: 72.8,
        bodyFat: 18.2,
        waist: 81,
        note: "示例数据",
      },
    ],
  };
}

function pct(value: number, target: number) {
  if (!target) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(date));
}

function Panel({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <div className="panelTitle">
          <Icon size={18} />
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="metric">
      <Icon size={20} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  target,
  unit,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
}) {
  const percent = pct(value, target);
  return (
    <div className="progressRow">
      <div className="progressCopy">
        <span>{label}</span>
        <b>
          {value}
          {unit} / {target}
          {unit}
        </b>
      </div>
      <div className="track" aria-label={`${label} ${percent}%`}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: AgentInsight }) {
  return (
    <article className={`insight ${insight.tone}`}>
      <Sparkles size={18} />
      <div>
        <h3>{insight.title}</h3>
        <p>{insight.body}</p>
      </div>
    </article>
  );
}

function TrendBars({ data }: { data: AppData }) {
  const days = lastNDays(7);
  const maxMinutes = Math.max(
    60,
    ...days.map((date) =>
      data.workouts
        .filter((entry) => entry.date === date)
        .reduce((total, entry) => total + entry.minutes, 0)
    )
  );

  return (
    <div className="bars">
      {days.map((date) => {
        const minutes = data.workouts
          .filter((entry) => entry.date === date)
          .reduce((total, entry) => total + entry.minutes, 0);
        const protein = data.nutrition
          .filter((entry) => entry.date === date)
          .reduce((total, entry) => total + entry.protein, 0);

        return (
          <div className="barDay" key={date}>
            <div className="barStack">
              <span
                className="bar workoutBar"
                style={{ height: `${Math.max(6, (minutes / maxMinutes) * 100)}%` }}
                title={`${minutes} 分钟运动`}
              />
              <span
                className="bar proteinBar"
                style={{ height: `${Math.max(4, pct(protein, data.goals.dailyProtein))}%` }}
                title={`${Math.round(protein)}g 蛋白质`}
              />
            </div>
            <small>{formatShortDate(date)}</small>
          </div>
        );
      })}
    </div>
  );
}

function WorkoutForm({
  onAdd,
}: {
  onAdd: (entry: WorkoutEntry) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onAdd({
      id: uid(),
      date: String(form.get("date")),
      type: String(form.get("type")) as WorkoutType,
      minutes: Number(form.get("minutes")),
      intensity: Number(form.get("intensity")),
      calories: Number(form.get("calories")),
      recovery: Number(form.get("recovery")),
      note: String(form.get("note") ?? ""),
    });
    event.currentTarget.reset();
  }

  return (
    <form className="entryForm" onSubmit={submit}>
      <label>
        日期
        <input name="date" type="date" defaultValue={today()} required />
      </label>
      <label>
        类型
        <select name="type" defaultValue="力量">
          {workoutTypes.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </label>
      <label>
        分钟
        <input name="minutes" type="number" min="1" defaultValue="45" required />
      </label>
      <label>
        强度
        <input name="intensity" type="range" min="1" max="5" defaultValue="3" />
      </label>
      <label>
        消耗 kcal
        <input name="calories" type="number" min="0" defaultValue="300" />
      </label>
      <label>
        恢复感
        <input name="recovery" type="range" min="1" max="5" defaultValue="4" />
      </label>
      <label className="wide">
        备注
        <input name="note" placeholder="动作、配速、身体感受" />
      </label>
      <button className="primaryButton" type="submit">
        <Plus size={17} />
        记录训练
      </button>
    </form>
  );
}

function NutritionForm({
  onAdd,
}: {
  onAdd: (entry: NutritionEntry) => void;
}) {
  const [values, setValues] = useState(defaultNutritionEstimate);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [agentNote, setAgentNote] = useState("等待照片");
  const [foodHint, setFoodHint] = useState("");

  function setField(field: keyof typeof defaultNutritionEstimate, value: number) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function pickPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoFile(file);
    setPhotoUrl(URL.createObjectURL(file));
    setAgentNote("照片已载入，可以让 agent 估算。");
  }

  function runPhotoAgent() {
    if (!photoFile) {
      setAgentNote("先选择一张食物照片。");
      return;
    }

    const result = estimateNutritionFromPhoto(photoFile, foodHint);
    setValues(result.estimate);
    setAgentNote(`Agent 估算：${result.summary} 数字可手动修正。`);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onAdd({
      id: uid(),
      date: String(form.get("date")),
      meal: String(form.get("meal")) as MealType,
      ...values,
      note: [String(form.get("note") ?? ""), photoFile ? `照片: ${photoFile.name}` : "", agentNote]
        .filter(Boolean)
        .join(" · "),
    });
    event.currentTarget.reset();
    setValues(defaultNutritionEstimate);
    setFoodHint("");
    setPhotoFile(null);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl("");
    setAgentNote("等待照片");
  }

  return (
    <form className="entryForm" onSubmit={submit}>
      <div className="photoAgent wide">
        <label className="photoDrop">
          {photoUrl ? (
            <img src={photoUrl} alt="食物照片预览" />
          ) : (
            <span>
              <Camera size={28} />
              拍照或上传食物照片
            </span>
          )}
          <input accept="image/*" capture="environment" type="file" onChange={pickPhoto} />
        </label>
        <div className="agentControls">
          <label>
            给 agent 的补充信息
            <input
              value={foodHint}
              onChange={(event) => setFoodHint(event.target.value)}
              placeholder="例如：鸡胸饭、牛肉面、沙拉加三文鱼"
            />
          </label>
          <button className="ghostButton" type="button" onClick={runPhotoAgent}>
            <Sparkles size={17} />
            Agent 估算
          </button>
          <small>{agentNote}</small>
        </div>
      </div>
      <label>
        日期
        <input name="date" type="date" defaultValue={today()} required />
      </label>
      <label>
        餐次
        <select name="meal" defaultValue="午餐">
          {mealTypes.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </label>
      <label>
        热量
        <input
          type="number"
          min="0"
          value={values.calories}
          onChange={(event) => setField("calories", Number(event.target.value))}
        />
      </label>
      <label>
        蛋白质 g
        <input
          type="number"
          min="0"
          value={values.protein}
          onChange={(event) => setField("protein", Number(event.target.value))}
        />
      </label>
      <label>
        碳水 g
        <input
          type="number"
          min="0"
          value={values.carbs}
          onChange={(event) => setField("carbs", Number(event.target.value))}
        />
      </label>
      <label>
        脂肪 g
        <input
          type="number"
          min="0"
          value={values.fat}
          onChange={(event) => setField("fat", Number(event.target.value))}
        />
      </label>
      <label>
        纤维 g
        <input
          type="number"
          min="0"
          value={values.fiber}
          onChange={(event) => setField("fiber", Number(event.target.value))}
        />
      </label>
      <label>
        糖 g
        <input
          type="number"
          min="0"
          value={values.sugar}
          onChange={(event) => setField("sugar", Number(event.target.value))}
        />
      </label>
      <label>
        钠 mg
        <input
          type="number"
          min="0"
          value={values.sodium}
          onChange={(event) => setField("sodium", Number(event.target.value))}
        />
      </label>
      <label>
        维 C mg
        <input
          type="number"
          min="0"
          value={values.vitaminC}
          onChange={(event) => setField("vitaminC", Number(event.target.value))}
        />
      </label>
      <label>
        维 D ug
        <input
          type="number"
          min="0"
          value={values.vitaminD}
          onChange={(event) => setField("vitaminD", Number(event.target.value))}
        />
      </label>
      <label>
        钙 mg
        <input
          type="number"
          min="0"
          value={values.calcium}
          onChange={(event) => setField("calcium", Number(event.target.value))}
        />
      </label>
      <label>
        铁 mg
        <input
          type="number"
          min="0"
          value={values.iron}
          onChange={(event) => setField("iron", Number(event.target.value))}
        />
      </label>
      <label>
        饮水 ml
        <input
          type="number"
          min="0"
          step="50"
          value={values.water}
          onChange={(event) => setField("water", Number(event.target.value))}
        />
      </label>
      <label className="wide">
        备注
        <input name="note" placeholder="食物、份量、饱腹感" />
      </label>
      <button className="primaryButton" type="submit">
        <Plus size={17} />
        记录营养
      </button>
    </form>
  );
}

function BodyMetricForm({
  onAdd,
}: {
  onAdd: (entry: BodyMetricEntry) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onAdd({
      id: uid(),
      date: String(form.get("date")),
      height: Number(form.get("height")),
      weight: Number(form.get("weight")),
      bodyFat: Number(form.get("bodyFat")),
      waist: Number(form.get("waist")),
      note: String(form.get("note") ?? ""),
    });
    event.currentTarget.reset();
  }

  return (
    <form className="entryForm" onSubmit={submit}>
      <label>
        日期
        <input name="date" type="date" defaultValue={today()} required />
      </label>
      <label>
        身高 cm
        <input name="height" type="number" min="0" step="0.1" defaultValue="175" />
      </label>
      <label>
        体重 kg
        <input name="weight" type="number" min="0" step="0.1" defaultValue="72" required />
      </label>
      <label>
        体脂 %
        <input name="bodyFat" type="number" min="0" step="0.1" defaultValue="18" />
      </label>
      <label>
        腰围 cm
        <input name="waist" type="number" min="0" step="0.1" defaultValue="80" />
      </label>
      <label className="wide">
        备注
        <input name="note" placeholder="晨起、空腹、训练后等" />
      </label>
      <button className="primaryButton" type="submit">
        <Plus size={17} />
        记录身体指标
      </button>
    </form>
  );
}

function GoalsForm({
  goals,
  onSave,
}: {
  goals: Goals;
  onSave: (goals: Goals) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({
      dailyCalories: Number(form.get("dailyCalories")),
      dailyProtein: Number(form.get("dailyProtein")),
      dailyCarbs: Number(form.get("dailyCarbs")),
      dailyFat: Number(form.get("dailyFat")),
      dailyFiber: Number(form.get("dailyFiber")),
      dailySugarLimit: Number(form.get("dailySugarLimit")),
      dailySodiumLimit: Number(form.get("dailySodiumLimit")),
      dailyVitaminC: Number(form.get("dailyVitaminC")),
      dailyVitaminD: Number(form.get("dailyVitaminD")),
      dailyCalcium: Number(form.get("dailyCalcium")),
      dailyIron: Number(form.get("dailyIron")),
      dailyWater: Number(form.get("dailyWater")),
      weeklyWorkoutMinutes: Number(form.get("weeklyWorkoutMinutes")),
      weeklyWorkoutCount: Number(form.get("weeklyWorkoutCount")),
      height: Number(form.get("height")),
      targetWeight: Number(form.get("targetWeight")),
    });
  }

  return (
    <form className="entryForm goalsForm" onSubmit={submit}>
      <label>
        每日热量 kcal
        <input name="dailyCalories" type="number" defaultValue={goals.dailyCalories} />
      </label>
      <label>
        每日蛋白质 g
        <input name="dailyProtein" type="number" defaultValue={goals.dailyProtein} />
      </label>
      <label>
        每日碳水 g
        <input name="dailyCarbs" type="number" defaultValue={goals.dailyCarbs} />
      </label>
      <label>
        每日脂肪 g
        <input name="dailyFat" type="number" defaultValue={goals.dailyFat} />
      </label>
      <label>
        每日纤维 g
        <input name="dailyFiber" type="number" defaultValue={goals.dailyFiber} />
      </label>
      <label>
        糖上限 g
        <input name="dailySugarLimit" type="number" defaultValue={goals.dailySugarLimit} />
      </label>
      <label>
        钠上限 mg
        <input name="dailySodiumLimit" type="number" defaultValue={goals.dailySodiumLimit} />
      </label>
      <label>
        维 C mg
        <input name="dailyVitaminC" type="number" defaultValue={goals.dailyVitaminC} />
      </label>
      <label>
        维 D ug
        <input name="dailyVitaminD" type="number" defaultValue={goals.dailyVitaminD} />
      </label>
      <label>
        钙 mg
        <input name="dailyCalcium" type="number" defaultValue={goals.dailyCalcium} />
      </label>
      <label>
        铁 mg
        <input name="dailyIron" type="number" defaultValue={goals.dailyIron} />
      </label>
      <label>
        每日饮水 ml
        <input name="dailyWater" type="number" defaultValue={goals.dailyWater} />
      </label>
      <label>
        每周运动分钟
        <input
          name="weeklyWorkoutMinutes"
          type="number"
          defaultValue={goals.weeklyWorkoutMinutes}
        />
      </label>
      <label>
        每周训练次数
        <input name="weeklyWorkoutCount" type="number" defaultValue={goals.weeklyWorkoutCount} />
      </label>
      <label>
        默认身高 cm
        <input name="height" type="number" step="0.1" defaultValue={goals.height} />
      </label>
      <label>
        目标体重 kg
        <input name="targetWeight" type="number" step="0.1" defaultValue={goals.targetWeight} />
      </label>
      <button className="primaryButton" type="submit">
        <Settings size={17} />
        保存目标
      </button>
    </form>
  );
}

function HealthKitImportPanel({
  onImport,
}: {
  onImport: (result: HealthKitImportResult) => void;
}) {
  const [status, setStatus] = useState("选择 Apple Health 导出的 ZIP 或 export.xml，本地解析后导入。");

  async function importFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    try {
      setStatus("正在解析 HealthKit 文件...");
      const result = await parseHealthKitFile(file);
      onImport(result);
      setStatus(
        `已导入 ${result.workouts.length} 条训练、${result.nutrition.length} 天营养、${result.bodyMetrics.length} 条身体指标。`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "导入失败，请检查文件格式。");
    } finally {
      event.currentTarget.value = "";
    }
  }

  return (
    <Panel title="iOS HealthKit 导入" icon={UploadCloud}>
      <div className="syncPanel">
        <p>
          浏览器不能直接读取 iPhone HealthKit。当前本地版本支持读取 Apple Health 导出的 ZIP/export.xml；
          上线多端同步时，需要一个 iOS companion app 通过 HealthKit 权限同步到你的服务器。
        </p>
        <label className="fileDrop">
          <UploadCloud size={22} />
          <span>选择 Health 导出文件</span>
          <input accept=".zip,.xml,text/xml,application/xml" type="file" onChange={importFile} />
        </label>
        <small>{status}</small>
      </div>
    </Panel>
  );
}

function AuthPanel({
  user,
  cloudStatus,
  onSignedIn,
}: {
  user: User | null;
  cloudStatus: string;
  onSignedIn: (session: AuthSession | null) => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setMessage("还没有配置 Supabase 环境变量。");
      return;
    }

    setMessage(mode === "signin" ? "正在登录..." : "正在创建账号...");
    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    onSignedIn(result.data.session);
    setMessage(mode === "signin" ? "登录成功。" : "账号已创建。如果 Supabase 开启邮箱验证，请先确认邮件。");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    onSignedIn(null);
    setMessage("已退出登录。");
  }

  if (!hasSupabaseConfig) {
    return (
      <section className="authPanel offline">
        <Cloud size={17} />
        <span>云同步未配置</span>
      </section>
    );
  }

  if (user) {
    return (
      <section className="authPanel signedIn">
        <Cloud size={17} />
        <div>
          <b>{user.email}</b>
          <small>{cloudStatus}</small>
        </div>
        <button className="iconButton" type="button" title="退出登录" onClick={signOut}>
          <LogOut size={17} />
        </button>
      </section>
    );
  }

  return (
    <section className="authPanel">
      <form onSubmit={submit}>
        <div className="authMode">
          <button className={mode === "signin" ? "active" : ""} type="button" onClick={() => setMode("signin")}>
            登录
          </button>
          <button className={mode === "signup" ? "active" : ""} type="button" onClick={() => setMode("signup")}>
            注册
          </button>
        </div>
        <input
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="邮箱"
          required
          type="email"
          value={email}
        />
        <input
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          minLength={6}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="密码"
          required
          type="password"
          value={password}
        />
        <button className="primaryButton" type="submit">
          <LogIn size={17} />
          {mode === "signin" ? "登录同步" : "创建账号"}
        </button>
        <small>{message || cloudStatus}</small>
      </form>
    </section>
  );
}

function History({
  data,
  onDeleteWorkout,
  onDeleteNutrition,
  onDeleteBodyMetric,
}: {
  data: AppData;
  onDeleteWorkout: (id: string) => void;
  onDeleteNutrition: (id: string) => void;
  onDeleteBodyMetric: (id: string) => void;
}) {
  const workouts = [...data.workouts].sort((a, b) => b.date.localeCompare(a.date));
  const nutrition = [...data.nutrition].sort((a, b) => b.date.localeCompare(a.date));
  const bodyMetrics = [...data.bodyMetrics].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="historyGrid">
      <Panel title="训练记录" icon={Dumbbell}>
        {workouts.length === 0 ? (
          <p className="empty">还没有训练记录。</p>
        ) : (
          <div className="logList">
            {workouts.map((entry) => (
              <article className="logItem" key={entry.id}>
                <div>
                  <b>
                    {entry.type} · {entry.minutes} 分钟
                  </b>
                  <span>
                    {entry.date} · 强度 {entry.intensity}/5 · 恢复 {entry.recovery}/5
                  </span>
                  {entry.note && <small>{entry.note}</small>}
                </div>
                <button
                  className="iconButton"
                  aria-label="删除训练记录"
                  onClick={() => onDeleteWorkout(entry.id)}
                  title="删除训练记录"
                >
                  <Trash2 size={17} />
                </button>
              </article>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="营养记录" icon={Utensils}>
        {nutrition.length === 0 ? (
          <p className="empty">还没有营养记录。</p>
        ) : (
          <div className="logList">
            {nutrition.map((entry) => (
              <article className="logItem" key={entry.id}>
                <div>
                  <b>
                    {entry.meal} · {entry.calories} kcal
                  </b>
                  <span>
                    {entry.date} · P {entry.protein}g · C {entry.carbs}g · F {entry.fat}g · 纤维{" "}
                    {entry.fiber}g
                  </span>
                  {entry.note && <small>{entry.note}</small>}
                </div>
                <button
                  className="iconButton"
                  aria-label="删除营养记录"
                  onClick={() => onDeleteNutrition(entry.id)}
                  title="删除营养记录"
                >
                  <Trash2 size={17} />
                </button>
              </article>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="身体指标" icon={Scale}>
        {bodyMetrics.length === 0 ? (
          <p className="empty">还没有身高体重记录。</p>
        ) : (
          <div className="logList">
            {bodyMetrics.map((entry) => (
              <article className="logItem" key={entry.id}>
                <div>
                  <b>
                    {entry.weight}kg · {entry.height}cm
                  </b>
                  <span>
                    {entry.date} · 体脂 {entry.bodyFat || "-"}% · 腰围 {entry.waist || "-"}cm
                  </span>
                  {entry.note && <small>{entry.note}</small>}
                </div>
                <button
                  className="iconButton"
                  aria-label="删除身体指标记录"
                  onClick={() => onDeleteBodyMetric(entry.id)}
                  title="删除身体指标记录"
                >
                  <Trash2 size={17} />
                </button>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [tab, setTab] = useState<AppTab>(() => tabFromHash());
  const [session, setSession] = useState<AuthSession | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState(
    hasSupabaseConfig ? "未登录，数据仅保存在当前浏览器。" : "未配置 Supabase，数据仅保存在当前浏览器。"
  );
  const lastSyncedRef = useRef("");
  const report = useMemo(() => analyzeHealth(data), [data]);
  const user = session?.user ?? null;

  useEffect(() => {
    saveData(data);
  }, [data]);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: authData }) => {
      setSession(authData.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setCloudReady(false);
      setCloudStatus(
        hasSupabaseConfig ? "未登录，数据仅保存在当前浏览器。" : "未配置 Supabase，数据仅保存在当前浏览器。"
      );
      return;
    }

    let cancelled = false;
    setCloudStatus("正在读取云端数据...");

    fetchCloudData(user)
      .then((cloudData) => {
        if (cancelled) return;
        const merged = cloudData ? mergeAppData(loadData(), cloudData) : loadData();
        setData(merged);
        saveData(merged);
        lastSyncedRef.current = cloudData ? JSON.stringify(merged) : "";
        setCloudReady(true);
        setCloudStatus(cloudData ? "已合并云端数据。" : "云端为空，将同步当前本地数据。");
      })
      .catch((error) => {
        if (cancelled) return;
        setCloudReady(false);
        setCloudStatus(`云端读取失败：${error.message}`);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !cloudReady) return;

    const serialized = JSON.stringify(data);
    if (serialized === lastSyncedRef.current) return;

    const timer = window.setTimeout(() => {
      setCloudStatus("正在同步到云端...");
      saveCloudData(user, data)
        .then(() => {
          lastSyncedRef.current = serialized;
          setCloudStatus(`云端已同步 ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}`);
        })
        .catch((error) => {
          setCloudStatus(`云端同步失败：${error.message}`);
        });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [data, user, cloudReady]);

  useEffect(() => {
    const nextHash = tab === "dashboard" ? "" : `#${tab}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", `${window.location.pathname}${nextHash}`);
    }
  }, [tab]);

  useEffect(() => {
    const syncTab = () => setTab(tabFromHash());
    window.addEventListener("hashchange", syncTab);
    return () => window.removeEventListener("hashchange", syncTab);
  }, []);

  const addWorkout = (entry: WorkoutEntry) =>
    setData((current) => ({ ...current, workouts: [entry, ...current.workouts] }));

  const addNutrition = (entry: NutritionEntry) =>
    setData((current) => ({ ...current, nutrition: [entry, ...current.nutrition] }));

  const addBodyMetric = (entry: BodyMetricEntry) =>
    setData((current) => ({ ...current, bodyMetrics: [entry, ...current.bodyMetrics] }));

  const importHealthKit = (result: HealthKitImportResult) =>
    setData((current) => ({
      ...current,
      workouts: [...result.workouts, ...current.workouts],
      nutrition: [...result.nutrition, ...current.nutrition],
      bodyMetrics: [...result.bodyMetrics, ...current.bodyMetrics],
    }));

  const updateGoals = (goals: Goals) => setData((current) => ({ ...current, goals }));

  return (
    <main className="appShell">
      <header className="topBar">
        <div className="brand">
          <div className="brandMark">
            <Activity size={24} />
          </div>
          <div>
            <h1>Fit Agent</h1>
            <p>训练、营养、恢复的个人观察台</p>
          </div>
        </div>
        <div className="topActions">
          <AuthPanel user={user} cloudStatus={cloudStatus} onSignedIn={setSession} />
          <button className="ghostButton" onClick={() => exportJson(data)}>
            <Download size={17} />
            导出
          </button>
          <button className="ghostButton" onClick={() => setData(seedData())}>
            <RotateCcw size={17} />
            示例
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="主要视图">
        <button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}>
          <Gauge size={17} />
          总览
        </button>
        <button className={tab === "record" ? "active" : ""} onClick={() => setTab("record")}>
          <Plus size={17} />
          记录
        </button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
          <CalendarDays size={17} />
          历史
        </button>
        <button className={tab === "sync" ? "active" : ""} onClick={() => setTab("sync")}>
          <UploadCloud size={17} />
          同步
        </button>
        <button className={tab === "goals" ? "active" : ""} onClick={() => setTab("goals")}>
          <Target size={17} />
          目标
        </button>
      </nav>

      {tab === "dashboard" && (
        <div className="dashboard">
          <section className="agentHero">
            <div className="agentCopy">
              <span className="eyebrow">
                <Brain size={16} />
                本地观察 agent
              </span>
              <h2>{report.readiness >= 75 ? "今天可以稳步推进" : "今天适合保守一点"}</h2>
              <p>
                Agent 会根据你的记录判断训练负荷、营养完成度和恢复信号。数据保存在本机浏览器里。
              </p>
            </div>
            <div className="readinessDial" aria-label={`准备度 ${report.readiness}`}>
              <span>{report.readiness}</span>
              <small>准备度</small>
            </div>
          </section>

          <section className="metricGrid">
            <Metric
              icon={Timer}
              label="今日运动"
              value={`${report.today.workoutMinutes} 分钟`}
              detail={`本周 ${report.week.workoutMinutes}/${data.goals.weeklyWorkoutMinutes} 分钟`}
            />
            <Metric
              icon={Apple}
              label="今日蛋白质"
              value={`${report.today.protein}g`}
              detail={`目标 ${data.goals.dailyProtein}g`}
            />
            <Metric
              icon={Droplets}
              label="今日饮水"
              value={`${report.today.water}ml`}
              detail={`目标 ${data.goals.dailyWater}ml`}
            />
            <Metric
              icon={Scale}
              label="当前体重"
              value={report.body.weight ? `${report.body.weight}kg` : "未记录"}
              detail={
                report.body.bmi
                  ? `BMI ${report.body.bmi} · ${report.body.lastUpdated}`
                  : "可在记录里添加"
              }
            />
            <Metric
              icon={Flame}
              label="连续训练"
              value={`${report.streak} 天`}
              detail={`${report.week.workouts} 次 / 过去 7 天`}
            />
          </section>

          <div className="dashboardGrid">
            <Panel title="今日目标" icon={Target}>
              <ProgressRow
                label="热量"
                value={report.today.calories}
                target={data.goals.dailyCalories}
                unit="kcal"
              />
              <ProgressRow
                label="蛋白质"
                value={report.today.protein}
                target={data.goals.dailyProtein}
                unit="g"
              />
              <ProgressRow
                label="碳水"
                value={report.today.carbs}
                target={data.goals.dailyCarbs}
                unit="g"
              />
              <ProgressRow
                label="脂肪"
                value={report.today.fat}
                target={data.goals.dailyFat}
                unit="g"
              />
              <ProgressRow
                label="纤维"
                value={report.today.fiber}
                target={data.goals.dailyFiber}
                unit="g"
              />
              <ProgressRow
                label="维 C"
                value={report.today.vitaminC}
                target={data.goals.dailyVitaminC}
                unit="mg"
              />
              <ProgressRow
                label="维 D"
                value={report.today.vitaminD}
                target={data.goals.dailyVitaminD}
                unit="ug"
              />
              <ProgressRow
                label="钙"
                value={report.today.calcium}
                target={data.goals.dailyCalcium}
                unit="mg"
              />
              <ProgressRow
                label="铁"
                value={report.today.iron}
                target={data.goals.dailyIron}
                unit="mg"
              />
              <ProgressRow
                label="糖上限"
                value={report.today.sugar}
                target={data.goals.dailySugarLimit}
                unit="g"
              />
              <ProgressRow
                label="钠上限"
                value={report.today.sodium}
                target={data.goals.dailySodiumLimit}
                unit="mg"
              />
              <ProgressRow
                label="饮水"
                value={report.today.water}
                target={data.goals.dailyWater}
                unit="ml"
              />
            </Panel>

            <Panel title="7 天趋势" icon={Activity}>
              <TrendBars data={data} />
              <div className="legend">
                <span><i className="workoutDot" />运动分钟</span>
                <span><i className="proteinDot" />蛋白质完成度</span>
              </div>
            </Panel>
          </div>

          <Panel title="身体指标" icon={Ruler}>
            <div className="bodyStats">
              <Metric
                icon={Ruler}
                label="身高"
                value={report.body.height ? `${report.body.height}cm` : "未记录"}
                detail="用于 BMI 和体重趋势"
              />
              <Metric
                icon={Scale}
                label="体重目标"
                value={data.goals.targetWeight ? `${data.goals.targetWeight}kg` : "未设置"}
                detail={report.body.weight ? `当前 ${report.body.weight}kg` : "记录后显示差距"}
              />
              <Metric
                icon={Gauge}
                label="体脂 / 腰围"
                value={report.body.bodyFat ? `${report.body.bodyFat}%` : "未记录"}
                detail={report.body.waist ? `腰围 ${report.body.waist}cm` : "可选记录"}
              />
            </div>
          </Panel>

          <Panel title="Agent 洞察" icon={Brain}>
            <div className="insightList">
              {report.insights.map((insight) => (
                <InsightCard insight={insight} key={insight.id} />
              ))}
            </div>
          </Panel>
        </div>
      )}

      {tab === "record" && (
        <div className="recordGrid">
          <Panel title="添加训练" icon={Dumbbell}>
            <WorkoutForm onAdd={addWorkout} />
          </Panel>
          <Panel title="添加营养" icon={Utensils}>
            <NutritionForm onAdd={addNutrition} />
          </Panel>
          <Panel title="添加身体指标" icon={Scale}>
            <BodyMetricForm onAdd={addBodyMetric} />
          </Panel>
        </div>
      )}

      {tab === "history" && (
        <History
          data={data}
          onDeleteWorkout={(id) =>
            setData((current) => ({
              ...current,
              workouts: current.workouts.filter((entry) => entry.id !== id),
            }))
          }
          onDeleteNutrition={(id) =>
            setData((current) => ({
              ...current,
              nutrition: current.nutrition.filter((entry) => entry.id !== id),
            }))
          }
          onDeleteBodyMetric={(id) =>
            setData((current) => ({
              ...current,
              bodyMetrics: current.bodyMetrics.filter((entry) => entry.id !== id),
            }))
          }
        />
      )}

      {tab === "sync" && (
        <div className="recordGrid">
          <HealthKitImportPanel onImport={importHealthKit} />
          <Panel title="上线同步路线" icon={UploadCloud}>
            <div className="syncPanel">
              <p>
                真实线上版本建议用 Web app + 数据库 + 登录账户保存多端数据；iPhone 端用原生 HealthKit 权限读取后同步。
              </p>
              <div className="routeList">
                <span>1. 本地先完善记录体验</span>
                <span>2. 接入 Supabase/Neon + Auth</span>
                <span>3. 发布到 Vercel 或独立服务器</span>
                <span>4. 做 iOS companion 同步 HealthKit</span>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {tab === "goals" && (
        <Panel title="目标设置" icon={Settings}>
          <GoalsForm goals={data.goals} onSave={updateGoals} />
        </Panel>
      )}
    </main>
  );
}
