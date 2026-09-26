"use client";
import { useState, useEffect, useMemo } from "react";
import { format, subDays, eachDayOfInterval, isToday, parseISO } from "date-fns";
import { Flame, Plus, Trash2, Sun, Moon, Check, TrendingUp, Calendar, Target, Award } from "lucide-react";

type Category = "Health" | "Productivity" | "Mindfulness" | "Social";
type Habit = {
  id: string;
  name: string;
  category: Category;
  color: string;
  icon: string;
  createdAt: string;
  checkIns: string[];
};

const CATEGORY_COLORS: Record<Category, { bg: string; text: string; ring: string; dot: string }> = {
  Health: { bg: "bg-emerald-500/10", text: "text-emerald-500", ring: "ring-emerald-500/30", dot: "bg-emerald-500" },
  Productivity: { bg: "bg-blue-500/10", text: "text-blue-500", ring: "ring-blue-500/30", dot: "bg-blue-500" },
  Mindfulness: { bg: "bg-violet-500/10", text: "text-violet-500", ring: "ring-violet-500/30", dot: "bg-violet-500" },
  Social: { bg: "bg-amber-500/10", text: "text-amber-500", ring: "ring-amber-500/30", dot: "bg-amber-500" },
};

const CATEGORY_ICONS: Record<Category, string> = {
  Health: "💧", Productivity: "⚡", Mindfulness: "🧘", Social: "👋",
};

const HABIT_PRESETS = [
  { name: "Drink 8 glasses of water", category: "Health" as Category, icon: "💧" },
  { name: "Exercise 30 minutes", category: "Health" as Category, icon: "🏃" },
  { name: "Sleep 8 hours", category: "Health" as Category, icon: "😴" },
  { name: "Deep work 2 hours", category: "Productivity" as Category, icon: "🎯" },
  { name: "Read 20 pages", category: "Productivity" as Category, icon: "📚" },
  { name: "Meditate 10 minutes", category: "Mindfulness" as Category, icon: "🧘" },
  { name: "Journal", category: "Mindfulness" as Category, icon: "✍️" },
  { name: "Call a friend", category: "Social" as Category, icon: "📞" },
];

