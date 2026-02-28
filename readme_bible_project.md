# 📖 Bible Verse Daily Email Bot

Автоматична система за изпращане на ежедневен библейски стих, избран от ИИ на база актуалните топ 10 новини от България.

## 🎯 Какво прави проектът?

Всеки ден в **9:00 сутринта** системата:
1. 📰 Взима топ 10 новини от България (Google News RSS)
2. 🤖 Използва AI (GPT-4o-mini) да избере подходящ библейски стих според контекста на новините
3. 📧 Изпраща стиха по имейл в красив HTML формат
4. 📊 Записва всичко в Google Sheets за история
5. 👥 Поддържа subscriber система за публични абонаменти

## ✨ Характеристики

- ✅ Автоматично ежедневно изпращане
- ✅ Интелигентен избор на стих според актуалните новини
- ✅ Стихове от цялата Библия (66 книги)
- ✅ Български текст от wordproject.org
- ✅ Българска референция + линк към BG1940 превод
- ✅ История на изпратените стихове в Google Sheets
- ✅ Красив HTML имейл дизайн
- ✅ Публична абонамент форма
- ✅ Subscriber management система

## 🛠️ Технологии

- **Google Apps Script** - автоматизация
- **OpenRouter API** - AI модел (GPT-4o-mini)
- **Google Sheets** - база данни за история и subscribers
- **Gmail API** - изпращане на имейли
- **Google News RSS** - извличане на новини
- **wordproject.org** - български библейски текстове

## 📋 Предварителни изисквания

1. **Google акаунт** с достъп до Google Sheets
2. **OpenRouter API ключ** (безплатен trial или платен)
   - Регистрация: https://openrouter.ai/
3. **Gmail** за изпращане на имейлите

## 🚀 Инсталация

### Стъпка 1: Създай Google Sheets таблица

