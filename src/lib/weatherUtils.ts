export interface WeatherData {
  temperature: number
  precipitation: number
  weather_code: number
  weather_text: string
  rain_hours_count: number
  rain_intervals?: string
  total_24h_precipitation?: number
  fallback?: boolean
}

export function getWeatherText(precipitationMm: number, weatherCode: number): string {
  if (precipitationMm === 0) {
    if (weatherCode === 0 || weatherCode === 1) {
      return 'แดดจัด'
    } else {
      return 'ครึ้มฟ้าครึ้มฝน'
    }
  } else if (precipitationMm > 0 && precipitationMm <= 2) {
    return 'ฝนตกเล็กน้อย'
  } else if (precipitationMm > 2 && precipitationMm <= 10) {
    return 'ฝนตกปานกลาง'
  } else if (precipitationMm > 10 && precipitationMm <= 35) {
    return 'ฝนตกหนัก'
  } else {
    return 'ฝนตกทั้งวัน'
  }
}

export function getWeatherIcon(code: number, weatherText: string): string {
  const w = weatherText || ''
  if (w.includes('แดดจัด') || w.includes('แจ่มใส') || w.includes('ท้องฟ้าโปร่ง')) return '☀️'
  if (w.includes('ครึ้ม') || w.includes('มีเมฆ')) return '🌤'
  if (w.includes('เล็กน้อย')) return '🌧'
  if (w.includes('ปานกลาง')) return '🌧'
  if (w.includes('หนัก') || w.includes('ทั้งวัน') || w.includes('พายุ')) return '⛈'
  if (w.includes('ฝน') || w.includes('rain')) return '🌧'
  return '☁️'
}

/**
 * Fetch and process weather data with specific focus on working hours (08:00 - 17:00).
 * Prevents non-working nighttime rain from falsely being counted as construction delay days.
 */
export async function fetchWeatherForDate(lat: number, lng: number, dateStr: string): Promise<WeatherData> {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const targetDate = new Date(dateStr)
    targetDate.setHours(0, 0, 0, 0)

    const diffDays = (today.getTime() - targetDate.getTime()) / (24 * 60 * 60 * 1000)
    const isArchive = diffDays > 5

    const endpoint = isArchive
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast'

    const url = `${endpoint}?latitude=${lat}&longitude=${lng}&start_date=${dateStr}&end_date=${dateStr}&hourly=precipitation,weather_code,temperature_2m&timezone=Asia%2FBangkok`

    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) {
      throw new Error(`Open-Meteo returned status ${res.status}`)
    }

    const data = await res.json()
    if (!data.hourly || !data.hourly.time || data.hourly.time.length === 0) {
      throw new Error('No hourly weather data returned')
    }

    const { time, precipitation, weather_code, temperature_2m } = data.hourly

    // Work shift slots: 08:00 to 17:00
    const workSlots: { hour: number; p: number; c: number; temp: number }[] = []
    let total24hPrecip = 0

    for (let i = 0; i < time.length; i++) {
      const t = time[i]
      const hour = parseInt(t.split('T')[1].split(':')[0], 10)
      const p = precipitation[i] || 0
      const c = weather_code[i] || 0
      const temp = temperature_2m[i] || 25
      total24hPrecip += p

      if (hour >= 8 && hour <= 17) {
        workSlots.push({ hour, p, c, temp })
      }
    }

    const workPrecip = workSlots.reduce((acc, s) => acc + s.p, 0)
    const workTemps = workSlots.map(s => s.temp)
    const maxWorkTemp = workTemps.length > 0 ? Math.max(...workTemps) : 25

    // Detect rainy hours during work shift (> 0.1 mm)
    const rainySlots = workSlots.filter(s => s.p > 0.1)
    const rainyHoursCount = rainySlots.length

    // Max weather code during work hours
    const maxWorkCode = workSlots.length > 0
      ? Math.max(...workSlots.map(s => s.c))
      : 0

    // Build rain interval time ranges (e.g. "14:00-16:00")
    const intervals: string[] = []
    if (rainySlots.length > 0) {
      let startH = rainySlots[0].hour
      let endH = rainySlots[0].hour
      for (let k = 1; k < rainySlots.length; k++) {
        if (rainySlots[k].hour === endH + 1) {
          endH = rainySlots[k].hour
        } else {
          intervals.push(startH === endH ? `${startH}:00-${startH + 1}:00` : `${startH}:00-${endH + 1}:00`)
          startH = rainySlots[k].hour
          endH = rainySlots[k].hour
        }
      }
      intervals.push(startH === endH ? `${startH}:00-${startH + 1}:00` : `${startH}:00-${endH + 1}:00`)
    }
    const intervalStr = intervals.length > 0 ? intervals.join(', ') : ''

    const roundedWorkPrecip = Math.round(workPrecip * 10) / 10
    const rounded24hPrecip = Math.round(total24hPrecip * 10) / 10
    const roundedTemp = Math.round(maxWorkTemp)

    // Build accurate Thai description reflecting working hours impact
    let weatherText = ''
    if (roundedWorkPrecip === 0) {
      const baseClear = (maxWorkCode <= 1) ? 'แดดจัด' : 'ครึ้มฟ้าครึ้มฝน'
      if (rounded24hPrecip > 0.5) {
        weatherText = `${baseClear} (มีฝนนอกเวลาทำงาน ${rounded24hPrecip} มม.)`
      } else {
        weatherText = baseClear
      }
    } else {
      let intensity = 'ฝนตกเล็กน้อย'
      if (roundedWorkPrecip > 2 && roundedWorkPrecip <= 10) {
        intensity = 'ฝนตกปานกลาง'
      } else if (roundedWorkPrecip > 10 && roundedWorkPrecip <= 35) {
        intensity = 'ฝนตกหนัก'
      } else if (roundedWorkPrecip > 35) {
        intensity = 'ฝนตกทั้งวัน'
      }

      if (intervalStr) {
        weatherText = `${intensity} (ช่วง ${intervalStr})`
      } else {
        weatherText = intensity
      }
    }

    return {
      temperature: roundedTemp,
      precipitation: roundedWorkPrecip,
      weather_code: maxWorkCode,
      weather_text: weatherText,
      rain_hours_count: rainyHoursCount,
      rain_intervals: intervalStr,
      total_24h_precipitation: rounded24hPrecip,
      fallback: false
    }
  } catch (error) {
    console.error('fetchWeatherForDate error:', error)
    return {
      temperature: 25,
      precipitation: 0,
      weather_code: 0,
      weather_text: 'แดดจัด',
      rain_hours_count: 0,
      total_24h_precipitation: 0,
      fallback: true
    }
  }
}
