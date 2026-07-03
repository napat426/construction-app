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
    // precipitationMm > 35
    return 'ฝนตกทั้งวัน'
  }
}

export function getWeatherIcon(code: number, weatherText: string): string {
  if (weatherText === 'แดดจัด') return '☀️'
  if (weatherText === 'ครึ้มฟ้าครึ้มฝน') return '🌤'
  if (weatherText === 'ฝนตกเล็กน้อย') return '🌧'
  if (weatherText === 'ฝนตกปานกลาง') return '🌧'
  if (weatherText === 'ฝนตกหนัก') return '⛈'
  if (weatherText === 'ฝนตกทั้งวัน') return '⛈'
  return '☁️'
}
