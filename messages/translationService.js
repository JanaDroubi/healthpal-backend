const axios = require('axios');
const AR_DIACRITICS = /[\u0617-\u061A\u064B-\u0652]/g;
const hasArabic = (t = '') => /[\u0600-\u06FF]/.test(t);
const normLang = (l = '') => String(l || '').trim().toLowerCase().split('-')[0];

function normalizeArabic(s = '') {
  return s
    .replace(AR_DIACRITICS, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}
function normalizeEnglish(s = '') { return s.trim().toLowerCase(); }

const quickDict = {
  ar2en: new Map([
    ['مرحبا', 'hello'], ['مرحب', 'hello'], ['مرحباً', 'hello'],
    ['اهلا', 'hello'], ['اهلاً', 'hello'], ['اهلا وسهلا', 'welcome'],
    ['اهلا وسهله', 'welcome'], ['اهلين', 'hi'], ['هلا', 'hi'],
    ['السلام عليكم', 'peace be upon you'],
    ['كيفك', 'how are you'], ['كيف حالك', 'how are you'],
    ['بخير', 'fine'], ['تمام', 'fine'], ['لا بأس', 'not bad'],
  ]),
  en2ar: new Map([
    ['hi', 'مرحبا'], ['hello', 'مرحبا'], ['hey', 'مرحبا'], ['welcome', 'اهلا وسهلا'],
    ['how are you', 'كيف حالك؟'], ['how are u', 'كيف حالك؟'], ['how r u', 'كيف حالك؟'],
    ['fine', 'بخير'], ['i am fine', 'انا بخير'], ["i'm fine", 'انا بخير'],
    ['not bad', 'لا بأس'], ['good', 'جيد'], ['thanks', 'شكرا'], ['thank you', 'شكرا'],
  ]),
};

function tryQuickDict(text, src, tgt) {
  if (!text) return null;
  if (src === 'ar' && tgt === 'en') {
    const norm = normalizeArabic(text);
    return quickDict.ar2en.get(norm) || null;
  }
  if (src === 'en' && tgt === 'ar') {
    const norm = normalizeEnglish(text);
    return quickDict.en2ar.get(norm) || null;
  }
  return null;
}

function tinyEnToArFallback(s = '') {
  const m = normalizeEnglish(s);
  if (['hi', 'hello', 'hey'].includes(m)) return 'مرحبا';
  if (m === 'fine' || m === 'fine -' || m === 'fine, fine -') return 'بخير';
  if (m === 'ok' || m === 'okay') return 'حسنًا';
  if (m === 'yes') return 'نعم';
  if (m === 'no') return 'لا';
  return null;
}

async function translateWithMyMemory(text, src, tgt) {
  const { data } = await axios.get('https://api.mymemory.translated.net/get', {
    params: { q: text, langpair: `${src}|${tgt}` },
    timeout: 8000,
  });
  const out = data?.responseData?.translatedText || '';
  if (/PLEASE\s+SELECT\s+TWO\s+DISTINCT\s+LANGUAGES/i.test(out)) return text;
  return out || text;
}


async function translateText(text, targetLang, sourceLangGuess) {
  try {
    if (!text || !targetLang) return text;

    let src = normLang(sourceLangGuess) || (hasArabic(text) ? 'ar' : 'en');
    let tgt = normLang(targetLang);
    if (src !== 'ar' && src !== 'en') src = hasArabic(text) ? 'ar' : 'en';
    if (tgt !== 'ar' && tgt !== 'en') tgt = 'en';
    if (src === tgt) return text;

    const quick = tryQuickDict(text, src, tgt);
    if (quick) return quick;

    let translated = await translateWithMyMemory(text, src, tgt);

    if (tgt === 'ar' && !hasArabic(translated)) {
      const tiny = tinyEnToArFallback(text);
      if (tiny) translated = tiny;
    }

    const same =
      normalizeEnglish(translated) === normalizeEnglish(text) ||
      normalizeArabic(translated) === normalizeArabic(text);
    if (same) {
      try {
        const retry = await translateWithMyMemory(text + '.', src, tgt);
        if (tgt === 'ar' && !hasArabic(retry)) {
          const tiny = tinyEnToArFallback(text);
          translated = tiny || retry || translated;
        } else {
          translated = retry || translated;
        }
      } catch { }
    }

    console.log('[translate]', { from: src, to: tgt, in: text, out: translated });

    return translated || text;
  } catch (e) {
    console.error('translate error:', e.message);
    return text;
  }
}

module.exports = { translateText };