function loadHabits(): Habit[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem("habitstreak");
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function calcStreak(checkIns: string[]): { current: number; longest: number } {
  if (checkIns.length === 0) return { current: 0, longest: 0 };
  const sorted = [...new Set(checkIns)].sort();
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");

  let current = 0;
  let cursor = sorted.includes(today) ? today : sorted.includes(yesterday) ? yesterday : null;
  if (cursor) {
    const set = new Set(sorted);
    while (set.has(cursor)) {
      current++;
      cursor = format(subDays(parseISO(cursor), 1), "yyyy-MM-dd");
    }
  }

  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    if (prev) {
      const diff = (parseISO(d).getTime() - parseISO(prev).getTime()) / (1000 * 60 * 60 * 24);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest: Math.max(longest, current) };
}

export default function Home() {
  // React 19 lazy init pattern (avoids useEffect+setState lint error)
  const [habits, setHabits] = useState<Habit[]>(loadHabits);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("Health");
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem("habitstreak", JSON.stringify(habits));
  }, [habits, mounted]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("habitstreak-theme", next ? "dark" : "light");
  };

  const addHabit = () => {
    if (!newName.trim()) return;
    const habit: Habit = {
      id: Date.now().toString(),
      name: newName.trim(),
      category: newCategory,
      color: CATEGORY_COLORS[newCategory].dot,
      icon: CATEGORY_ICONS[newCategory],
      createdAt: new Date().toISOString(),
      checkIns: [],
    };
    setHabits([...habits, habit]);
    setNewName("");
    setShowAdd(false);
  };

  const deleteHabit = (id: string) => {
    setHabits(habits.filter((h) => h.id !== id));
    if (selectedHabitId === id) setSelectedHabitId(null);
  };

  const toggleCheckIn = (habitId: string, dateStr?: string) => {
    const d = dateStr || format(new Date(), "yyyy-MM-dd");
    setHabits(habits.map((h) => {
      if (h.id !== habitId) return h;
      const has = h.checkIns.includes(d);
      return { ...h, checkIns: has ? h.checkIns.filter((c) => c !== d) : [...h.checkIns, d] };
    }));
  };

  const stats = useMemo(() => {
    if (habits.length === 0) return { total: 0, todayDone: 0, rate: 0, bestCategory: null as Category | null };
    const today = format(new Date(), "yyyy-MM-dd");
    const todayDone = habits.filter((h) => h.checkIns.includes(today)).length;
    const last7 = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() });
    const possible = habits.length * 7;
    const actual = habits.reduce((sum, h) => sum + last7.filter((d) => h.checkIns.includes(format(d, "yyyy-MM-dd"))).length, 0);
    const rate = possible > 0 ? Math.round((actual / possible) * 100) : 0;
    const catRates: Record<Category, { actual: number; possible: number }> = {
      Health: { actual: 0, possible: 0 }, Productivity: { actual: 0, possible: 0 },
      Mindfulness: { actual: 0, possible: 0 }, Social: { actual: 0, possible: 0 },
    };
    for (const h of habits) {
      catRates[h.category].possible += 7;
      catRates[h.category].actual += last7.filter((d) => h.checkIns.includes(format(d, "yyyy-MM-dd"))).length;
    }
    let bestCategory: Category | null = null;
    let bestRate = -1;
    for (const cat of Object.keys(catRates) as Category[]) {
      const r = catRates[cat].possible > 0 ? catRates[cat].actual / catRates[cat].possible : 0;
      if (r > bestRate) { bestRate = r; bestCategory = cat; }
    }
    return { total: habits.length, todayDone, rate, bestCategory };
  }, [habits]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">HabitStreak</h1>
              <p className="text-xs opacity-60">Build better habits, one day at a time</p>
            </div>
          </div>
          <button onClick={toggleTheme} className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors" aria-label="Toggle theme">
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard icon={<Target className="w-5 h-5" />} label="Active Habits" value={stats.total} color="text-blue-500" />
          <StatCard icon={<Check className="w-5 h-5" />} label="Done Today" value={`${stats.todayDone}/${stats.total}`} color="text-emerald-500" />
          <StatCard icon={<TrendingUp className="w-5 h-5" />} label="7-Day Rate" value={`${stats.rate}%`} color="text-violet-500" />
          <StatCard icon={<Award className="w-5 h-5" />} label="Best Category" value={stats.bestCategory || "—"} color="text-amber-500" />
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your Habits</h2>
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors">
            <Plus className="w-4 h-4" /> Add Habit
          </button>
        </div>

        {showAdd && (
          <div className="mb-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addHabit()} placeholder="e.g. Drink 8 glasses of water" className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" autoFocus />
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CATEGORY_COLORS) as Category[]).map((cat) => (
                <button key={cat} onClick={() => setNewCategory(cat)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${newCategory === cat ? `${CATEGORY_COLORS[cat].bg} ${CATEGORY_COLORS[cat].text} ring-1 ${CATEGORY_COLORS[cat].ring}` : "bg-zinc-100 dark:bg-zinc-800 opacity-60 hover:opacity-100"}`}>{CATEGORY_ICONS[cat]} {cat}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {HABIT_PRESETS.map((p) => (
                <button key={p.name} onClick={() => { setNewName(p.name); setNewCategory(p.category); }} className="text-xs px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">{p.icon} {p.name}</button>
              ))}
            </div>
          </div>
        )}

        {habits.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
            <Flame className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <h3 className="text-lg font-semibold mb-1">No habits yet</h3>
            <p className="text-sm opacity-60 mb-4">Start building your routine by adding your first habit.</p>
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors">
              <Plus className="w-4 h-4" /> Add your first habit
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {habits.map((habit) => {
              const { current, longest } = calcStreak(habit.checkIns);
              const todayStr = format(new Date(), "yyyy-MM-dd");
              const doneToday = habit.checkIns.includes(todayStr);
              const colors = CATEGORY_COLORS[habit.category];
              return (
                <div key={habit.id} className={`group p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:shadow-md transition-all ${selectedHabitId === habit.id ? "ring-2 ring-orange-500/40" : ""}`}>
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleCheckIn(habit.id)} className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${doneToday ? `${colors.bg} ${colors.text} ring-2 ${colors.ring}` : "bg-zinc-100 dark:bg-zinc-800 opacity-60 hover:opacity-100"}`}>{doneToday ? <Check className="w-5 h-5" /> : habit.icon}</button>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedHabitId(selectedHabitId === habit.id ? null : habit.id)}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{habit.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${colors.bg} ${colors.text}`}>{habit.category}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs opacity-60">
                        <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500" /> {current} day streak</span>
                        <span>Best: {longest}</span>
                        <span>{habit.checkIns.length} total</span>
                      </div>
                    </div>
                    <button onClick={() => deleteHabit(habit.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  {selectedHabitId === habit.id && (
                    <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold uppercase opacity-60 flex items-center gap-1"><Calendar className="w-3 h-3" /> Last 30 days</h4>
                        <span className="text-xs opacity-60">{habit.checkIns.length} check-ins</span>
                      </div>
                      <Heatmap checkIns={habit.checkIns} days={30} onToggle={(d) => toggleCheckIn(habit.id, d)} colorDot={colors.dot} />
                      <p className="text-[10px] opacity-50 mt-2">Click any day to toggle a check-in.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <footer className="mt-12 text-center text-xs opacity-50">
          <p>All data is stored locally in your browser. No account needed.</p>
        </footer>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="flex items-center gap-1.5 text-xs opacity-60 mb-1">
        <span className={color}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function Heatmap({ checkIns, days, onToggle, colorDot }: { checkIns: string[]; days: number; onToggle: (dateStr: string) => void; colorDot: string }) {
  const today = new Date();
  const cells = Array.from({ length: days }, (_, i) => {
    const d = subDays(today, days - 1 - i);
    const dateStr = format(d, "yyyy-MM-dd");
    const checked = checkIns.includes(dateStr);
    return { dateStr, checked, isToday: isToday(d), label: format(d, "MMM d") };
  });
  return (
    <div className="flex flex-wrap gap-1">
      {cells.map((c) => (
        <button key={c.dateStr} onClick={() => onToggle(c.dateStr)} title={`${c.label}${c.checked ? " ✓" : ""}`} className={`w-5 h-5 rounded-sm transition-all hover:scale-110 ${c.checked ? colorDot : "bg-zinc-100 dark:bg-zinc-800"} ${c.isToday ? "ring-2 ring-orange-500/50" : ""}`} />
      ))}
    </div>
  );
}
