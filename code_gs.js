/** ===================== КОНФИГУРАЦИЯ ===================== */
const CFG = {
  versesSheetName: 'Verses',
  subscribersSheetName: 'Subscribers',
  newsCount: 10,
  dailyHour: 9,
};

/** ===================== SCRIPT PROPERTIES ===================== */
function getOpenRouterKey_() {
  const key = PropertiesService.getScriptProperties().getProperty('OPENROUTER_API_KEY');
  if (!key) throw new Error('Липсва OPENROUTER_API_KEY в Script Properties.');
  return key;
}

function getMailTo_() {
  const subscribers = getActiveSubscribers_();
  if (subscribers.length === 0) {
    const fallback = PropertiesService.getScriptProperties().getProperty('MAIL_TO');
    return fallback || '';
  }
  return subscribers.join(', ');
}

function getFromName_() {
  return PropertiesService.getScriptProperties().getProperty('MAIL_FROM_NAME') || 'Bible Verse Bot';
}

/** ===================== SUBSCRIBERS MANAGEMENT ===================== */
function getSubscribersSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CFG.subscribersSheetName);
  if (!sh) {
    sh = ss.insertSheet(CFG.subscribersSheetName);
    sh.appendRow(['timestamp', 'email', 'name', 'status', 'unsubscribed_at']);
    sh.getRange(1, 1, 1, 5).setFontWeight('bold');
  }
  return sh;
}

function getActiveSubscribers_() {
  const sh = getSubscribersSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow <= 1) return [];
  const data = sh.getRange(2, 1, lastRow - 1, 4).getValues();
  return data.filter(row => row[3] === 'active').map(row => row[1]).filter(email => email && email.includes('@'));
}

function addSubscriber_(email, name) {
  const sh = getSubscribersSheet_();
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1].toLowerCase() === email.toLowerCase()) {
      if (data[i][3] === 'unsubscribed') {
        sh.getRange(i + 1, 4).setValue('active');
        sh.getRange(i + 1, 5).setValue('');
        return { success: true, message: 'Абонаментът е възобновен!' };
      }
      return { success: false, message: 'Този имейл вече е абониран.' };
    }
  }
  sh.appendRow([new Date(), email, name, 'active', '']);
  return { success: true, message: 'Успешно абониране!' };
}

function removeSubscriber_(email) {
  const sh = getSubscribersSheet_();
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1].toLowerCase() === email.toLowerCase()) {
      if (data[i][3] === 'active') {
        sh.getRange(i + 1, 4).setValue('unsubscribed');
        sh.getRange(i + 1, 5).setValue(new Date());
        return { success: true, message: 'Успешно отписване!' };
      } else {
        return { success: false, message: 'Този имейл не е абониран.' };
      }
    }
  }
  return { success: false, message: 'Имейлът не е намерен.' };
}

