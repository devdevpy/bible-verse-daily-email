/** ===================== КОНФИГУРАЦИЯ ===================== */
const CFG = {
  versesSheetName: 'Verses',
  newsCount: 10,
  dailyHour: 9, // 9:00 сутринта
};

/** ===================== SCRIPT PROPERTIES ===================== */
function getOpenRouterKey_() {
  const key = PropertiesService.getScriptProperties().getProperty('OPENROUTER_API_KEY');
  if (!key) throw new Error('Липсва OPENROUTER_API_KEY в Script Properties.');
  return key;
}

function getMailTo_() {
  const to = PropertiesService.getScriptProperties().getProperty('MAIL_TO');
  if (!to) throw new Error('Липсва MAIL_TO в Script Properties.');
  return to;
}

function getFromName_() {
  return PropertiesService.getScriptProperties().getProperty('MAIL_FROM_NAME') || 'Bible Verse Bot';
}

/** ===================== GOOGLE SHEETS ===================== */
function getVersesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CFG.versesSheetName);
  if (!sh) {
    sh = ss.insertSheet(CFG.versesSheetName);
    sh.appendRow([
      'timestamp',
      'version',
      'book',
      'chapter',
      'verse',
      'text',
      'ref',
      'sent_to',
      'link',
      'news_summary'
    ]);
  }
  return sh;
}

function appendVerseRow_(en, bg, newsSummary) {
  const sh = getVersesSheet_();
  const to = getMailTo_();
  const now = new Date();

  const ref_en = en.ref || `${en.book} ${en.chapter}:${en.verse} (en-kjv)`;
  const version = (ref_en.match(/\(([^)]+)\)/)?.[1]) || 'en-kjv';
  const book_en = (en.book || '').toLowerCase();
  const chapter = Number(en.chapter || 0);
  const verse = Number(en.verse || 0);
  const link = bg.url || '';

  sh.appendRow([
    now,
    version,
    book_en,
    chapter,
    verse,
    en.text || '',
    bg.ref || '',
    to,
    link,
    newsSummary || ''
  ]);

  Logger.log('✅ Записан стих: ' + ref_en);
}

/** ===================== НОВИНИ ===================== */
function fetchBulgarianNews_() {
  try {
    const res = UrlFetchApp.fetch('https://news.google.com/rss?hl=bg&gl=BG&ceid=BG:bg');
    const xml = XmlService.parse(res.getContentText());
    const items = xml.getRootElement()
      .getChild('channel')
      .getChildren('item')
      .slice(0, CFG.newsCount)
      .map(i => i.getChildText('title'));
    return items.join('; ');
  } catch (e) {
    Logger.log('Грешка при зареждане на новини: ' + e);
    return 'Няма налични новини днес.';
  }
}

/** ===================== ИЗБОР НА СТИХ ОТ ИИ ===================== */
function chooseBibleVerseFromNews_() {
  const key = getOpenRouterKey_();
  const news = fetchBulgarianNews_();

  const prompt = `
Ти си библейски съветник. Прочети следните топ ${CFG.newsCount} новини от България:
"${news}"

Избери подходящ истински библейски стих (книга, глава и стих), който да даде надежда, вяра или мъдрост според контекста на новините.

Отговори САМО във формат JSON така:
{
  "book": "...",
  "chapter": ...,
  "verse": ...,
  "text": "..."
}

Не добавяй други обяснения извън JSON.
`;

  const payload = {
    model: 'openai/gpt-4o-mini',
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  };

  const res = UrlFetchApp.fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://example.com',
      'X-Title': 'Bible Verse Bot',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('OpenRouter HTTP ' + code + ' → ' + res.getContentText());
  }

  const data = JSON.parse(res.getContentText());
  const msg = data.choices?.[0]?.message?.content;
  
  let verse;
  try {
    verse = JSON.parse(msg);
  } catch (e) {
    const match = msg.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Неуспешен JSON parse от ИИ отговор');
    verse = JSON.parse(match[0]);
  }

  return { verse, news };
}

/** ===================== ПРЕВОД И ФОРМАТИРАНЕ ===================== */
function mapBookToBg_(en) {
  const m = {
    'genesis':'Битие','exodus':'Изход','leviticus':'Левит','numbers':'Числа','deuteronomy':'Второзаконие',
    'joshua':'Исус Навиев','judges':'Съдии','ruth':'Рут','1samuel':'1 Царе','2samuel':'2 Царе',
    '1kings':'3 Царе','2kings':'4 Царе','1chronicles':'1 Летописи','2chronicles':'2 Летописи',
    'ezra':'Ездра','nehemiah':'Неемия','esther':'Естир','job':'Йов','psalms':'Псалми','proverbs':'Притчи',
    'ecclesiastes':'Еклесиаст','songofsolomon':'Песен на песните','isaiah':'Исая','jeremiah':'Еремия',
    'lamentations':'Плач Еремиев','ezekiel':'Йезекиил','daniel':'Даниил','hosea':'Осия','joel':'Йоил',
    'amos':'Амос','obadiah':'Авдий','jonah':'Йона','micah':'Михей','nahum':'Наум','habakkuk':'Авакум',
    'zephaniah':'Софония','haggai':'Агей','zechariah':'Захария','malachi':'Малахия',
    'matthew':'Матей','mark':'Марк','luke':'Лука','john':'Йоан','acts':'Деяния',
    'romans':'Римляни','1corinthians':'1 Коринтяни','2corinthians':'2 Коринтяни',
    'galatians':'Галатяни','ephesians':'Ефесяни','philippians':'Филипяни','colossians':'Колосяни',
    '1thessalonians':'1 Солунци','2thessalonians':'2 Солунци','1timothy':'1 Тимотей','2timothy':'2 Тимотей',
    'titus':'Тит','philemon':'Филимон','hebrews':'Евреи','james':'Яков',
    '1peter':'1 Петър','2peter':'2 Петър','1john':'1 Йоан','2john':'2 Йоан','3john':'3 Йоан',
    'jude':'Юда','revelation':'Откровение'
  };
  const key = (en || '').toLowerCase();
  return m[key] || en || '';
}