1. Отвори [Google Sheets](https://sheets.google.com)
2. Създай нова таблица (напр. "Bible Verses")
3. Отвори **Extensions** → **Apps Script**

### Стъпка 2: Добави кода

1. Изтрий съществуващия код в `Code.gs`
2. Копирай целия код от `Code.gs` в този проект
3. Запази (Ctrl+S или File → Save)

### Стъпка 3: Настрой Script Properties

1. В Apps Script редактора: **Project Settings** (иконата със зъбно колело) → **Script Properties**
2. Добави следните properties:

| Key | Value | Описание |
|-----|-------|----------|
| `OPENROUTER_API_KEY` | `sk-or-v1-xxxxx` | Твоят OpenRouter API ключ |
| `MAIL_TO` | `your@email.com` | Fallback имейл (опционално, ако нямаш subscribers) |
| `MAIL_FROM_NAME` | `Bible Verse Bot` | Име на изпращача (по избор) |

### Стъпка 4: Deploy Web App (за subscriber форма)

1. Кликни **Deploy** → **New deployment**
2. Избери тип: **Web app**
3. Настройки:
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Кликни **Deploy**
5. **Копирай URL-а** (ще ти трябва за index.html)

### Стъпка 5: Публикувай абонамент формата

1. Редактирай `index.html`
2. Замени `const SCRIPT_URL = '...'` с твоя Web App URL
3. Качи `index.html` в GitHub Pages или Netlify

### Стъпка 6: Разреши достъпи

1. Изпълни функцията `testSendVerse()` (Play бутон ▶️)
2. Разреши достъп до:
   - Google Sheets
   - Gmail
   - External API calls

### Стъпка 7: Настрой автоматизация

1. Изпълни функцията `setupDailyTrigger()`
2. Това ще настрои автоматично изпращане всеки ден в 9:00

## 📁 Структура на проекта

```
bible-verse-daily-email/
├── Code.gs                 # Основен код на проекта
├── index.html             # Публична абонамент форма
├── README.md              # Документация (този файл)
├── LICENSE                # MIT лиценз
└── .gitignore            # Git ignore файл
```

## 🔧 Конфигурация

Можеш да промениш настройките в секцията **КОНФИГУРАЦИЯ** на кода:

```javascript
const CFG = {
  versesSheetName: 'Verses',      // Име на листа за стихове
  subscribersSheetName: 'Subscribers', // Име на листа за subscribers
  newsCount: 10,                  // Брой новини за анализ (1-20)
  dailyHour: 9,                   // Час за изпращане (0-23)
};
```

## 📊 Google Sheets структура

### Лист "Verses" - История на изпратените стихове

| Колона | Описание |
|--------|----------|
| `timestamp` | Дата и час на изпращане |
| `version` | Версия на библията (bg) |
| `book` | Книга (на български) |
| `chapter` | Глава |
| `verse` | Стих |
| `text` | Текст на стиха (български) |
| `ref` | Референция (български) |
| `sent_to` | Имейл получатели |
| `link` | Линк към BG1940 превод |
| `news_summary` | Резюме на новините |

### Лист "Subscribers" - Управление на абонати

| Колона | Описание |
|--------|----------|
| `timestamp` | Дата на абониране |
| `email` | Имейл адрес |
| `name` | Име (опционално) |
| `status` | active / unsubscribed |
| `unsubscribed_at` | Дата на отписване |

## 🧪 Тестване

### Тест на цялата система
```javascript
testSendVerse()
```

### Тест на subscriber системата
```javascript
testSubscription()
```

### Проверка на тригера
```javascript
setupDailyTrigger()
```

За да видиш активните тригери:
1. Apps Script Editor → **Triggers** (иконата с часовник) ⏰
2. Трябва да видиш тригер за `sendDailyVerse` на ежедневна база

## 📧 Пример имейл

```
┌─────────────────────────────────────┐
│     Стих за деня                    │
├─────────────────────────────────────┤
│                                     │
│  "И Господ ще бъде прибежище на     │
│   угнетените, Прибежище в скръбни   │
│   времена."                         │
│                                     │
│      — Псалми 9:9                  │
│                                     │
│  Избран на база топ 10 новини      │
│  от България.                       │
└─────────────────────────────────────┘
```

## 👥 Публична абонамент форма

Хората могат да се абонират/отпишат през публичната HTML форма:
- Красив responsive дизайн
- Tabs за Subscribe / Unsubscribe
- Real-time валидация
- Success/Error съобщения

## 🔍 Troubleshooting

### Имейлът не се изпраща
- Провери дали има активни subscribers в листа "Subscribers"
- Провери Gmail квотата (100 имейла/ден за безплатен акаунт)
- Виж логовете: View → Logs (Ctrl+Enter)

### ИИ връща грешка
- Провери дали `OPENROUTER_API_KEY` е валиден
- Провери OpenRouter баланса: https://openrouter.ai/credits
- Модел `openai/gpt-4o-mini` е достъпен и евтин (~$0.15 / 1M tokens)

### Новините не се зареждат
- Google News RSS понякога е бавен - това е нормално
- Системата има fallback: "Няма налични новини днес"

### Повтарящи се стихове
- Системата проверява последните 30 дни автоматично
- ИИ може да избере популярни стихове - temperature е настроен на 0.95
- Провери дали новините се обновяват (в колона `news_summary`)

### Subscriber формата не работи
- Провери дали Web App е deploy-нат с "Anyone" access
- Провери дали `SCRIPT_URL` в index.html е правилен
- Отвори Developer Console в браузъра за грешки

## 🔒 Сигурност

- ❌ **НИКОГА не качвай** `OPENROUTER_API_KEY` в GitHub
- ✅ Ключовете са в Script Properties (не в кода)
- ✅ Използвай `.gitignore` за локални конфигурации
- ✅ Web App работи без да излага API ключове

## 💡 Бъдещи подобрения

- [ ] Password защита на абонамент формата
- [ ] Email verification при абониране
- [ ] Whitelist система за ограничен достъп
- [ ] Multi-language support (повече езици)
- [ ] Различни преводи на библията
- [ ] SMS изпращане вместо имейл
- [ ] Webhook интеграции (Slack, Discord, Telegram)
- [ ] Analytics dashboard

## 🤝 Принос

Contributions са добре дошли! Моля:

1. Fork-ни проекта
2. Създай feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit промените (`git commit -m 'Add some AmazingFeature'`)
4. Push към branch (`git push origin feature/AmazingFeature`)
5. Отвори Pull Request

## 📄 Лиценз

Този проект е лицензиран под MIT License - виж [LICENSE](LICENSE) файла за детайли.

## 👤 Автор

Създадено с ❤️ за ежедневна духовна инспирация

## 🙏 Благодарности

- [OpenRouter](https://openrouter.ai/) - AI API platform
- [WordProject](https://www.wordproject.org/) - Български библейски текстове
- [Google News](https://news.google.com/) - RSS новини
- Всички contributors на проекта

## 📞 Контакт

Имаш въпроси или предложения? Отвори Issue в GitHub!

---

⭐ Харесва ли ти проекта? Дай звездичка в GitHub! ⭐