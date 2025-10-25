// services/translationService.js
const axios = require('axios');

// كشف عربي
const AR_DIACRITICS = /[\u0617-\u061A\u064B-\u0652]/g;
const hasArabic = (t='') => /[\u0600-\u06FF]/.test(t);
const normLang = (l='') => String(l).toLowerCase().split('-')[0].trim();

function normalizeArabic(s='') {
  return s
    .replace(AR_DIACRITICS, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}
function normalizeEnglish(s=''){ return s.trim().toLowerCase(); }

// قاموس سريع للكلمات/التحيات الشائعة
const quickDict = {
  ar2en: new Map([
    ['مرحبا','hello'],
    ['مرحب','hello'],
    ['مرحباً','hello'],
    ['اهلا','hello'],
    ['اهلاً','hello'],
    ['اهلا وسهلا','welcome'],
    ['اهلا وسهله','welcome'],
    ['اهلين','hi'],
    ['هلا','hi'],
    ['السلام عليكم','peace be upon you'],
  ]),
  en2ar: new Map([
    ['hi','مرحبا'],
    ['hello','مرحبا'],
    ['hey','مرحبا'],
    ['welcome','اهلا وسهلا'],
    ['peace be upon you','السلام عليكم'],
  ]),
};

function tryQuickDict(text, src, tgt) {
  if (!text) return null;
  if (src==='ar' && tgt==='en') {
    const norm = normalizeArabic(text);
    const hit = quickDict.ar2en.get(norm);
    if (hit) return hit;
  }
  if (src==='en' && tgt==='ar') {
    const norm = normalizeEnglish(text);
    const hit = quickDict.en2ar.get(norm);
    if (hit) return hit;
  }
  return null;
}

// تصحيح عربي مكتوب بلوحة إنجليزية (اختياري)
const kbMap = {
  a:'ش', b:'لا', c:'ؤ', d:'ي', e:'ث', f:'ب', g:'ل', h:'ا',
  i:'ه', j:'ت', k:'ن', l:'م', m:'ة', n:'ى', o:'خ', p:'ح',
  q:'ض', r:'ق', s:'س', t:'ف', u:'ع', v:'ر', w:'ص', x:'ء',
  y:'غ', z:'ئ'
};
function fixEnglishToArabicKeyboard(text){
  return text.split('').map(ch => kbMap[ch.toLowerCase()] || ch).join('');
}

// MyMemory (مجاني)
async function translateWithMyMemory(text, src, tgt) {
  if (!src || !tgt || src === tgt) return text; // منع رسالة distinct
  const { data } = await axios.get('https://api.mymemory.translated.net/get', {
    params: { q: text, langpair: `${src}|${tgt}` },
    timeout: 8000,
  });
  const out = data?.responseData?.translatedText || '';
  if (/PLEASE\s+SELECT\s+TWO\s+DISTINCT\s+LANGUAGES/i.test(out)) return text;
  return out || text;
}

/**
 * translateText(text, targetLang, sourceLangGuess)
 * - يستخدم قاموس سريع للتحيات الشائعة
 * - يصلّح “عربي بالكيبورد الإنجليزي” للمرسل العربي إن لزم
 * - يترجم عبر MyMemory مع فلترة الأخطاء المعروفة
 */
async function translateText(text, targetLang, sourceLangGuess) {
  try {
    if (!text || !targetLang) return text;

    const src = normLang(sourceLangGuess) || (hasArabic(text) ? 'ar' : 'en');
    const tgt = normLang(targetLang);
    if (src === tgt) return text;

    // قاموس سريع
    const quick = tryQuickDict(text, src, tgt);
    if (quick) return quick;

    // تصحيح كيبورد لو المرسل عربي والنص لاتيني
    let prepared = text;
    if (src === 'ar' && !hasArabic(text) && /[a-zA-Z]/.test(text)) {
      prepared = fixEnglishToArabicKeyboard(text);
    }

    // MyMemory
    const translated = await translateWithMyMemory(prepared, src, tgt);
    return translated || prepared;
  } catch (e) {
    console.error('translate error:', e.message);
    return text; // فشل: رجّع الأصل
  }
}

module.exports = { translateText };