function toBgVerse_(verseObj) {
  const textEn = verseObj.text || '';
  let bookEn = (verseObj.book || '').toString().toLowerCase();
  let chapter = Number(verseObj.chapter || 0);
  let verse = Number(verseObj.verse || 0);

  const bookBg = mapBookToBg_(bookEn) || bookEn;
  const refBg = (bookBg && chapter && verse)
    ? `${bookBg} ${chapter}:${verse}`
    : '(неуточнена референция)';

  let url = '';
  if (bookBg && chapter && verse) {
    const q = encodeURIComponent(`${bookBg} ${chapter}:${verse}`);
    url = `https://www.biblegateway.com/passage/?search=${q}&version=BG1940`;
  }

  return { text: textEn, ref: refBg, url };
}

/** ===================== HTML ИМЕЙЛ ===================== */
function renderReportHtml_(verse) {
  const style = `
    <style>
      body { font-family: Arial, sans-serif; line-height:1.6; color:#222; margin:0; padding:0; }
      .wrap { max-width:640px; margin:40px auto; border:1px solid #eee; padding:24px; border-radius:12px; box-shadow:0 2px 6px rgba(0,0,0,0.06); }
      h2 { margin:0 0 12px; text-align:center; color:#1a73e8; }
      .text { font-style:italic; font-size:18px; margin:0 0 10px; text-align:center; line-height:1.8; }
      .ref { margin-top:8px; font-size:14px; color:#666; text-align:center; }
      a.ref-link { color:#1a73e8; text-decoration:none; }
      a.ref-link:hover { text-decoration:underline; }
      .note { text-align:center; font-size:12px; color:#888; margin-top:12px; }
    </style>
  `;
  
  const v = verse || { text:'(няма стих)', ref:'', url:'' };
  const refHtml = v.url
    ? `<a class="ref-link" href="${v.url}" target="_blank" rel="noopener">— ${v.ref} (BG1940)</a>`
    : `— ${v.ref}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      ${style}
    </head>
    <body>
      <div class="wrap">
        <h2>📖 Стих за деня</h2>
        <p class="text">"${v.text}"</p>
        <p class="ref">${refHtml}</p>
        <div class="note">Избран на база топ ${CFG.newsCount} новини от България. Оригинал (KJV), линкът води към BG1940.</div>
      </div>
    </body>
    </html>
  `;
}

function sendReportEmail_(verse) {
  const to = getMailTo_();
  const subject = '📖 Стих за деня';
  const html = renderReportHtml_(verse);

  GmailApp.sendEmail(to, subject, '(виж HTML съдържанието)', {
    name: getFromName_(),
    htmlBody: html,
  });
  
  Logger.log('✅ Имейл изпратен до: ' + to);
}

/** ===================== ГЛАВНА ФУНКЦИЯ ===================== */
function sendDailyVerse() {
  try {
    Logger.log('🚀 Стартиране на дневна задача...');
    
    // 1. Вземи новините и избери стих
    const result = chooseBibleVerseFromNews_();
    const verseEn = result.verse;
    const news = result.news;
    
    Logger.log('📰 Новини: ' + news);
    Logger.log('📖 Избран стих: ' + JSON.stringify(verseEn));
    
    // 2. Преведи на български
    const verseBg = toBgVerse_(verseEn);
    
    // 3. Запиши в Sheets
    appendVerseRow_(verseEn, verseBg, news);
    
    // 4. Изпрати имейл
    sendReportEmail_(verseBg);
    
    Logger.log('✅ Задачата завърши успешно!');
  } catch (e) {
    Logger.log('❌ Грешка: ' + e.toString());
    throw e;
  }
}

/** ===================== ИНСТАЛАЦИЯ НА TRIGGER ===================== */
function setupDailyTrigger() {
  // Изтрий съществуващи тригери за тази функция
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'sendDailyVerse') {
      ScriptApp.deleteTrigger(t);
    }
  });
  
  // Създай нов тригер за 9:00 сутринта всеки ден
  ScriptApp.newTrigger('sendDailyVerse')
    .timeBased()
    .atHour(CFG.dailyHour)
    .everyDays(1)
    .create();
  
  Logger.log('✅ Тригер настроен за ' + CFG.dailyHour + ':00 всеки ден');
}

/** ===================== ТЕСТОВА ФУНКЦИЯ ===================== */
function testSendVerse() {
  sendDailyVerse();
}