/** ===================== WEB APP ENDPOINTS ===================== */
function doGet(e) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  if (e.parameter.action === 'unsubscribe') {
    const email = e.parameter.email || '';
    if (email) {
      const result = removeSubscriber_(email);
      Logger.log('Отписване: ' + email + ' → ' + result.success);
    }
    return HtmlService.createHtmlOutput('<p>✅ Успешно отписване! Няма да получавате повече имейли.</p>').addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  
  return HtmlService.createHtmlOutput('<p>Bible Verse Bot API is running</p>').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  try {
    const data = JSON.parse(e.postData.contents);
    let result = { success: false, message: 'Unknown action' };
    
    if (data.action === 'subscribe') {
      result = addSubscriber_(data.email, data.name || '');
    } else if (data.action === 'unsubscribe') {
      result = removeSubscriber_(data.email);
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type');
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

/** ===================== GOOGLE SHEETS ===================== */
function getVersesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CFG.versesSheetName);
  if (!sh) {
    sh = ss.insertSheet(CFG.versesSheetName);
    sh.appendRow(['timestamp', 'version', 'book', 'chapter', 'verse', 'text', 'ref', 'sent_to', 'link', 'news_summary']);
  }
  return sh;
}

function appendVerseRow_(en, bg, newsSummary) {
  const sh = getVersesSheet_();
  const to = getMailTo_();
  const now = new Date();
  const ref_en = en.ref || `${en.book} ${en.chapter}:${en.verse} (bg)`;
  const version = 'bg';
  const book_en = (en.book || '').toLowerCase();
  const chapter = Number(en.chapter || 0);
  const verse = Number(en.verse || 0);
  const link = bg.url || '';
  sh.appendRow([now, version, book_en, chapter, verse, en.text || '', bg.ref || '', to, link, newsSummary || '']);
  Logger.log('✅ Записан стих: ' + ref_en);
}

/** ===================== НОВИНИ ===================== */
function fetchBulgarianNews_() {
  try {
    const res = UrlFetchApp.fetch('https://news.google.com/rss?hl=bg&gl=BG&ceid=BG:bg');
    const xml = XmlService.parse(res.getContentText());
    const items = xml.getRootElement().getChild('channel').getChildren('item').slice(0, CFG.newsCount).map(i => i.getChildText('title'));
    return items.join('; ');
  } catch (e) {
    Logger.log('Грешка при зареждане на новини: ' + e);
    return 'Няма налични новини днес.';
  }
}

/** ===================== ПРОВЕРКА ЗА ПОВТОРЕНИЕ ===================== */
function getRecentVerses_(days) {
  const sh = getVersesSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow <= 1) return [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const data = sh.getRange(2, 1, lastRow - 1, 5).getValues();
  const recentVerses = [];
  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    const timestamp = new Date(row[0]);
    if (timestamp >= cutoffDate) {
      const ref = `${row[2]} ${row[3]}:${row[4]}`;
      recentVerses.push(ref.toLowerCase());
    } else {
      break;
    }
  }
  return recentVerses;
}

