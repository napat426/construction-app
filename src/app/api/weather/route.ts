import { NextResponse } from 'next/server'
import { fetchWeatherForDate } from '@/lib/weatherUtils'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    const dateStr = searchParams.get('date') // YYYY-MM-DD

    if (!lat || !lng || !dateStr) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const latitude = parseFloat(lat)
    const longitude = parseFloat(lng)

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
    }

    const weatherData = await fetchWeatherForDate(latitude, longitude, dateStr)
    return NextResponse.json(weatherData)

  } catch (error: any) {
    console.error('Weather API Error:', error)
    return NextResponse.json({
      temperature: 25,
      precipitation: 0,
      weather_code: 0,
      weather_text: 'แดดจัด',
      rain_hours_count: 0,
      fallback: true
    })
  }
}
