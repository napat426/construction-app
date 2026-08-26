async function testWeather() {
  const latitude = 13.5;
  const longitude = 100.5;
  const dateStr = '2026-08-25';
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&start_date=${dateStr}&end_date=${dateStr}&daily=precipitation_sum,weather_code,temperature_2m_max&timezone=Asia/Bangkok`;
  
  console.log('Fetching weather from:', url);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('Weather API error:', res.status, res.statusText);
      return;
    }
    const data = await res.json();
    console.log('Weather API response:', JSON.stringify(data, null, 2));
    
    if (data.daily && data.daily.time && data.daily.time.length > 0) {
      const temperature = data.daily.temperature_2m_max ? data.daily.temperature_2m_max[0] : 25;
      const precipitation = data.daily.precipitation_sum ? data.daily.precipitation_sum[0] : 0;
      const weatherCode = data.daily.weather_code ? data.daily.weather_code[0] : 0;
      console.log('Extracted values:', { temperature, precipitation, weatherCode });
    }
  } catch (err) {
    console.error('Error fetching weather:', err);
  }
}

testWeather();