function isVerseDuplicate_(verse, recentVerses) {
  const ref = `${verse.book} ${verse.chapter}:${verse.verse}`.toLowerCase();
  return recentVerses.includes(ref);
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

function mapBookToEn_(bg) {
  const m = {
    'битие':'genesis','изход':'exodus','левит':'leviticus','числа':'numbers','второзаконие':'deuteronomy',
    'исуснавиев':'joshua','съдии':'judges','рут':'ruth','1царе':'1samuel','2царе':'2samuel',
    '3царе':'1kings','4царе':'2kings','1летописи':'1chronicles','2летописи':'2chronicles',
    'ездра':'ezra','неемия':'nehemiah','естир':'esther','йов':'job','псалми':'psalms','притчи':'proverbs',
    'еклесиаст':'ecclesiastes','песеннапесните':'songofsolomon','исая':'isaiah','еремия':'jeremiah',
    'плачеремиев':'lamentations','йезекиил':'ezekiel','даниил':'daniel','осия':'hosea','йоил':'joel',
    'амос':'amos','авдий':'obadiah','йона':'jonah','михей':'micah','наум':'nahum','авакум':'habakkuk',
    'софония':'zephaniah','агей':'haggai','захария':'zechariah','малахия':'malachi',
    'матей':'matthew','марк':'mark','лука':'luke','йоан':'john','деяния':'acts',
    'римляни':'romans','1коринтяни':'1corinthians','2коринтяни':'2corinthians',
    'галатяни':'galatians','ефесяни':'ephesians','филипяни':'philippians','колосяни':'colossians',
    '1солунци':'1thessalonians','2солунци':'2thessalonians','1тимотей':'1timothy','2тимотей':'2timothy',
    'тит':'titus','филимон':'philemon','евреи':'hebrews','яков':'james',
    '1петър':'1peter','2петър':'2peter','1йоан':'1john','2йоан':'2john','3йоан':'3john',
    'юда':'jude','откровение':'revelation'
  };
  const key = (bg || '').toLowerCase().replace(/\s+/g, '');
  return m[key] || bg || '';
}

function toBgVerse_(verseObj) {
  const textBg = verseObj.text || '';
  let bookBg = (verseObj.book || '').toString();
  let chapter = Number(verseObj.chapter || 0);
  let verse = Number(verseObj.verse || 0);
  const refBg = (bookBg && chapter && verse) ? `${bookBg} ${chapter}:${verse}` : '(неуточнена референция)';
  let url = '';
  if (bookBg && chapter && verse) {
    const q = encodeURIComponent(`${bookBg} ${chapter}:${verse}`);
    url = `https://www.biblegateway.com/passage/?search=${q}&version=BG1940`;
  }
  return { text: textBg, ref: refBg, url };
}

/** ===================== ИЗВЛИЧАНЕ НА БЪЛГАРСКИ ТЕКСТ ===================== */
function fetchBulgarianVerseText_(bookBg, chapter, verse) {
  try {
    Logger.log(`🔍 Извличане: ${bookBg} ${chapter}:${verse}`);
    const bookEnLower = mapBookToEn_(bookBg.toLowerCase().replace(/\s+/g, ''));
    if (!bookEnLower) {
      Logger.log(`⚠️ Непозната книга: ${bookBg}`);
      return null;
    }
    const bookNumbers = {
      'genesis':1,'exodus':2,'leviticus':3,'numbers':4,'deuteronomy':5,'joshua':6,'judges':7,'ruth':8,'1samuel':9,'2samuel':10,
      '1kings':11,'2kings':12,'1chronicles':13,'2chronicles':14,'ezra':15,'nehemiah':16,'esther':17,'job':18,'psalms':19,'proverbs':20,
      'ecclesiastes':21,'songofsolomon':22,'isaiah':23,'jeremiah':24,'lamentations':25,'ezekiel':26,'daniel':27,'hosea':28,'joel':29,
      'amos':30,'obadiah':31,'jonah':32,'micah':33,'nahum':34,'habakkuk':35,'zephaniah':36,'haggai':37,'zechariah':38,'malachi':39,
      'matthew':40,'mark':41,'luke':42,'john':43,'acts':44,'romans':45,'1corinthians':46,'2corinthians':47,
      'galatians':48,'ephesians':49,'philippians':50,'colossians':51,'1thessalonians':52,'2thessalonians':53,'1timothy':54,'2timothy':55,
      'titus':56,'philemon':57,'hebrews':58,'james':59,'1peter':60,'2peter':61,'1john':62,'2john':63,'3john':64,'jude':65,'revelation':66
    };
    const bookNum = bookNumbers[bookEnLower];
    if (!bookNum) {
      Logger.log(`⚠️ Не намерих номер за книга: ${bookEnLower}`);
      return null;
    }
    const url = `https://www.wordproject.org/bibles/bg/${bookNum}/${chapter}.htm`;
    Logger.log(`📖 ${url}`);
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    if (response.getResponseCode() !== 200) {
      Logger.log(`⚠️ HTTP ${response.getResponseCode()}`);
      return null;
    }
    const html = response.getContentText();
    const pattern = new RegExp(`<span class="verse" id="${verse}">${verse} </span>([^<]+(?:<(?!span class="verse")[^>]*>[^<]*</[^>]+>)*[^<]*)(?=<br|<span class="verse")`, 'i');
    const match = html.match(pattern);
    if (!match || !match[1]) {
      Logger.log(`⚠️ Не намерих стих ${verse}`);
      return null;
    }
    let text = match[1].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"')
      .replace(/&ldquo;|&rdquo;/g, '"').replace(/&lsquo;|&rsquo;/g, "'").replace(/&amp;/g, '&').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim();
    if (text.length < 10) {
      Logger.log(`⚠️ Текстът е твърде кратък: "${text}"`);
      return null;
    }
    Logger.log(`✅ "${text.substring(0, 80)}..."`);
    return text;
  } catch (e) {
    Logger.log(`❌ Грешка: ${e}`);
    return null;
  }
}

/** ===================== ИЗБОР НА СТИХ ОТ ИИ ===================== */
function chooseBibleVerseFromNews_() {
  const key = getOpenRouterKey_();
  const news = fetchBulgarianNews_();
  const recentVerses = getRecentVerses_(30);
  const recentList = recentVerses.length > 0 ? `\n\nИЗБЯГВАЙ следните стихове (използвани наскоро):\n${recentVerses.join(', ')}` : '';
  const allowedBooks = `СТАР ЗАВЕТ: Битие, Изход, Левит, Числа, Второзаконие, Исус Навиев, Съдии, Рут, 1 Царе, 2 Царе, 3 Царе, 4 Царе, 1 Летописи, 2 Летописи, Ездра, Неемия, Естир, Йов, Псалми, Притчи, Еклесиаст, Песен на песните, Исая, Еремия, Плач Еремиев, Йезекиил, Даниил, Осия, Йоил, Амос, Авдий, Йона, Михей, Наум, Авакум, Софония, Агей, Захария, Малахия
НОВ ЗАВЕТ: Матей, Марк, Лука, Йоан, Деяния, Римляни, 1 Коринтяни, 2 Коринтяни, Галатяни, Ефесяни, Филипяни, Колосяни, 1 Солунци, 2 Солунци, 1 Тимотей, 2 Тимотей, Тит, Филимон, Евреи, Яков, 1 Петър, 2 Петър, 1 Йоан, 2 Йоан, 3 Йоан, Юда, Откровение`;
  const prompt = `Ти си библейски съветник. Прочети топ ${CFG.newsCount} новини от България: "${news}"
СТЪПКА 1: Анализирай основните теми
СТЪПКА 2: Определи настроението
СТЪПКА 3: Избери подходящ стих
КРИТИЧНО ВАЖНО - ИЗПОЛЗВАЙ САМО: ${allowedBooks}
НЕ използвай апокрифи!
ПРАВИЛА: Избирай САМО от горния списък, използвай ТОЧНИТЕ имена на български, стихът ТРЯБВА да има връзка с новините, избери ПО-МАЛКО познат стих${recentList}
Отговори САМО във формат JSON: {"book": "...", "chapter": ..., "verse": ..., "text": ""}
ВАЖНО: Остави "text" ПРАЗЕН!`;
  let attempts = 0;
  const maxAttempts = 10;
  let lastVerse = null;
  while (attempts < maxAttempts) {
    const payload = { model: 'openai/gpt-4o-mini', temperature: 0.95 + (attempts * 0.01), response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] };
    const res = UrlFetchApp.fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'post', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://example.com', 'X-Title': 'Bible Verse Bot' },
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    if (code < 200 || code >= 300) throw new Error('OpenRouter HTTP ' + code + ' → ' + res.getContentText());
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
    const bgText = fetchBulgarianVerseText_(verse.book, verse.chapter, verse.verse);
    if (!bgText) {
      Logger.log(`❌ Не успях да извлека български текст на опит ${attempts + 1}: ${verse.book} ${verse.chapter}:${verse.verse}`);
      attempts++;
      continue;
    }
    verse.text = bgText;
    lastVerse = verse;
    if (!isVerseDuplicate_(verse, recentVerses)) {
      Logger.log(`✅ Намерен ВАЛИДЕН български стих на опит ${attempts + 1}: ${verse.book} ${verse.chapter}:${verse.verse}`);
      return { verse, news };
    }
    Logger.log(`⚠️ Дубликат открит на опит ${attempts + 1}: ${verse.book} ${verse.chapter}:${verse.verse}`);
    attempts++;
  }
  if (lastVerse && lastVerse.text) {
    Logger.log('⚠️ След 10 опита не намерих уникален стих. Използвам последния с текст.');
    return { verse: lastVerse, news };
  }
  throw new Error('След 10 опита не успях да намеря валиден библейски стих с български текст.');
}

