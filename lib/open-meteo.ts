export interface WeatherData {
  tempF: number
  condition: string
  emoji: string
  rainChance?: number
}

const WMO: Record<number, { condition: string; emoji: string }> = {
  0:  { condition: 'Clear',           emoji: '☀️'  },
  1:  { condition: 'Mostly Clear',    emoji: '🌤️'  },
  2:  { condition: 'Partly Cloudy',   emoji: '⛅'  },
  3:  { condition: 'Overcast',        emoji: '☁️'  },
  45: { condition: 'Foggy',           emoji: '🌫️'  },
  48: { condition: 'Foggy',           emoji: '🌫️'  },
  51: { condition: 'Light Drizzle',   emoji: '🌦️'  },
  53: { condition: 'Drizzle',         emoji: '🌦️'  },
  55: { condition: 'Heavy Drizzle',   emoji: '🌧️'  },
  61: { condition: 'Light Rain',      emoji: '🌧️'  },
  63: { condition: 'Rain',            emoji: '🌧️'  },
  65: { condition: 'Heavy Rain',      emoji: '🌧️'  },
  71: { condition: 'Light Snow',      emoji: '❄️'  },
  73: { condition: 'Snow',            emoji: '❄️'  },
  75: { condition: 'Heavy Snow',      emoji: '❄️'  },
  80: { condition: 'Rain Showers',    emoji: '🌦️'  },
  81: { condition: 'Rain Showers',    emoji: '🌧️'  },
  82: { condition: 'Heavy Showers',   emoji: '🌧️'  },
  95: { condition: 'Thunderstorm',    emoji: '⛈️'  },
  96: { condition: 'Thunderstorm',    emoji: '⛈️'  },
  99: { condition: 'Thunderstorm',    emoji: '⛈️'  },
}

function cToF(c: number): number {
  return Math.round(c * 9 / 5 + 32)
}

export async function fetchForecastWeather(lat: number, lng: number, date: string): Promise<WeatherData | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&daily=temperature_2m_max,precipitation_probability_max,weathercode` +
      `&timezone=auto&start_date=${date}&end_date=${date}`,
      { cache: 'no-store' }
    )
    if (!res.ok) return null
    const data = await res.json()
    const tempC = data.daily?.temperature_2m_max?.[0]
    const code  = data.daily?.weathercode?.[0]
    const rain  = data.daily?.precipitation_probability_max?.[0] ?? 0
    if (tempC == null || code == null) return null
    const { condition, emoji } = WMO[code] ?? { condition: 'Unknown', emoji: '🌡️' }
    return { tempF: cToF(tempC), condition, emoji, rainChance: rain }
  } catch {
    return null
  }
}

export async function fetchHistoricalWeather(lat: number, lng: number, date: string): Promise<WeatherData | null> {
  try {
    const res = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}` +
      `&start_date=${date}&end_date=${date}` +
      `&daily=temperature_2m_max,precipitation_sum,weathercode&timezone=auto`
    )
    if (!res.ok) return null
    const data = await res.json()
    const tempC = data.daily?.temperature_2m_max?.[0]
    const code  = data.daily?.weathercode?.[0]
    if (tempC == null || code == null) return null
    const { condition, emoji } = WMO[code] ?? { condition: 'Unknown', emoji: '🌡️' }
    return { tempF: cToF(tempC), condition, emoji }
  } catch {
    return null
  }
}
