# Ochami — сайт

Статический сайт без фреймворка и без зависимостей. Сборка (`node build.mjs`) превращает данные и шаблоны в готовые HTML-страницы в папке `dist/`. Vercel собирает его сам при каждом обновлении.

## Что где лежит

| Путь | Что это |
|---|---|
| `content/concerts.json` | **Все данные.** `shows` — концерты (дата, артист, город, страна; по желанию `venue` и `tickets`), `artists` — фото артистов, `gallery` — кадры блока «Nights», `archiveVisibleFrom` — с какой даты архив открыт без кнопки. |
| `templates/` | Тексты страниц на английском и испанском: главная и юридическая. Метки `<!--@...-->` — места, куда сборка вставляет блоки из данных. |
| `src/styles.css` | Все стили. Цвета и шрифты — в начале файла. |
| `src/reveal.js` | Мягкое появление блоков при прокрутке. |
| `public/` | Шрифты, фото, иконки, PDF, картинка для превью ссылок. Копируется на сайт как есть. |
| `build.mjs` | Сборка: страницы концертов, архив, карта, «Nights», sitemap, файлы календаря. |

Предстоящие и прошедшие концерты разделяются по дате сборки. Прошедший концерт сам уходит в архив при следующей сборке (см. «Даты всегда актуальны»).

## Как обновлять

- **Новый концерт.** Добавить строку в `shows` в `content/concerts.json`. Страница концерта, карточка, список всех концертов, карта и счётчики появятся сами.
- **Площадка и билеты.** Добавить концерту `"venue": "ROXY Prague"` и `"tickets": "https://..."`. Вместо «Venue TBA» и «Tickets soon» появятся название и кнопка «Tickets».
- **Фото артиста.** Положить jpg в `public/photos/` и добавить запись в `artists` (`image`, `alt`, `alt_es`, `focus` — точка кадрирования).
- **Кадр в «Nights».** В `gallery` заменить пустой слот: добавить `image` и `alt`.

Тексты пишем по правилам из скилла ochami-ux-writing (копия — в документах проекта Claude).

## Посмотреть у себя

Нужен Node 20+.
```
npm run dev      # собирает и открывает http://localhost:4321
npm run build    # только сборка в dist/
```

## Выложить на Vercel (бесплатный тариф Hobby)

1. Создать репозиторий на github.com, например `ochami-site`, приватный.
2. Загрузить в него содержимое этой папки: «uploading an existing file», перетащить все файлы и папки.
3. vercel.com → Add New → Project → импортировать репозиторий. Framework preset: **Other**. Остальное Vercel прочитает из `vercel.json`.
4. Deploy. Адрес будет вида `ochami-site.vercel.app`. Каждое изменение в репозитории выкладывается само.
5. Project → Analytics → включить Web Analytics: подсчёт без cookies, баннер не нужен. Об этом уже написано на странице Legal.

Пока своего домена нет, ссылки для поисковиков и превью строятся от адреса Vercel автоматически.

## Даты всегда актуальны

1. Vercel → Project → Settings → Git → Deploy Hooks → создать хук для `main` и скопировать ссылку.
2. GitHub → репозиторий → Settings → Secrets and variables → Actions → New secret: имя `VERCEL_DEPLOY_HOOK`, значение — эта ссылка.
3. Файл `.github/workflows/daily-rebuild.yml` будет каждое утро пересобирать сайт.

## Подключить ochami.com (позже)

1. Vercel → Project → Settings → Domains → добавить `ochami.com` и `www.ochami.com`.
2. У регистратора домена прописать DNS-записи, которые покажет Vercel. Записи `MX` (почта) не трогать.
3. Vercel → Settings → Environment Variables → `SITE_URL` = `https://ochami.com`, затем Redeploy.

## Перед запуском проверить

- Legal: вместо `David [Surname]` — настоящее имя или название компании.
- Ссылки на Telegram и Instagram: сейчас `#`, нужны адреса.
- `public/ochami-one-sheet.pdf`: пока старая версия со старым логотипом.

## Лицензии

Шрифты Newsreader, IBM Plex Sans, IBM Plex Mono — SIL Open Font License, файлы в `public/fonts/`.
