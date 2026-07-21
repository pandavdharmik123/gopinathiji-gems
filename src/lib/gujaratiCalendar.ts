import { getPanchangamDetails, Observer } from '@ishubhamx/panchangam-js'

// Observer for Gujarat (Ahmedabad coordinates)
const observer = new Observer(23.0225, 72.5714, 0)

const MASA_MAP: Record<string, string> = {
  Chaitra: 'ચૈત્ર',
  Vaisakha: 'વૈશાખ',
  Vaishakha: 'વૈશાખ',
  Jyeshtha: 'જેઠ',
  Jeth: 'જેઠ',
  Ashadha: 'અષાઢ',
  Ashadh: 'અષાઢ',
  Shravana: 'શ્રાવણ',
  Shravan: 'શ્રાવણ',
  Bhadrapada: 'ભાદરવો',
  Bhadarvo: 'ભાદરવો',
  Ashvina: 'આસો',
  Aso: 'આસો',
  Kartika: 'કારતક',
  Kartik: 'કારતક',
  Margashirsha: 'માગશર',
  Magsar: 'માગશર',
  Pausha: 'પોષ',
  Posh: 'પોષ',
  Magha: 'મહા',
  Maha: 'મહા',
  Phalguna: 'ફાગણ',
  Fagan: 'ફાગણ',
}

const TITHI_MAP: Record<number, string> = {
  1: 'એકમ',
  2: 'બીજ',
  3: 'ત્રીજ',
  4: 'ચોથ',
  5: 'પાંચમ',
  6: 'છઠ',
  7: 'સાતમ',
  8: 'આઠમ',
  9: 'નોમ',
  10: 'દશમ',
  11: 'અગિયારસ',
  12: 'બારસ',
  13: 'તેરસ',
  14: 'ચૌદશ',
}

function toGujaratiDigits(num: number | string): string {
  const gujaratiDigits = ['૦', '૧', '૨', '૩', '૪', '૫', '૬', '૭', '૮', '૯']
  return String(num)
    .split('')
    .map((char) => {
      const digit = parseInt(char, 10)
      return isNaN(digit) ? char : gujaratiDigits[digit]
    })
    .join('')
}

const dateCache = new Map<string, string>()

export function getGujaratiTithi(dateInput: Date | string): string {
  let dateObj: Date
  if (typeof dateInput === 'string') {
    const parts = dateInput.split('T')[0].split('-')
    if (parts.length === 3) {
      dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0)
    } else {
      dateObj = new Date(dateInput)
    }
  } else {
    dateObj = new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate(), 12, 0, 0)
  }

  if (isNaN(dateObj.getTime())) {
    return ''
  }

  const cacheKey = dateObj.toISOString().split('T')[0]
  if (dateCache.has(cacheKey)) {
    return dateCache.get(cacheKey)!
  }

  try {
    const details = getPanchangamDetails(dateObj, observer)

    const masaName = MASA_MAP[details.masa?.name] || details.masa?.name || ''
    const adhikaStr = details.masa?.isAdhika ? 'અધિક ' : ''

    const isShukla = details.paksha === 'Shukla'
    const pakshaStr = isShukla ? 'સુદ' : 'વદ'

    const rawTithi = typeof details.tithi === 'number' ? details.tithi : ((details.tithi as any)?.index ?? 0)
    const tithiNum = (rawTithi % 15) + 1

    let tithiStr = TITHI_MAP[tithiNum] || `${tithiNum}`
    if (tithiNum === 15) {
      tithiStr = isShukla ? 'પૂનમ' : 'અમાસ'
    }

    const vikramYear = details.samvat?.vikram || dateObj.getFullYear() + 57
    const gujaratiYearStr = `વિક્રમ સંવત ${toGujaratiDigits(vikramYear)}`

    const formattedResult = `${adhikaStr}${masaName} ${pakshaStr} ${tithiStr}, ${gujaratiYearStr}`

    dateCache.set(cacheKey, formattedResult)
    return formattedResult
  } catch (error) {
    console.error('Error calculating Panchang details:', error)
    return ''
  }
}