/** ===================== HTML ИМЕЙЛ ===================== */
function renderReportHtml_(verse) {
  const style = `<style>body{font-family:Arial,sans-serif;line-height:1.6;color:#222;margin:0;padding:0}.wrap{max-width:640px;margin:40px auto;border:1px solid #eee;padding:24px;border-radius:12px;box-shadow:0 2px 6px rgba(0,0,0,0.06);background-color:#fff}h2{margin:0 0 12px;text-align:center;color:#1a73e8}.text{font-style:italic;font-size:18px;margin:0 0 10px;text-align:center;line-height:1.8}.ref{margin-top:8px;font-size:14px;color:#666;text-align:center}a.ref-link{color:#1a73e8;text-decoration:none}a.ref-link:hover{text-decoration:underline}.note{text-align:center;font-size:12px;color:#888;margin-top:12px}.unsubscribe{text-align:center;font-size:11px;color:#999;margin-top:20px;border-top:1px solid #eee;padding-top:15px}.unsubscribe a{color:#999;text-decoration:underline}</style>`;
  const v = verse || { text:'(няма стих)', ref:'', url:'' };
  const refHtml = v.url ? `<a class="ref-link" href="${v.url}" target="_blank" rel="noopener">— ${v.ref}</a>` : `— ${v.ref}`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="Content-Type" content="text/html; charset=utf-8">${style}</head><body><div class="wrap"><h2>Стих за деня</h2><p class="text">"${v.text}"</p><p class="ref">${refHtml}</p><div class="note">Избран на база топ ${CFG.newsCount} новини от България.</div><div class="unsubscribe">Не искаш повече да получаваш тези имейли? <a href="https://script.google.com/macros/d/YOUR_DEPLOYMENT_ID/usercallback?action=unsubscribe" target="_blank">Отпиши се тук</a></div></div></body></html>`;
}

function sendReportEmail_(verse) {
  const to = getMailTo_();
  if (!to) {
    Logger.log('⚠️ Няма активни subscribers.');
    return;
  }
  const subject = 'Стих за деня';
  const html = renderReportHtml_(verse);
  GmailApp.sendEmail(to, subject, '(виж HTML съдържанието)', { name: getFromName_(), htmlBody: html });
  Logger.log('✅ Имейл изпратен до: ' + to);
}

/** ===================== ГЛАВНА ФУНКЦИЯ ===================== */
function sendDailyVerse() {
  try {
    Logger.log('🚀 Стартиране на дневна задача...');
    const result = chooseBibleVerseFromNews_();
    const verseEn = result.verse;
    const news = result.news;
    Logger.log('📰 Новини: ' + news);
    Logger.log('📖 Избран стих: ' + JSON.stringify(verseEn));
    const verseBg = toBgVerse_(verseEn);
    appendVerseRow_(verseEn, verseBg, news);
    sendReportEmail_(verseBg);
    Logger.log('✅ Задачата завърши успешно!');
  } catch (e) {
    Logger.log('❌ Грешка: ' + e.toString());
    throw e;
  }
}

/** ===================== ИНСТАЛАЦИЯ НА TRIGGER ===================== */
function setupDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => { if (t.getHandlerFunction() === 'sendDailyVerse') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sendDailyVerse').timeBased().atHour(CFG.dailyHour).everyDays(1).create();
  Logger.log('✅ Тригер настроен за ' + CFG.dailyHour + ':00 всеки ден');
}

/** ===================== ТЕСТОВИ ФУНКЦИИ ===================== */
function testSendVerse() { sendDailyVerse(); }
function testSubscription() {
  Logger.log('=== ТЕСТ НА SUBSCRIBER SYSTEM ===');
  const result1 = addSubscriber_('test@example.com', 'Test User');
  Logger.log('Добавяне: ' + JSON.stringify(result1));
  const active = getActiveSubscribers_();
  Logger.log('Активни subscribers: ' + active.join(', '));
  const result2 = removeSubscriber_('test@example.com');
  Logger.log('Премахване: ' + JSON.stringify(result2));
}