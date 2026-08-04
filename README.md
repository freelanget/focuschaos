# ФокусХаос — запуск в VS Code

## 1. Создать проект (если ещё нет)
```bash
npm create vite@latest focuschaos -- --template react
cd focuschaos
npm install
```

## 2. Установить зависимости
```bash
npm install lucide-react @supabase/supabase-js
```

## 3. Разложить файлы
- `src/FocusChaos.jsx` → в `src/FocusChaos.jsx`
- `src/lib/supabaseClient.js` → в `src/lib/supabaseClient.js`
- `src/lib/supabase_setup.sql` → просто держите рядом, это не код проекта
- `src/components/AuthPanel.jsx` → в `src/components/AuthPanel.jsx`
- `index.html` → замените корневой `index.html` (Vite) или перенесите `<head>` в `public/index.html` (CRA)

В `src/main.jsx` подключите компонент:
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import FocusChaos from './FocusChaos';
import './index.css'; // если используете Tailwind — см. шаг 4

ReactDOM.createRoot(document.getElementById('root')).render(<FocusChaos />);
```

## 4. Подключить Tailwind CSS
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```
В `tailwind.config.js` укажите:
```js
content: ['./index.html', './src/**/*.{js,jsx}'],
```
В `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## 5. Настроить Supabase (логин/пароль + сохранение прогресса)
1. Зарегистрируйтесь на supabase.com → создайте новый проект (бесплатный тариф).
2. Settings → API → скопируйте `Project URL` и `anon public` key.
3. Вставьте их в `src/lib/supabaseClient.js`.
4. SQL Editor → вставьте содержимое `src/lib/supabase_setup.sql` → Run.
5. Authentication → Providers → Email уже включён по умолчанию.
   Для быстрого тестирования без подтверждения почты можно временно
   выключить "Confirm email" — не забудьте включить обратно перед реальным запуском.

## 6. Запустить
```bash
npm run dev
```
Откроется локальный адрес (обычно `http://localhost:5173`) — всё должно быть рабочим: язык, категории, ИИ-разбор целей (пока шаблонный, см. комментарии в коде про GigaChat/YandexGPT), таймер, сейф наград, и теперь — регистрация/вход с сохранением прогресса в облаке.

## Что всё ещё нужно доделать перед реальным запуском
- Подключить GigaChat или YandexGPT вместо шаблонного генератора шагов (см. комментарий `STEP_VARIANTS` в `FocusChaos.jsx`).
- Заполнить реквизиты в оферте и политике конфиденциальности (плейсхолдеры в квадратных скобках).
- Добавить реальные логотипы вместо эмодзи-плейсхолдеров (отмечены комментариями `LOGO SLOT` в коде).
- Включить обратно "Confirm email" в Supabase перед публичным запуском.
- Заменить `og-image.png` / `favicon.png` / `apple-touch-icon.png` в `/public` на реальные картинки.
