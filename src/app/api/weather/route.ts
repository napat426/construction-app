import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    const dateStr = searchParams.get('date') // YYYY-MM-DD

    if (!lat || !lng || !dateStr) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const targetDate = new Date(dateStr)
    targetDate.setHours(0, 0, 0, 0)

    const diffDays = (today.getTime() - targetDate.getTime()) / (24 * 60 * 60 * 1000)
    const isArchive = diffDays > 5

    const endpoint = isArchive
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast'

    const url = `${endpoint}?latitude=${lat}&longitude=${lng}&start_date=${dateStr}&end_date=${dateStr}&daily=precipitation_sum,weather_code,temperature_2m_max&timezone=Asia/Bangkok`

    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Open-Meteo API returned status ${res.status}`)
    }

    const data = await res.json()
    const daily = data.daily

    if (!daily || !daily.time || daily.time.length === 0) {
      throw new Error('No weather data returned in response')
    }

    const tempMax = daily.temperature_2m_max ? daily.temperature_2m_max[0] : 25
    const precip = daily.precipitation_sum ? daily.precipitation_sum[0] : 0
    const code = daily.weather_code ? daily.weather_code[0] : 0

    let weatherText = 'แดดจัด'
    if (code === 0 || code === 1) {
      weatherText = 'แดดจัด'
    } else if (code === 2 || code === 3) {
      weatherText = 'ครึ้มฟ้าครึ้มฝน'
    } else if (code >= 51 && code <= 57) {
      weatherText = 'ฝนตกเล็กน้อย'
    } else if (code >= 61 && code <= 65) {
      weatherText = 'ฝนตกปานกลาง'
    } else if (code >= 71 && code <= 77) {
      weatherText = 'ฝนตกหนัก'
    } else if (code >= 80 && code <= 82) {
      weatherText = 'ฝนตกทั้งวัน (หยุดงาน)'
    }

    return NextResponse.json({
      temperature: tempMax,
      precipitation: precip,
      weather_code: code,
      weather_text: weatherText
    })

  } catch (error: any) {
    console.error('Weather API Error:', error)
    // Fallback on error
    return NextResponse.json({
      temperature: 25,
      precipitation: 0,
      weather_code: 0,
      weather_text: 'แดดจัด',
      fallback: true
    })
  }
}
