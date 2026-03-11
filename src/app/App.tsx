import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, User, TrendingUp, Palette, Download, Upload } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';
import { MonthPicker } from './components/MonthPicker';
import '../styles/themes.css';

interface Habit {
  id: string;
  name: string;
  completedDays: number[];
}

interface TrackerData {
  name: string;
  month: string;
  habits: Habit[];
}

interface MonthlyData {
  habits: Habit[];
}

interface AllMonthsData {
  [monthKey: string]: MonthlyData; // e.g., "2026-03": { habits: [...] }
}

// ─── Motivational Quotes (rotates daily) ───────────────────────────────────
const MOTIVATIONAL_QUOTES = [
  { text: "Success is the product of daily habits.", author: "James Clear" },
  { text: "We are what we repeatedly do. Excellence is not an act, but a habit.", author: "Aristotle" },
  { text: "The secret of your future is hidden in your daily routine.", author: "Mike Murdock" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
  { text: "Good habits formed at youth make all the difference.", author: "Aristotle" },
  { text: "Habits change into character.", author: "Ovid" },
  { text: "First we make our habits, then our habits make us.", author: "Charles C. Noble" },
  { text: "The chains of habit are too weak to be felt until they are too strong to be broken.", author: "Samuel Johnson" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { text: "Your net worth to the world is usually determined by what remains after your bad habits are subtracted from your good ones.", author: "Benjamin Franklin" },
  { text: "Habit is a cable; we weave a thread of it each day, and at last we cannot break it.", author: "Horace Mann" },
  { text: "Depending on what they are, our habits will either make us or break us.", author: "Sean Covey" },
  { text: "A habit cannot be tossed out the window; it must be coaxed down the stairs a step at a time.", author: "Mark Twain" },
  { text: "The only way to break a bad habit is to replace it with a better one.", author: "Unknown" },
  { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" },
  { text: "You'll never change your life until you change something you do daily.", author: "John C. Maxwell" },
  { text: "Successful people are simply those with successful habits.", author: "Brian Tracy" },
  { text: "It's not what we do once in a while that shapes our lives, but what we do consistently.", author: "Tony Robbins" },
  { text: "The best way to predict the future is to create it — one habit at a time.", author: "Peter Drucker (adapted)" },
  { text: "Winners make a habit of manufacturing their own positive expectations.", author: "Brian Tracy" },
  { text: "We become what we want to be by consistently being what we want to become each day.", author: "Richard G. Scott" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "Champions don't do extraordinary things. They do ordinary things, but they do them without thinking.", author: "Charles Duhigg" },
  { text: "The hard days are the best because that's when champions are made.", author: "Gabby Douglas" },
  { text: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
  { text: "Every action you take is a vote for the type of person you wish to become.", author: "James Clear" },
  { text: "Progress, not perfection, is what we should be asking of ourselves.", author: "Julia Cameron" },
  { text: "People do not decide their futures, they decide their habits and their habits decide their futures.", author: "F.M. Alexander" },
  { text: "The secret of change is to focus all of your energy not on fighting the old, but on building the new.", author: "Socrates" },
  { text: "A journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
  { text: "What you do every day matters more than what you do once in a while.", author: "Gretchen Rubin" },
];

/**
 * Returns a deterministic quote based on the day of the year.
 * Each day gets a different quote; cycles through the list over the year.
 */
function getDailyQuote() {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((today.getTime() - startOfYear.getTime()) / 86400000);
  return MOTIVATIONAL_QUOTES[dayOfYear % MOTIVATIONAL_QUOTES.length];
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Calculate the current streak (consecutive completed days ending at the latest day)
 * and the longest streak for a habit.
 */
function getStreaks(completedDays: number[], daysInMonth: number): { current: number; longest: number } {
  if (completedDays.length === 0) return { current: 0, longest: 0 };

  const sorted = [...completedDays].sort((a, b) => a - b);

  // Find longest streak
  let longest = 1;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      streak++;
      longest = Math.max(longest, streak);
    } else {
      streak = 1;
    }
  }

  // Find current streak (must include the most recent completed day in a chain)
  let current = 1;
  for (let i = sorted.length - 1; i > 0; i--) {
    if (sorted[i] - sorted[i - 1] === 1) {
      current++;
    } else {
      break;
    }
  }

  return { current, longest };
}

/**
 * Safely parse JSON from localStorage. Returns null if parsing fails.
 */
function safeParse<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch (e) {
    console.warn(`Failed to parse localStorage key "${key}":`, e);
    localStorage.removeItem(key);
  }
  return null;
}

// ─── Constants ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'habitTrackerData';
const MONTHS_DATA_KEY = 'habitTrackerMonthsData';
const THEME_STORAGE_KEY = 'habitTrackerTheme';

type Theme = 'light' | 'dark' | 'coffee' | 'mint' | 'ocean' | 'lavender';

const themes: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'coffee', label: 'Coffee', icon: '☕' },
  { value: 'mint', label: 'Mint', icon: '🌿' },
  { value: 'ocean', label: 'Ocean', icon: '🌊' },
  { value: 'lavender', label: 'Lavender', icon: '💜' }
];

const createEmptyHabits = (): Habit[] =>
  Array.from({ length: 10 }, (_, i) => ({
    id: `habit-${i}`,
    name: '',
    completedDays: []
  }));

// ─── App Component ────────────────────────────────────────────────────────

export default function App() {
  const importInputRef = useRef<HTMLInputElement>(null);

  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return (savedTheme as Theme) || 'light';
  });

  const [data, setData] = useState<TrackerData>(() => {
    const stored = safeParse<TrackerData>(STORAGE_KEY);
    if (stored) return stored;
    return {
      name: '',
      month: new Date().toISOString().slice(0, 7),
      habits: createEmptyHabits()
    };
  });

  const [monthsData, setMonthsData] = useState<AllMonthsData>(() => {
    return safeParse<AllMonthsData>(MONTHS_DATA_KEY) || {};
  });

  // Save theme to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  // Save to localStorage whenever monthsData changes
  useEffect(() => {
    localStorage.setItem(MONTHS_DATA_KEY, JSON.stringify(monthsData));
  }, [monthsData]);

  // Save current month's habit data whenever habits change
  useEffect(() => {
    if (data.month) {
      setMonthsData(prev => ({
        ...prev,
        [data.month]: {
          habits: data.habits
        }
      }));
    }
  }, [data.habits, data.month]);

  const updateName = (name: string) => {
    setData(prev => ({ ...prev, name }));
  };

  const updateMonth = (month: string) => {
    const monthData = monthsData[month];
    setData(prev => ({
      ...prev,
      month,
      habits: monthData?.habits || createEmptyHabits()
    }));
  };

  const updateHabitName = (index: number, name: string) => {
    setData(prev => ({
      ...prev,
      habits: prev.habits.map((h, i) =>
        i === index ? { ...h, name } : h
      )
    }));
  };

  const toggleDay = (habitIndex: number, day: number) => {
    setData(prev => ({
      ...prev,
      habits: prev.habits.map((h, i) => {
        if (i !== habitIndex) return h;
        const completedDays = h.completedDays.includes(day)
          ? h.completedDays.filter(d => d !== day)
          : [...h.completedDays, day];
        return { ...h, completedDays };
      })
    }));
  };

  // Calculate daily scores
  const getDailyScore = (day: number): number => {
    return data.habits.filter(h => h.name && h.completedDays.includes(day)).length;
  };

  // Get max possible score (number of active habits)
  const maxScore = data.habits.filter(h => h.name.trim()).length;

  // Get days in selected month
  const getDaysInMonth = () => {
    if (!data.month) return 31;
    const [year, month] = data.month.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  };

  const daysInMonth = getDaysInMonth();

  // Prepare chart data (only for days in the current month)
  const chartData = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    score: getDailyScore(i + 1)
  }));

  // Daily quote
  const quote = getDailyQuote();

  // Today highlight
  const now = new Date();
  const isCurrentMonth = data.month === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const todayDate = now.getDate();

  // ─── Export / Import ─────────────────────────────────────────────────────

  const handleExport = () => {
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      trackerData: data,
      monthsData: monthsData,
      theme: theme
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `habit-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (imported.trackerData) {
          setData(imported.trackerData);
        }
        if (imported.monthsData) {
          setMonthsData(imported.monthsData);
        }
        if (imported.theme) {
          setTheme(imported.theme as Theme);
        }
        alert('✅ Data imported successfully!');
      } catch {
        alert('❌ Failed to import. The file may be corrupted or in the wrong format.');
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be imported again if needed
    event.target.value = '';
  };

  return (
    <div
      className={`theme-${theme} min-h-screen p-2 sm:p-4 md:p-8 transition-colors duration-300`}
      style={{
        background: `linear-gradient(to bottom right, var(--bg-gradient-from), var(--bg-gradient-to))`
      }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div
          className="rounded-lg shadow-lg p-4 sm:p-6 mb-4 sm:mb-6 transition-colors duration-300"
          style={{
            backgroundColor: 'var(--card-bg)',
            boxShadow: `0 10px 15px -3px var(--shadow)`
          }}
        >
          {/* Header Row: Title + Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
            <h1
              className="text-2xl sm:text-3xl text-center sm:text-left transition-colors duration-300"
              style={{ color: 'var(--text-accent)' }}
            >
              Monthly Habit Tracker
            </h1>
            <div className="flex items-center justify-center sm:justify-end gap-2 flex-shrink-0">
              {/* Export Button */}
              <button
                onClick={handleExport}
                title="Export data as JSON backup"
                className="p-1.5 sm:p-2 rounded-lg transition-all duration-300 hover:opacity-80"
                style={{
                  backgroundColor: 'var(--input-bg)',
                  border: `1px solid var(--border)`,
                  color: 'var(--text-primary)'
                }}
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              {/* Import Button */}
              <button
                onClick={() => importInputRef.current?.click()}
                title="Import data from JSON backup"
                className="p-1.5 sm:p-2 rounded-lg transition-all duration-300 hover:opacity-80"
                style={{
                  backgroundColor: 'var(--input-bg)',
                  border: `1px solid var(--border)`,
                  color: 'var(--text-primary)'
                }}
              >
                <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
              {/* Theme Selector */}
              <div className="relative">
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as Theme)}
                  className="appearance-none px-2 py-1.5 pr-7 text-xs sm:text-sm rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--input-bg)',
                    border: `1px solid var(--border)`,
                    color: 'var(--text-primary)',
                    '--tw-ring-color': 'var(--primary)'
                  } as React.CSSProperties}
                >
                  {themes.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.icon} {t.label}
                    </option>
                  ))}
                </select>
                <Palette
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
                  style={{ color: 'var(--text-secondary)' }}
                />
              </div>
            </div>
          </div>

          {/* User Details */}
          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label
                className="flex items-center gap-2 mb-2 text-sm sm:text-base transition-colors duration-300"
                style={{ color: 'var(--text-primary)' }}
              >
                <User className="w-4 h-4" />
                Name
              </label>
              <input
                type="text"
                value={data.name}
                onChange={(e) => updateName(e.target.value)}
                placeholder="Enter your name"
                maxLength={50}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg focus:outline-none focus:ring-2 transition-all duration-300"
                style={{
                  backgroundColor: 'var(--input-bg)',
                  border: `1px solid var(--border)`,
                  color: 'var(--text-primary)',
                  '--tw-ring-color': 'var(--primary)'
                } as React.CSSProperties}
              />
            </div>
            <div>
              <label
                className="flex items-center gap-2 mb-2 text-sm sm:text-base transition-colors duration-300"
                style={{ color: 'var(--text-primary)' }}
              >
                <Calendar className="w-4 h-4" />
                Month
              </label>
              <MonthPicker
                value={data.month}
                onChange={updateMonth}
              />
            </div>
          </div>
        </div>

        {/* Habit Tracking Table */}
        <div
          className="rounded-lg shadow-lg p-3 sm:p-6 mb-4 sm:mb-6 transition-colors duration-300"
          style={{
            backgroundColor: 'var(--card-bg)',
            boxShadow: `0 10px 15px -3px var(--shadow)`
          }}
        >
          <h2
            className="text-lg sm:text-xl mb-3 sm:mb-4 transition-colors duration-300"
            style={{ color: 'var(--text-primary)' }}
          >
            Daily Habit Tracker
          </h2>
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            <table className="w-full border-collapse min-w-max">
              <thead>
                <tr>
                  <th
                    className="p-1.5 sm:p-2 text-left text-xs sm:text-sm min-w-[120px] sm:min-w-[150px] sticky left-0 z-10 transition-colors duration-300"
                    style={{
                      border: `1px solid var(--border)`,
                      backgroundColor: 'var(--table-header)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    Habit
                  </th>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const isToday = isCurrentMonth && day === todayDate;
                    return (
                      <th
                        key={i}
                        className="p-1 sm:p-2 text-center text-xs sm:text-sm w-8 sm:w-10 transition-colors duration-300"
                        style={{
                          border: `1px solid ${isToday ? 'var(--primary)' : 'var(--border)'}`,
                          backgroundColor: isToday ? 'var(--primary)' : 'var(--table-header)',
                          color: isToday ? 'white' : 'var(--text-primary)',
                          fontWeight: isToday ? 700 : undefined,
                          borderRadius: isToday ? '4px 4px 0 0' : undefined
                        }}
                      >
                        {day}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.habits.map((habit, habitIndex) => {
                  const { current: currentStreak, longest: longestStreak } = getStreaks(habit.completedDays, daysInMonth);
                  const completionRate = daysInMonth > 0
                    ? Math.round((habit.completedDays.filter(d => d <= daysInMonth).length / daysInMonth) * 100)
                    : 0;

                  return (
                    <tr key={habit.id}>
                      <td
                        className="p-1.5 sm:p-2 sticky left-0 z-10 transition-colors duration-300"
                        style={{
                          border: `1px solid var(--border)`,
                          backgroundColor: 'var(--card-bg)'
                        }}
                      >
                        <input
                          type="text"
                          value={habit.name}
                          onChange={(e) => updateHabitName(habitIndex, e.target.value)}
                          placeholder={`Habit ${habitIndex + 1}`}
                          maxLength={30}
                          className="w-full px-1.5 sm:px-2 py-1 text-xs sm:text-sm rounded focus:outline-none focus:ring-1 transition-all duration-300"
                          style={{
                            backgroundColor: 'var(--input-bg)',
                            border: `1px solid var(--border-light)`,
                            color: 'var(--text-primary)',
                            '--tw-ring-color': 'var(--primary)'
                          } as React.CSSProperties}
                        />
                        {/* Streak & Rate badges below habit name */}
                        {habit.name.trim() && (
                          <div className="flex items-center gap-2 mt-1 px-0.5">
                            <span
                              className="text-[10px] sm:text-xs font-medium flex items-center gap-0.5"
                              style={{
                                color: currentStreak >= 7 ? 'var(--success)' : currentStreak >= 3 ? 'var(--warning)' : 'var(--text-secondary)'
                              }}
                              title={`Current: ${currentStreak} days | Best: ${longestStreak} days`}
                            >
                              {currentStreak > 0 && '🔥'}
                              {currentStreak}d
                              {longestStreak > currentStreak && (
                                <span className="opacity-50">/{longestStreak}</span>
                              )}
                            </span>
                            <span
                              className="text-[10px] sm:text-xs font-medium"
                              style={{
                                color: completionRate >= 70 ? 'var(--success)' : completionRate >= 40 ? 'var(--warning)' : 'var(--text-secondary)'
                              }}
                            >
                              {completionRate}%
                            </span>
                          </div>
                        )}
                      </td>
                      {Array.from({ length: daysInMonth }, (_, dayIndex) => {
                        const day = dayIndex + 1;
                        const isCompleted = habit.completedDays.includes(day);
                        const isToday = isCurrentMonth && day === todayDate;
                        return (
                          <td
                            key={day}
                            className="p-1 sm:p-2 text-center transition-colors duration-300"
                            style={{
                              border: `1px solid ${isToday ? 'var(--primary)' : 'var(--border)'}`,
                              backgroundColor: isToday ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : undefined
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isCompleted}
                              onChange={() => toggleDay(habitIndex, day)}
                              disabled={!habit.name.trim()}
                              className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 transition-all duration-300"
                              style={{
                                accentColor: 'var(--primary)'
                              }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily Score Section */}
        <div
          className="rounded-lg shadow-lg p-3 sm:p-6 mb-4 sm:mb-6 transition-colors duration-300"
          style={{
            backgroundColor: 'var(--card-bg)',
            boxShadow: `0 10px 15px -3px var(--shadow)`
          }}
        >
          <h2
            className="text-lg sm:text-xl mb-3 sm:mb-4 transition-colors duration-300"
            style={{ color: 'var(--text-primary)' }}
          >
            Daily Scores
          </h2>
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            <div className="flex gap-1.5 sm:gap-2 min-w-max sm:grid sm:grid-cols-10 md:grid-cols-15 lg:grid-cols-31">
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const score = getDailyScore(day);
                const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

                return (
                  <div key={day} className="flex flex-col items-center min-w-[44px] sm:min-w-0">
                    <div
                      className="text-[10px] sm:text-xs mb-1 transition-colors duration-300"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      D{day}
                    </div>
                    <div
                      className="w-full h-10 sm:h-12 rounded flex items-center justify-center text-xs sm:text-sm font-medium transition-all duration-300"
                      style={{
                        backgroundColor: percentage >= 70 ? 'var(--success)' : percentage >= 40 ? 'var(--warning)' : 'var(--danger)',
                        color: 'white',
                        opacity: score === 0 ? 0.3 : 1
                      }}
                    >
                      {score}/{maxScore}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Progress Graph */}
        <div
          className="rounded-lg shadow-lg p-3 sm:p-6 mb-4 sm:mb-6 transition-colors duration-300"
          style={{
            backgroundColor: 'var(--card-bg)',
            boxShadow: `0 10px 15px -3px var(--shadow)`
          }}
        >
          <h2
            className="flex items-center gap-2 text-lg sm:text-xl mb-3 sm:mb-4 transition-colors duration-300"
            style={{ color: 'var(--text-primary)' }}
          >
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            Progress Graph
          </h2>
          <div className="h-56 sm:h-64 md:h-80">
            <ResponsiveContainer width="100%" height="100%" key={`container-${data.month}`}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" key="grid" stroke="var(--border)" />
                <XAxis
                  key="xaxis"
                  dataKey="day"
                  tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                  label={{ value: 'Day of Month', position: 'insideBottom', offset: -5, fontSize: 12, fill: 'var(--text-secondary)' }}
                  stroke="var(--border)"
                />
                <YAxis
                  key="yaxis"
                  domain={[0, Math.max(maxScore, 10)]}
                  tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                  label={{ value: 'Habit Score', angle: -90, position: 'insideLeft', fontSize: 12, fill: 'var(--text-secondary)' }}
                  stroke="var(--border)"
                />
                <Tooltip
                  key="tooltip"
                  formatter={(value: number) => [`${value} habits`, 'Score']}
                  labelFormatter={(day) => `Day ${day}`}
                  contentStyle={{
                    backgroundColor: 'var(--card-bg)',
                    border: `1px solid var(--border)`,
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }}
                />
                <Line
                  key="habit-line"
                  type="monotone"
                  dataKey="score"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--primary)', r: 3 }}
                  activeDot={{ r: 5, fill: 'var(--primary-light)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Motivational Quote — changes daily */}
        <div
          className="rounded-lg shadow-lg p-6 sm:p-8 text-center transition-all duration-300"
          style={{
            background: `linear-gradient(to right, var(--primary), var(--secondary))`,
            boxShadow: `0 10px 15px -3px var(--shadow)`
          }}
        >
          <p className="text-lg sm:text-xl md:text-2xl text-white italic leading-relaxed">
            "{quote.text}"
          </p>
          <p className="mt-2 text-sm sm:text-base opacity-90" style={{ color: 'white' }}>
            — {quote.author}
          </p>
        </div>
      </div>
      <Analytics />
    </div>
  );
}