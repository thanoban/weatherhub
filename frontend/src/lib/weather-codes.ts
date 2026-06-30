const weatherCodeMap: Record<
  number,
  { label: string; icon: string; accent: string }
> = {
  0: { label: "Clear sky", icon: "☀", accent: "from-amber-300 to-orange-400" },
  1: { label: "Mostly clear", icon: "🌤", accent: "from-sky-300 to-blue-500" },
  2: { label: "Partly cloudy", icon: "⛅", accent: "from-sky-200 to-slate-400" },
  3: { label: "Overcast", icon: "☁", accent: "from-slate-300 to-slate-500" },
  45: { label: "Fog", icon: "🌫", accent: "from-slate-200 to-slate-400" },
  48: { label: "Depositing rime fog", icon: "🌫", accent: "from-slate-200 to-slate-500" },
  51: { label: "Light drizzle", icon: "🌦", accent: "from-cyan-200 to-blue-500" },
  53: { label: "Drizzle", icon: "🌦", accent: "from-cyan-300 to-blue-600" },
  55: { label: "Dense drizzle", icon: "🌧", accent: "from-cyan-300 to-indigo-700" },
  61: { label: "Light rain", icon: "🌦", accent: "from-blue-200 to-blue-600" },
  63: { label: "Rain", icon: "🌧", accent: "from-blue-300 to-blue-700" },
  65: { label: "Heavy rain", icon: "🌧", accent: "from-blue-400 to-indigo-800" },
  71: { label: "Light snow", icon: "🌨", accent: "from-slate-100 to-sky-400" },
  73: { label: "Snow", icon: "❄", accent: "from-slate-100 to-sky-500" },
  75: { label: "Heavy snow", icon: "❄", accent: "from-slate-200 to-blue-700" },
  80: { label: "Rain showers", icon: "🌦", accent: "from-cyan-200 to-blue-600" },
  81: { label: "Rain showers", icon: "🌧", accent: "from-cyan-300 to-blue-700" },
  82: { label: "Heavy showers", icon: "⛈", accent: "from-slate-400 to-indigo-900" },
  95: { label: "Thunderstorm", icon: "⛈", accent: "from-slate-500 to-indigo-950" },
  96: { label: "Thunderstorm with hail", icon: "⛈", accent: "from-slate-500 to-violet-950" },
  99: { label: "Heavy hailstorm", icon: "⛈", accent: "from-slate-600 to-violet-950" },
};

export function getWeatherCodeDetails(code: number) {
  return (
    weatherCodeMap[code] ?? {
      label: "Unknown conditions",
      icon: "☁",
      accent: "from-slate-300 to-slate-500",
    }
  );
}
