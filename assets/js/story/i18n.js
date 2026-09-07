/**
 * assets/js/story/i18n.js
 * 
 * Multilingual dictionaries and language detection for the Cinematic Story experience.
 */
export const STORY_I18N = {
  en: {
    loading: 'Loading cinematic journey...',
    scrollHint: 'SCROLL TO EXPLORE',
    progress: 'PROGRESS //',
    navPortfolio: 'PORTFOLIO →',
    chapters: [
      { p: 0.00, act: 'ACT I // THE THRESHOLD', title: '01 // AWAKENING AT THE CANYON' },
      { p: 0.25, act: 'ACT I // THE THRESHOLD', title: '02 // GLIDING THROUGH THE FOG' },
      { p: 0.50, act: 'ACT II // CELESTIAL SHARDS', title: '03 // AMONG THE LIVING CLOUDS' },
      { p: 0.75, act: 'ACT II // CELESTIAL SHARDS', title: '04 // APPROACHING THE SINGULARITY' },
      { p: 1.00, act: 'ACT III // HORIZON GATE', title: 'EPILOGUE // THE PORTAL CORE' }
    ],
    finale: {
      badge: 'CINEMATIC ODYSSEY',
      title: 'THE PORTAL HORIZON',
      desc: 'You have traversed the celestial canyon. Ahead lie new visual worlds, heartfelt wedding stories, and creative horizons.',
      primaryBtn: 'EXPLORE PORTFOLIO',
      secondaryBtn: 'BACK TO HOME'
    }
  },
  uk: {
    loading: 'Завантаження кінематографічної сцени...',
    scrollHint: 'ГОРТАЙТЕ ДЛЯ ПОДОРОЖІ',
    progress: 'ПРОГРЕС //',
    navPortfolio: 'ПОРТФОЛІО →',
    chapters: [
      { p: 0.00, act: 'АКТ I // ПОРІГ', title: '01 // ПРОБУДЖЕННЯ НАД КАНЬЙОНОМ' },
      { p: 0.25, act: 'АКТ I // ПОРІГ', title: '02 // ПОЛІТ КРІЗЬ ТУМАН' },
      { p: 0.50, act: 'АКТ II // НЕБЕСНІ УЛАМКИ', title: '03 // СЕРЕД ЖИВИХ ХМАР' },
      { p: 0.75, act: 'АКТ II // НЕБЕСНІ УЛАМКИ', title: '04 // НАБЛИЖЕННЯ ДО СИНГУЛЯРНОСТІ' },
      { p: 1.00, act: 'АКТ III // БРАМА ГОРИЗОНТУ', title: 'ЕПІЛОГ // СЕРЦЕ ПОРТАЛУ' }
    ],
    finale: {
      badge: 'КІНЕМАТОГРАФІЧНА ОДІССЕЯ',
      title: 'ГОРИЗОНТ ПОРТАЛУ',
      desc: 'Ви пройшли крізь небесний каньйон. Попереду — сотні історій, щирі весільні кадри та нові творчі горизонти.',
      primaryBtn: 'ПЕРЕЙТИ ДО ПОРТФОЛІО',
      secondaryBtn: 'ГОЛОВНА СТОРІНКА'
    }
  },
  da: {
    loading: 'Indlæser filmisk rejse...',
    scrollHint: 'RUL FOR AT UDFORSKE',
    progress: 'FREMGANG //',
    navPortfolio: 'PORTFOLIO →',
    chapters: [
      { p: 0.00, act: 'AKT I // BEGYNDELSEN', title: '01 // OGVÅGNING VED KLØFTEN' },
      { p: 0.25, act: 'AKT I // BEGYNDELSEN', title: '02 // GLIDENDE GENNEM TÅGEN' },
      { p: 0.50, act: 'AKT II // HIMMELSKE SKÅR', title: '03 // BLANDT DE LEVENDE SKYER' },
      { p: 0.75, act: 'AKT II // HIMMELSKE SKÅR', title: '04 // NÆRMER SIG SINGULARITETEN' },
      { p: 1.00, act: 'AKT III // HORISONTENS PORT', title: 'EPILOG // PORTALENS KERNE' }
    ],
    finale: {
      badge: 'FILMISK ODYSSÉ',
      title: 'PORTALENS HORISONT',
      desc: 'Du har rejst gennem den himmelske kløft. Forude venter nye visuelle verdener, ægte bryllupshistorier og kreative horisonter.',
      primaryBtn: 'UDFORSK PORTFOLIO',
      secondaryBtn: 'TIL FORSIDEN'
    }
  }
};

export function getActiveStoryLang() {
  if (typeof window === 'undefined') return 'en';
  try {
    const params = new URLSearchParams(window.location.search);
    const queryLang = params.get('lang');
    if (queryLang) {
      if (queryLang === 'ua' || queryLang === 'uk') return 'uk';
      if (queryLang === 'da') return 'da';
      if (queryLang === 'en') return 'en';
    }
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/uk/') || path.startsWith('/ua/')) return 'uk';
    if (path.startsWith('/da/')) return 'da';
    const stored = localStorage.getItem('deusflow_lang');
    if (stored === 'uk' || stored === 'ua') return 'uk';
    if (stored === 'da') return 'da';
  } catch (_e) {}
  return 'en';
}

export function getStoryI18n() {
  const lang = getActiveStoryLang();
  return STORY_I18N[lang] || STORY_I18N.en;
}
