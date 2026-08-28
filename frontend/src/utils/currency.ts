// Currency display helpers shared by dashboard, home, and calculator views.
const currencyFlags: Record<string, string> = {
  AUD: '🇦🇺',
  CAD: '🇨🇦',
  CHF: '🇨🇭',
  CNH: '🇨🇳',
  CNY: '🇨🇳',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
  HKD: '🇭🇰',
  JPY: '🇯🇵',
  SGD: '🇸🇬',
  USD: '🇺🇸'
};

const currencyShortLabels: Record<string, string> = {
  AUD: '호주 달러',
  CAD: '캐나다 달러',
  CHF: '스위스 프랑',
  CNH: '역외 위안',
  CNY: '위안화',
  EUR: '유로',
  GBP: '파운드',
  HKD: '홍콩 달러',
  JPY: '엔화',
  SGD: '싱가포르 달러',
  USD: '미국 달러'
};

const currencyKoreanNames: Record<string, string> = {
  AUD: '호주 달러',
  CAD: '캐나다 달러',
  CHF: '스위스 프랑',
  CNH: '역외 위안',
  CNY: '중국 위안',
  EUR: '유로',
  GBP: '영국 파운드',
  HKD: '홍콩 달러',
  JPY: '일본 엔',
  SGD: '싱가포르 달러',
  USD: '미국 달러'
};

export function getCurrencyFlag(code: string, fallback = '💱') {
  return currencyFlags[code] ?? fallback;
}

export function getCurrencyShortLabel(code: string) {
  return currencyShortLabels[code] ?? code;
}

export function getCurrencyKoreanName(code: string) {
  return currencyKoreanNames[code] ?? code;
}
