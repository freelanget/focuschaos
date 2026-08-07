import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Timer as TimerIcon, Trophy, Lock, Zap, Play, Pause, Globe2, Check, Plus,
  Star, Flame, Cpu, Sunrise, Award, X, Briefcase, Dumbbell, Home,
  Lightbulb, HelpCircle, ChevronLeft, ChevronRight, Bell, CalendarDays,
  Users, FolderKanban, Wallet, Pencil, Smartphone, MessageSquareQuote,
} from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import AuthPanel from './components/AuthPanel';
import { useAuthUser } from './lib/useAuthUser';

/* ------------------------------------------------------------------------ */
/*  FAVICON / LOGO — production deploy note                                 */
/*  ------------------------------------------------------------------------ */
/*  For a real deployment, drop your logo files into /public and reference   */
/*  them from public/index.html, e.g.:                                       */
/*    <link rel="icon" type="image/png" href="/favicon-32x32.png" />         */
/*    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />           */
/*  Below, useFavicon() injects a lightweight SVG favicon at runtime so the   */
/*  tab icon is correct even before you swap in real assets. Swap             */
/*  FAVICON_SVG for your real logo markup, or point `href` at a hosted URL.  */
/* ------------------------------------------------------------------------ */
const FAVICON_SVG = `
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
    <circle cx='32' cy='32' r='30' fill='#0f172a' stroke='#10B981' stroke-width='3'/>
    <path d='M35 10 L18 36 H30 L28 54 L47 26 H34 Z' fill='#F59E0B'/>
  </svg>
`;

function useFavicon(title) {
  useEffect(() => {
    try {
      const href = 'data:image/svg+xml,' + encodeURIComponent(FAVICON_SVG);
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = href;
      if (title) document.title = title;
    } catch (e) {
      /* document/head not available in this render context — safe to ignore */
    }
  }, [title]);
}

/* ------------------------------------------------------------------------ */
/*  PERSISTENCE                                                             */
/*  ------------------------------------------------------------------------ */
/*  Real save/load via localStorage, guarded with try/catch. In a normal     */
/*  browser (i.e. once this runs in your own VS Code / Vite / CRA project)   */
/*  this genuinely survives refreshes. If it ever runs inside a sandboxed     */
/*  preview that blocks storage access, it fails silently and the app just   */
/*  falls back to in-memory state for that session — nothing crashes.        */
/* ------------------------------------------------------------------------ */
const STORAGE_KEY = 'focuschaos_state_v1';

function loadPersisted() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function savePersisted(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    /* storage unavailable — state simply won't survive a refresh this time */
  }
}

function dateKeyOf(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayKey() {
  return dateKeyOf(new Date());
}

// Returns the 7 dates (Mon..Sun) of the week containing `dateKeyStr`.
function getWeekDates(dateKeyStr) {
  const d = new Date(dateKeyStr + 'T00:00:00');
  const weekday = (d.getDay() + 6) % 7; // 0 = Mon .. 6 = Sun
  const monday = new Date(d);
  monday.setDate(d.getDate() - weekday);
  return Array.from({ length: 7 }).map((_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day;
  });
}

function formatTimeHHMM(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

/* ---------------------------------------------------------------------- */
/*  Global styles                                                         */
/* ---------------------------------------------------------------------- */
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

    .fc-root { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
    .fc-display { font-family: 'Sora', ui-sans-serif, system-ui, sans-serif; }
    .fc-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }

    .fc-blob { display: none; }

    .fc-card {
      position: relative;
      background: #FFFFFF;
      border: 1px solid #E7E9ED;
      transition: border-color .2s ease, box-shadow .2s ease;
      box-shadow: 0 1px 2px rgba(20,25,35,0.04);
    }
    .fc-card::before { content: none; }
    .fc-glow-mint { }
    .fc-glow-mint:hover { border-color: #CDBFF0; box-shadow: 0 4px 16px -6px rgba(55,138,221,0.25); }
    .fc-glow-amber { }
    .fc-glow-amber:hover { border-color: #FAC775; box-shadow: 0 4px 16px -6px rgba(239,159,39,0.25); }

    @keyframes fc-cta-pulse {
      0%, 100% { box-shadow: 0 0 22px -2px rgba(249,115,22,0.75), 0 0 0 0 rgba(249,115,22,0.4); }
      50% { box-shadow: 0 0 34px 2px rgba(249,115,22,1), 0 0 0 6px rgba(249,115,22,0); }
    }
    .fc-cta-pulse { animation: fc-cta-pulse 2.2s ease-in-out infinite; }

    .fc-input-glow:focus { border-color: rgba(94,234,212,0.7); box-shadow: 0 0 0 3px rgba(45,212,191,0.2), 0 0 24px -4px rgba(45,212,191,0.6); }

    @keyframes fc-slide-down {
      from { opacity: 0; transform: translateY(-8px); max-height: 0; }
      to { opacity: 1; transform: translateY(0); max-height: 400px; }
    }
    .fc-slide-down { animation: fc-slide-down .35s cubic-bezier(.2,.8,.3,1) both; overflow: hidden; }

    @keyframes fc-float-xp {
      0% { opacity: 0; transform: translate(-50%, 0) scale(0.8); }
      15% { opacity: 1; transform: translate(-50%, -6px) scale(1.1); }
      75% { opacity: 1; transform: translate(-50%, -30px) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -42px) scale(0.95); }
    }
    .fc-float-xp { animation: fc-float-xp .9s ease-out forwards; }

    @keyframes fc-triumph-flash {
      0% { box-shadow: 0 0 0 0 rgba(52,211,153,0.9), 0 0 0 0 rgba(52,211,153,0.6); transform: scale(1); }
      35% { box-shadow: 0 0 34px 6px rgba(52,211,153,0.9), 0 0 60px 14px rgba(52,211,153,0.4); transform: scale(1.06); }
      100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); transform: scale(1); }
    }
    .fc-triumph-flash { animation: fc-triumph-flash .6s ease-out; }

    @keyframes fc-magnet-in {
      0% { transform: translateX(28px) scale(0.9); opacity: 0; }
      60% { transform: translateX(-3px) scale(1.02); opacity: 1; }
      100% { transform: translateX(0) scale(1); opacity: 1; }
    }
    .fc-magnet-in { animation: fc-magnet-in .5s cubic-bezier(.2,.8,.3,1.4) both; }

    @keyframes fc-blink { 0%, 45% { opacity: 1; } 50%, 100% { opacity: 0; } }
    .fc-cursor { animation: fc-blink 1s step-end infinite; }

    @keyframes fc-pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
    .fc-pulse-dot { animation: fc-pulse-dot 1.8s ease-in-out infinite; }

    @keyframes fc-bob { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-7px) rotate(2deg); } }
    .fc-anim-bob { animation: fc-bob 3.4s ease-in-out infinite; }

    @keyframes fc-core-pulse {
      0%,100% { box-shadow: 0 0 20px 2px rgba(45,212,191,0.5), 0 0 44px 10px rgba(45,212,191,0.22); }
      50% { box-shadow: 0 0 30px 8px rgba(45,212,191,0.8), 0 0 60px 16px rgba(45,212,191,0.35); }
    }
    .fc-core-pulse { animation: fc-core-pulse 2.4s ease-in-out infinite; }

    @keyframes fc-pop { 0% { transform: scale(0.94); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    .fc-anim-pop { animation: fc-pop .3s ease-out; }

    @keyframes fc-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .fc-anim-spin-slow { animation: fc-spin-slow 7s linear infinite; }

    @keyframes fc-ring-pulse { 0%,100% { filter: drop-shadow(0 0 3px currentColor); } 50% { filter: drop-shadow(0 0 12px currentColor); } }
    .fc-ring-pulse { animation: fc-ring-pulse 1.6s ease-in-out infinite; }

    @keyframes fc-spark {
      0% { transform: translate(0,0) scale(1) rotate(var(--r,0deg)); opacity: 1; }
      100% { transform: translate(var(--x,0px), var(--y,0px)) scale(0.2) rotate(var(--r,0deg)); opacity: 0; }
    }
    .fc-spark { animation: fc-spark 0.9s cubic-bezier(.2,.8,.3,1) forwards; }

    @keyframes fc-unlock-flash {
      0% { filter: grayscale(0.6) brightness(0.7); }
      40% { filter: grayscale(0) brightness(1.5); }
      100% { filter: grayscale(0) brightness(1); }
    }
    .fc-anim-unlock { animation: fc-unlock-flash .7s ease-out; }

    @keyframes fc-invite-pulse {
      0%,100% { border-color: rgba(148,163,184,0.25); box-shadow: 0 0 0 0 rgba(148,163,184,0.15); }
      50% { border-color: rgba(203,213,225,0.45); box-shadow: 0 0 12px 0 rgba(203,213,225,0.18); }
    }
    .fc-invite { animation: fc-invite-pulse 2.6s ease-in-out infinite; }

    @keyframes fc-toast-in { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .fc-toast-in { animation: fc-toast-in .35s ease-out; }

    @keyframes fc-modal-in { from { transform: scale(0.95) translateY(6px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
    .fc-modal-in { animation: fc-modal-in .25s ease-out; }

    @keyframes fc-fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .fc-fade-up { animation: fc-fade-up .5s ease-out both; }

    .fc-root button:focus-visible,
    .fc-root input:focus-visible,
    .fc-root [tabindex]:focus-visible {
      outline: 2px solid #5EEAD4;
      outline-offset: 2px;
      border-radius: 8px;
    }

    @media (prefers-reduced-motion: reduce) {
      .fc-root *, .fc-root *::before, .fc-root *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
      }
    }

    .fc-scrollbar::-webkit-scrollbar { width: 6px; }
    .fc-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 999px; }
  `}</style>
);

/* ---------------------------------------------------------------------- */
/*  Category visual accents (independent of language)                     */
/* ---------------------------------------------------------------------- */
const CATEGORY_STYLE = {
  work: { grad: 'linear-gradient(135deg,#A797C4,#8A7BA8)', ring: 'rgba(138,123,168,0.55)', icon: Briefcase },
  fitness: { grad: 'linear-gradient(135deg,#E8A0AC,#D4798A)', ring: 'rgba(212,121,138,0.55)', icon: Dumbbell },
  personal: { grad: 'linear-gradient(135deg,#A8BC96,#8FA482)', ring: 'rgba(143,164,130,0.55)', icon: Home },
  clients: { grad: 'linear-gradient(135deg,#38BDF8,#0284C7)', ring: 'rgba(56,189,248,0.65)', icon: Users },
  projects: { grad: 'linear-gradient(135deg,#A855F7,#7C3AED)', ring: 'rgba(168,85,247,0.65)', icon: FolderKanban },
  finance: { grad: 'linear-gradient(135deg,#34D399,#059669)', ring: 'rgba(52,211,153,0.65)', icon: Wallet },
};
const CATEGORY_IDS_BY_MODE = {
  personal: ['work', 'fitness', 'personal'],
  business: ['clients', 'projects', 'finance'],
};
const CATEGORY_IDS = CATEGORY_IDS_BY_MODE.personal;

/* ---------------------------------------------------------------------- */
/*  Translations                                                          */
/* ---------------------------------------------------------------------- */
const T = {
  ru: {
    appName: 'ФокусХаос',
    tagline: 'Впиши цель — получи понятный план и фокус, чтобы её достичь',
    consoleLabel: 'СИСТЕМА',
    consoleName: 'Гриша',
    consoleSub: 'AI-напарник по фокусу',
    statusOnline: 'ГОТОВ',
    statusIdle: 'ПРОСТОЙ',
    statusSuccess: 'УСПЕХ',
    petIdle: [
      'Твой блог сам себя не монетизирует. Инстаграм подождёт.',
      'Статус: простой. Продуктивность: под вопросом.',
      'Ещё один скролл — и я начну считать это саботажем.',
      'Дедлайны не переносятся силой мысли.',
      'Кажется, кто-то путает «отдых» с «прокрастинацией».',
      'Пятая минута созерцания потолка. Впечатляет. Но не то.',
      'Алгоритм соцсети радуется. Твои цели — нет.',
      'Открой список задач. Он не кусается, обещаю.',
      'Ты же помнишь, зачем открывал(а) это приложение?',
      'Тишина затягивается. Может, начнём с чего-то маленького?',
    ],
    petHappy: [
      'Фокус активирован. Время делать деньги.',
      'Задача закрыта. Переходим к следующей цели.',
      'Прогресс зафиксирован. Продолжай в том же ритме.',
      'Система отмечает: результат достигнут.',
      'Ещё один шаг ближе к цели. Без драмы, просто работа.',
      'Вот это темп. Хаос сегодня явно проигрывает.',
      'Отметка сделана. Мозг получил свою дозу дофамина честно.',
      'Красиво закрыто. Дальше — по плану.',
      'Именно так выглядит взрослая продуктивность.',
      'Плюс один пункт в список побед. Не за горами следующий.',
    ],
    petNeutral: 'Система готова. Жду ввода.',
    petNeutralDay: 'Погнали делать деньги.',
    petNeutralNight: 'Ночной фокус? Дерзко.',
    categoryIntro: {
      work: 'Работа? Погнали, показывай цель.',
      fitness: 'Тело важнее лайков. Погнали двигаться.',
      personal: 'Личное — тоже работа. Начнём с малого.',
      clients: 'Клиенты ждать не любят. Кто там у нас?',
      projects: 'Проект сам себя не сделает. С чего начнём?',
      finance: 'Цифры не любят приблизительно. Считаем точно.',
    },
    tipsButton: 'Лайфхаки фокуса',
    guideButton: 'Как это работает?',
    tipsTitle: 'Лайфхаки фокуса',
    reviewsTitle: 'Отзывы',
    cookieText: 'Сайт сохраняет ваш прогресс и настройки локально в браузере (localStorage), чтобы всё было на месте при следующем визите. Отдельных рекламных или трекинг-куки пока нет.',
    cookieAccept: 'Понятно',
    cookieDecline: 'Отклонить',
    reviewsPlaceholderNote: 'Это примеры для оформления — замените на настоящие отзывы, когда появятся живые пользователи.',
    reviews: [
      { text: 'Наконец приложение, где цель не превращается в стену текста. Разбил план на шаги за минуту.', author: 'пример отзыва' },
      { text: 'Гриша грубит по делу — и почему-то это работает лучше, чем вежливые напоминания.', author: 'пример отзыва' },
      { text: 'Расписание дня наконец не выглядит как таблица в экселе.', author: 'пример отзыва' },
    ],
    appsTitle: 'Приложения',
    appsComingSoon: 'Мобильное приложение (iOS/Android) в разработке — пока доступен веб-сайт, который отлично работает и на телефоне.',
    suggestTitle: 'Предложить улучшение',
    suggestSubtitle: 'Чего не хватает? Что раздражает? Пишите прямо сюда — читаем всё.',
    suggestPlaceholder: 'Например: хочу видеть статистику по месяцам...',
    suggestSend: 'Отправить',
    suggestSending: 'Отправляем...',
    suggestThanks: 'Спасибо! Предложение сохранено — обязательно прочитаем.',
    suggestError: 'Не получилось отправить. Попробуйте ещё раз.',
    tips: [
      { title: 'Правило 5 минут', desc: 'Пообещай себе позаниматься делом всего 5 минут. Обычно сопротивление ломается раньше, чем таймер.' },
      { title: 'Дофаминовая детокс-пауза', desc: 'За 10 минут до фокус-сессии отключи уведомления — так триггеры не будут перебивать концентрацию.' },
      { title: 'Один экран — одна задача', desc: 'Закрой лишние вкладки. Хаос на экране почти всегда превращается в хаос в голове.' },
      { title: 'Работай на виду', desc: 'Даже виртуальное присутствие другого человека — созвон, стрим, коворкинг — снижает сопротивление начать.' },
    ],
    guideTitle: 'Как это работает',
    guideSteps: [
      { title: 'Выбери сферу и цель', desc: 'Прямо рядом с Гришей отметь категорию — Работа, Фитнес или Личное — и впиши цель, которая пугает.' },
      { title: 'Разбей цель одним кликом', desc: 'Система превратит её в 3 маленьких шага, которые не вызывают сопротивления.' },
      { title: 'Отмечай шаги и включай фокус', desc: 'Кликай чекбоксы по мере выполнения, затем запусти таймер и заблокируй отвлечения.' },
      { title: 'Собирай награды', desc: 'Каждая закрытая цель наполняет чашу спокойствия и открывает медали в сейфе.' },
    ],
    guideNext: 'Далее',
    guideBack: 'Назад',
    guideDone: 'Понятно, начинаем',
    categoriesLabel: 'Сфера',
    categories: {
      work: { label: 'Работа / Блог', placeholder: 'Например: Снять Reels' },
      fitness: { label: 'Фитнес и Здоровье', placeholder: 'Например: Утренняя тренировка' },
      personal: { label: 'Личные дела', placeholder: 'Например: Разобрать почту' },
      clients: { label: 'Клиенты', placeholder: 'Например: Согласовать договор с клиентом' },
      projects: { label: 'Проекты', placeholder: 'Например: Запустить новый лендинг' },
      finance: { label: 'Финансы', placeholder: 'Например: Свести отчёт за месяц' },
    },
    heroGreeting: 'Какую большую цель нужно достичь?',
    buttonIdle: 'Разбить в 1 клик (ИИ)',
    buttonLoading: 'ИИ анализирует...',
    stepsTitle: 'Твой квест:',
    questFinish: 'Финиш — цель закрыта',
    questListTitle: (n) => `Активных целей: ${n}`,
    deadlineLabel: 'К какому сроку?',
    deadlineBy: 'Срок',
    deadlineOptions: { '1w': '1 неделя', '1m': '1 месяц', '2m': '2 месяца', '3m': '3 месяца', '6m': '6 месяцев', '1y': '1 год', none: 'Без срока' },
    orExactDate: 'или точная дата:',
    timePassedWarning: 'Это время сегодня уже прошло — задача попадёт в конец списка на сегодня. Если имелась в виду ночь на завтра, выберите завтрашний день в ленте вверху.',
    noQuestsInFilter: 'В этой сфере и режиме пока нет целей — они есть в других вкладках выше.',
    deleteQuest: 'Удалить цель',
    editStep: 'Изменить шаг',
    saveEdit: 'Сохранить',
    cancelEdit: 'Отменить',
    tabFocus: 'Фокус',
    modePersonal: 'Личное',
    modeBusiness: 'Бизнес',
    tabRewards: 'Награды',
    timelineTitle: 'Расписание дня',
    dayProgress: 'Прогресс дня',
    noTasksToday: 'На этот день пока пусто — добавьте задачу или разбейте цель выше.',
    slotFreeText: 'Слот свободен для магии фокуса',
    addTaskPlaceholder: 'Например: Позвонить клиенту',
    exactTimeHint: 'Точное время (любое, не только из списка)',
    quickTimeLabel: 'Быстрый выбор часа',
    exactTimeLabel: 'Своё время (часы и минуты)',
    addTaskButton: 'Добавить',
    todayLabel: 'Сегодня',
    notesTitle: 'Быстрые заметки',
    notesSubtitle: 'Мысли и идеи, чтобы не отвлекаться от фокуса',
    notesPlaceholder: 'Идея для Reels, мысль про тренировку — запишите, чтобы не забыть...',
    weekdaysShort: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    openCalendar: 'Открыть календарь',
    prevWeeks: 'Предыдущие недели',
    nextWeeks: 'Следующие недели',
    localeCode: 'ru-RU',
    tableStep: 'Шаг',
    tableStatus: 'Статус',
    allDone: 'Цель полностью закрыта. Все шаги выполнены.',
    emptyBreak: 'Введи цель — шаги сами появятся слева, в расписании дня.',
    planProgress: 'Прогресс плана',
    timerTitle: 'Фокус-сессия',
    timerSubtitle: 'Выбери длительность и заблокируй отвлечения',
    minutesLabel: (m) => `${m} мин`,
    startButton: 'Старт',
    pauseButton: 'Пауза',
    resumeButton: 'Продолжить',
    finishEarly: 'Завершить досрочно',
    cancelButton: 'Отмена',
    lockedBanner: 'INSTAGRAM ЗАБЛОКИРОВАН',
    pausedBanner: 'НА ПАУЗЕ',
    remainingLabel: 'ОСТАЛОСЬ',
    completeMsgs: [
      'Сессия завершена. Чистая работа.',
      'Фокус удержан на 100%. Ты в игре.',
      'Ещё одна победа над хаосом зафиксирована.',
    ],
    medalsTitle: 'Сейф наград',
    medalsSubtitle: 'Прогресс, который система запоминает',
    medal1Name: 'Первый шаг',
    medal1Desc: 'Заверши первую задачу',
    medalCupName: 'Чаша спокойствия',
    cupSeasonLabel: 'Сезон 1 · Июль 2026',
    levelUpPhrase: (lvl) => `Уровень ${lvl}! Растёшь быстрее, чем я ожидал.`,
    levelLabel: (lvl) => `Ур. ${lvl}`,
    xpLabel: (cur, max) => `${cur}/${max} XP`,
    streakBadge: (n) => {
      const mod10 = n % 10;
      const mod100 = n % 100;
      let word = 'дней';
      if (mod10 === 1 && mod100 !== 11) word = 'день';
      else if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) word = 'дня';
      return `🔥 ${n} ${word}`;
    },
    xpPopup: '+10 XP',
    cupDropPopup: '+1 Капля в чашу',
    medalCupDesc: 'Наполняется, как чайная чаша в китайской традиции — с каждой закрытой целью',
    medalReelsName: 'Победитель',
    medalReelsDesc: 'Закрой все шаги плана',
    medalMasterName: 'Мастер фокуса',
    medalMasterDesc: '3 фокус-сессии подряд',
    medalFiveName: 'Пятёрочка',
    medalFiveDesc: '5 выполненных целей',
    medalEarlyName: 'Ранняя пташка',
    medalEarlyDesc: 'За продуктивную работу до 9:00 утра',
    locked: 'заблокировано',
    unlocked: 'разблокировано',
    progressTasks: (c, m) => `${c}/${m} выполнено`,
    progressSessions: (c, m) => `${c}/${m} сессий`,
    progressStages: (c, m) => `${c}/${m} уровней наполнения`,
    cupStage: (n) => {
      if (n <= 0) return 'пустая чаша';
      if (n < 3) return 'первые капли';
      if (n < 6) return 'наполовину полна';
      if (n < 10) return 'почти полна';
      return 'чаша спокойствия полна';
    },
    tasksDoneStat: (n) => `Целей закрыто: ${n}`,
    footerLine: 'сделано для мозгов, которым скучно линейно',
    legalOfferLabel: 'Оферта',
    legalPrivacyLabel: 'Политика конфиденциальности',
    legalDisclaimer: 'Черновик документа под текущую версию сервиса. Перед коммерческим запуском и подключением оплаты — обязательно проверить у юриста и заполнить реквизиты в квадратных скобках.',
    legalOfferTitle: 'Публичная оферта',
    legalOfferBody: [
      { h: '1. Общие положения', p: 'Настоящий документ является публичной офертой [ИП/самозанятый, ИНН] (далее — Исполнитель) в адрес любого физического лица (далее — Пользователь), совершившего действия, указанные в разделе 3, и означает полное согласие Пользователя с изложенными ниже условиями.' },
      { h: '2. Предмет оферты', p: 'Исполнитель предоставляет Пользователю доступ к веб-сервису «ФокусХаос» — планировщику задач с элементами геймификации. На дату публикации оферты Сервис предоставляется бесплатно. Информация о платных тарифах (при их введении) будет размещена на сайте отдельно, с указанием стоимости и порядка оплаты, и вступит в силу только после отдельного уведомления Пользователей.' },
      { h: '3. Акцепт оферты', p: 'Фактом акцепта настоящей оферты является начало использования Сервиса Пользователем.' },
      { h: '4. Права и обязанности сторон', p: 'Исполнитель обязуется обеспечивать работоспособность Сервиса в разумных пределах и не гарантирует его бесперебойную работу. Пользователь обязуется использовать Сервис в законных целях.' },
      { h: '5. Ответственность', p: 'Исполнитель не несёт ответственности за любые убытки, возникшие в результате использования либо невозможности использования Сервиса.' },
      { h: '6. Изменение условий', p: 'Исполнитель вправе изменять условия оферты в одностороннем порядке, разместив новую редакцию на сайте Сервиса.' },
      { h: '7. Реквизиты Исполнителя', p: '[Наименование ИП/самозанятого], ИНН: [——], контактный email: [——].' },
    ],
    legalPrivacyTitle: 'Политика конфиденциальности',
    legalPrivacyBody: [
      { h: '1. Общие положения', p: 'Настоящая Политика определяет порядок обработки персональных данных пользователей сервиса «ФокусХаос» в соответствии с Федеральным законом №152-ФЗ «О персональных данных». Оператор: [ИП/самозанятый, ИНН, контактный email].' },
      { h: '2. Какие данные собираются', p: 'На текущем этапе Сервис работает без сервера и без регистрации. Весь прогресс (цели, сессии, история активности) сохраняется локально в браузере пользователя и не передаётся Оператору или третьим лицам. При подключении серверной части и авторизации эта Политика будет обновлена с точным перечнем собираемых данных.' },
      { h: '3. Цели обработки', p: 'Обеспечение работы функций Сервиса и сохранение прогресса пользователя; при появлении платных тарифов — обработка данных, необходимых для оказания услуги и расчётов.' },
      { h: '4. Передача данных третьим лицам', p: 'Сервис может использовать сторонний API языковой модели для генерации плана действий. Введённый пользователем текст цели может передаваться этому API для обработки. Иные данные третьим лицам не передаются, кроме случаев, предусмотренных законодательством РФ.' },
      { h: '5. Хранение и защита данных', p: 'Персональные данные пользователей из РФ хранятся на серверах, расположенных на территории Российской Федерации, в соответствии с ч. 5 ст. 18 152-ФЗ.' },
      { h: '6. Права пользователя', p: 'Пользователь вправе запросить удаление своих данных, направив запрос на контактный email Оператора.' },
      { h: '7. Контакты', p: 'По вопросам обработки данных: [email/контакт].' },
    ],
    streakTitle: 'Твой ритм за неделю',
    streakDeviceNote: 'хранится на этом устройстве',
    streakLabel: (n) => `${n} дн. подряд`,
    streakDays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    reminders: [
      'Пора сделать разминку',
      'Выпей стакан воды',
      'Моргни как следует — глаза тоже устают',
      'Встань и пройдись пару минут',
      'Разогни спину и расправь плечи',
    ],
    reminderLabel: 'Напоминание',
  },
  en: {
    appName: 'FocusChaos',
    tagline: 'Enter a goal — get a clear plan and focus to reach it',
    consoleLabel: 'SYSTEM',
    consoleName: 'Gary',
    consoleSub: 'AI focus buddy',
    statusOnline: 'READY',
    statusIdle: 'IDLE',
    statusSuccess: 'SUCCESS',
    petIdle: [
      "Your blog won't monetize itself. Instagram can wait.",
      'Status: idle. Productivity: questionable.',
      "One more scroll and I'm calling it sabotage.",
      "Deadlines don't move by wishful thinking.",
      'Someone is confusing "rest" with "procrastination".',
      'Five minutes of ceiling-staring. Impressive. Not the goal though.',
      "The algorithm is thrilled. Your goals aren't.",
      "Open the task list. It doesn't bite, promise.",
      "You remember why you opened this app, right?",
      "The silence is getting long. Start small?",
    ],
    petHappy: [
      'Focus engaged. Time to make money.',
      'Task closed. Next objective loading.',
      'Progress logged. Keep the momentum.',
      'System note: result achieved.',
      'One step closer. No drama, just work.',
      "That's the pace. Chaos is losing today.",
      'Checkbox earned. Dopamine, fair and square.',
      'Clean close. Moving on, per plan.',
      'This is what grown-up productivity looks like.',
      "One more win on the board. Next one's not far.",
    ],
    petNeutral: 'System ready. Awaiting input.',
    petNeutralDay: "Let's make money.",
    petNeutralNight: 'Night focus? Bold.',
    categoryIntro: {
      work: "Work? Let's see the goal.",
      fitness: "Body over likes. Let's move.",
      personal: 'Personal counts too. Start small.',
      clients: "Clients don't like waiting. Who's up?",
      projects: "A project won't finish itself. Where do we start?",
      finance: "Numbers don't do 'roughly'. Let's be exact.",
    },
    tipsButton: 'Focus tips',
    guideButton: 'How it works',
    tipsTitle: 'Focus tips',
    reviewsTitle: 'Reviews',
    cookieText: 'This site saves your progress and settings locally in your browser (localStorage), so everything is there next time you visit. There are no separate ad or tracking cookies yet.',
    cookieAccept: 'Got it',
    cookieDecline: 'Decline',
    reviewsPlaceholderNote: 'These are placeholder examples — swap them for real reviews once you have real users.',
    reviews: [
      { text: 'Finally an app where a goal doesn\'t turn into a wall of text. Broke my plan into steps in a minute.', author: 'sample review' },
      { text: "Grisha is blunt in a useful way — and somehow that works better than polite reminders.", author: 'sample review' },
      { text: "The day's schedule finally doesn't look like a spreadsheet.", author: 'sample review' },
    ],
    appsTitle: 'Apps',
    appsComingSoon: 'A mobile app (iOS/Android) is in the works — for now the website itself works great on phones too.',
    suggestTitle: 'Suggest an improvement',
    suggestSubtitle: "What's missing? What's annoying? Write it right here — we read everything.",
    suggestPlaceholder: 'e.g. I\'d like to see monthly stats...',
    suggestSend: 'Send',
    suggestSending: 'Sending...',
    suggestThanks: "Thanks! Your suggestion is saved — we'll read it.",
    suggestError: "Couldn't send it. Please try again.",
    tips: [
      { title: 'The 5-minute rule', desc: 'Promise yourself just 5 minutes on the task. Resistance usually breaks before the timer does.' },
      { title: 'Dopamine detox pause', desc: "Turn off notifications 10 minutes before a focus session so triggers can't interrupt you." },
      { title: 'One screen, one task', desc: 'Close the extra tabs. Chaos on screen almost always becomes chaos in your head.' },
      { title: 'Work where you can be seen', desc: 'Even a virtual presence — a call, a stream, co-working — lowers the resistance to start.' },
    ],
    guideTitle: 'How it works',
    guideSteps: [
      { title: 'Pick a category and a goal', desc: "Right next to Gary, choose Work, Fitness, or Personal, then type the goal that's intimidating you." },
      { title: 'Break it down in one click', desc: "The system turns it into 3 tiny steps that don't trigger resistance." },
      { title: 'Check steps, start focus', desc: 'Tap each checkbox as you go, then start the timer and lock out distractions.' },
      { title: 'Collect your rewards', desc: 'Every closed goal fills the cup of calm and unlocks medals in the vault.' },
    ],
    guideNext: 'Next',
    guideBack: 'Back',
    guideDone: "Got it, let's start",
    categoriesLabel: 'Area',
    categories: {
      work: { label: 'Work / Blog', placeholder: 'e.g. Shoot a Reels' },
      fitness: { label: 'Fitness & Health', placeholder: 'e.g. Morning workout' },
      personal: { label: 'Personal', placeholder: 'e.g. Clear out your inbox' },
      clients: { label: 'Clients', placeholder: 'e.g. Finalize contract with client' },
      projects: { label: 'Projects', placeholder: 'e.g. Launch the new landing page' },
      finance: { label: 'Finance', placeholder: 'e.g. Close out the monthly report' },
    },
    heroGreeting: "What's the big goal to achieve?",
    buttonIdle: 'Break it down in 1 click (AI)',
    buttonLoading: 'AI is analyzing...',
    stepsTitle: 'Your quest:',
    questFinish: 'Finish — goal closed',
    questListTitle: (n) => `Active goals: ${n}`,
    deadlineLabel: 'By when?',
    deadlineBy: 'Due',
    deadlineOptions: { '1w': '1 week', '1m': '1 month', '2m': '2 months', '3m': '3 months', '6m': '6 months', '1y': '1 year', none: 'No deadline' },
    orExactDate: 'or exact date:',
    timePassedWarning: "That time has already passed today — the task will just sit at the bottom of today's list. If you meant tonight going into tomorrow, pick tomorrow in the strip above instead.",
    noQuestsInFilter: "No goals in this category and mode yet — they're in the other tabs above.",
    deleteQuest: 'Delete goal',
    editStep: 'Edit step',
    saveEdit: 'Save',
    cancelEdit: 'Cancel',
    tabFocus: 'Focus',
    modePersonal: 'Personal',
    modeBusiness: 'Business',
    tabRewards: 'Rewards',
    timelineTitle: "Day's schedule",
    dayProgress: 'Day progress',
    noTasksToday: 'Nothing here yet — add a task or break down a goal above.',
    slotFreeText: 'This slot is open for focus magic',
    addTaskPlaceholder: 'e.g. Call the client',
    exactTimeHint: 'Exact time (any time, not just the list)',
    quickTimeLabel: 'Quick hour pick',
    exactTimeLabel: 'Custom time (hours and minutes)',
    addTaskButton: 'Add',
    todayLabel: 'Today',
    notesTitle: 'Quick notes',
    notesSubtitle: 'Ideas and thoughts, so they don\'t break your focus',
    notesPlaceholder: 'A Reels idea, a workout thought — jot it down before you forget...',
    weekdaysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    openCalendar: 'Open calendar',
    prevWeeks: 'Previous weeks',
    nextWeeks: 'Next weeks',
    localeCode: 'en-US',
    tableStep: 'Step',
    tableStatus: 'Status',
    allDone: 'Goal fully closed. All steps complete.',
    emptyBreak: "Enter a goal — the steps land on the left, in today's schedule.",
    planProgress: 'Plan progress',
    timerTitle: 'Focus session',
    timerSubtitle: 'Pick a duration and lock out distractions',
    minutesLabel: (m) => `${m} min`,
    startButton: 'Start',
    pauseButton: 'Pause',
    resumeButton: 'Resume',
    finishEarly: 'Finish early',
    cancelButton: 'Cancel',
    lockedBanner: 'INSTAGRAM LOCKED',
    pausedBanner: 'PAUSED',
    remainingLabel: 'REMAINING',
    completeMsgs: ['Session complete. Clean work.', "Focus held at 100%. You're in the game.", 'Another win over chaos, logged.'],
    medalsTitle: 'Reward vault',
    medalsSubtitle: 'Progress the system remembers',
    medal1Name: 'First Step',
    medal1Desc: 'Finish your first task',
    medalCupName: 'Cup of Calm',
    cupSeasonLabel: 'Season 1 · July 2026',
    levelUpPhrase: (lvl) => `Level ${lvl}! You're leveling up faster than I expected.`,
    levelLabel: (lvl) => `Lv. ${lvl}`,
    xpLabel: (cur, max) => `${cur}/${max} XP`,
    streakBadge: (n) => `🔥 ${n} ${n === 1 ? 'day' : 'days'}`,
    xpPopup: '+10 XP',
    cupDropPopup: '+1 Drop into the cup',
    medalCupDesc: 'Fills like a cup in a Chinese tea ceremony, one goal at a time',
    medalReelsName: 'Champion',
    medalReelsDesc: 'Clear every step of the plan',
    medalMasterName: 'Focus Master',
    medalMasterDesc: '3 focus sessions total',
    medalFiveName: 'High Five',
    medalFiveDesc: '5 goals completed',
    medalEarlyName: 'Early Bird',
    medalEarlyDesc: 'For productive work before 9:00 AM',
    locked: 'locked',
    unlocked: 'unlocked',
    progressTasks: (c, m) => `${c}/${m} completed`,
    progressSessions: (c, m) => `${c}/${m} sessions`,
    progressStages: (c, m) => `${c}/${m} fill levels`,
    cupStage: (n) => {
      if (n <= 0) return 'empty cup';
      if (n < 3) return 'first drops';
      if (n < 6) return 'half full';
      if (n < 10) return 'nearly full';
      return 'cup of calm, full';
    },
    tasksDoneStat: (n) => `Goals closed: ${n}`,
    footerLine: 'built for brains that hate straight lines',
    legalOfferLabel: 'Terms of Service',
    legalPrivacyLabel: 'Privacy Policy',
    legalDisclaimer: 'Draft document matching the current version of the service. Before any commercial launch or payments — have it reviewed by a lawyer and fill in the bracketed details.',
    legalOfferTitle: 'Public Offer (Terms of Service)',
    legalOfferBody: [
      { h: '1. General', p: 'This document is a public offer from [Sole Proprietor / self-employed, Tax ID] ("Operator") to any individual ("User") who takes the action described in section 3, and constitutes the User\'s full agreement with the terms below.' },
      { h: '2. Subject of the offer', p: 'The Operator provides access to the "FocusChaos" web service — a task planner with gamification. As of publication, the Service is provided free of charge. Paid tiers, if introduced, will be listed separately with pricing and payment terms, and will only take effect after separate notice to Users.' },
      { h: '3. Acceptance', p: 'Using the Service constitutes acceptance of this offer.' },
      { h: '4. Rights and obligations', p: 'The Operator will make reasonable efforts to keep the Service running but does not guarantee uninterrupted operation. The User agrees to use the Service lawfully.' },
      { h: '5. Liability', p: 'The Operator is not liable for any losses arising from use or inability to use the Service.' },
      { h: '6. Changes', p: 'The Operator may amend these terms unilaterally by publishing a new version on the Service website.' },
      { h: '7. Operator details', p: '[Legal name], Tax ID: [——], contact email: [——].' },
    ],
    legalPrivacyTitle: 'Privacy Policy',
    legalPrivacyBody: [
      { h: '1. General', p: 'This Policy governs the processing of personal data of "FocusChaos" users under Russian Federal Law No. 152-FZ "On Personal Data". Operator: [Sole Proprietor / self-employed, Tax ID, contact email].' },
      { h: '2. What data is collected', p: 'At this stage the Service runs without a server or sign-up. All progress (goals, sessions, activity history) is stored locally in the user\'s browser and is not sent to the Operator or any third party. Once a backend and authentication are added, this Policy will be updated with the exact data collected.' },
      { h: '3. Purpose of processing', p: "Operating the Service's features and saving user progress; once paid tiers exist, processing data needed to provide the service and handle billing." },
      { h: '4. Third-party sharing', p: 'The Service may use a third-party language-model API to generate action plans. Goal text entered by the user may be sent to that API for processing. No other data is shared with third parties except as required by Russian law.' },
      { h: '5. Storage and protection', p: 'Personal data of users in Russia is stored on servers located in the Russian Federation, per Art. 18(5) of 152-FZ.' },
      { h: '6. User rights', p: "The User may request deletion of their data by contacting the Operator's email." },
      { h: '7. Contact', p: 'For data processing questions: [email/contact].' },
    ],
    streakTitle: 'Your week at a glance',
    streakDeviceNote: 'stored on this device',
    streakLabel: (n) => `${n}-day streak`,
    streakDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    reminders: [
      'Time for a quick stretch',
      'Drink a glass of water',
      'Blink properly — your eyes need a break too',
      'Stand up and walk for a couple minutes',
      'Roll your shoulders back',
    ],
    reminderLabel: 'Reminder',
  },
};

/* ------------------------------------------------------------------------ */
/*  AI STEP GENERATION                                                      */
/*  ------------------------------------------------------------------------ */
/*  generateSteps() below calls a real model (YandexGPT) through the        */
/*  /api/generate-steps serverless function — see that file for the         */
/*  actual API call. The API key lives only on the server (env vars),       */
/*  never in this file or the browser.                                      */
/*                                                                           */
/*  STEP_VARIANTS below is the OFFLINE FALLBACK: if the AI call fails       */
/*  (no internet, quota exceeded, keys not configured, or running locally   */
/*  without `vercel dev`), the app quietly falls back to these templates    */
/*  so it never breaks end to end.                                          */
/* ------------------------------------------------------------------------ */
const STEP_VARIANTS = {
  ru: {
    work: [
      (task) => [
        `Шаг 1: Набросай ключевые тезисы для «${task}»`,
        `Шаг 2: Подготовь всё необходимое (свет, инструменты, данные) для «${task}»`,
        `Шаг 3: Сделай финальный дубль «${task}» — и закрывай задачу`,
      ],
      (task) => [
        `Шаг 1: Реши, что именно значит «готово» для «${task}»`,
        `Шаг 2: Выдели 25 минут без отвлечений на «${task}»`,
        `Шаг 3: Покажи результат «${task}» кому-то или опубликуй`,
      ],
    ],
    fitness: [
      () => ['Шаг 1: Надень кроссовки', 'Шаг 2: Включи плейлист', 'Шаг 3: Сделай разминку 5 минут'],
      () => ['Шаг 1: Приготовь воду и полотенце', 'Шаг 2: Выбери 15 минут тренировки, которая не пугает', 'Шаг 3: Заверши подход и отметь результат'],
    ],
    personal: [
      (task) => [
        `Шаг 1: Выпиши все мелкие части «${task}» на один лист`,
        `Шаг 2: Выбери самую простую часть и сделай её первой`,
        `Шаг 3: Доведи «${task}» до конца, не откладывая на завтра`,
      ],
      (task) => [
        `Шаг 1: Реши, какую часть «${task}» можно закрыть за 10 минут`,
        `Шаг 2: Убери один отвлекающий фактор перед стартом`,
        `Шаг 3: Заверши «${task}» и отметь как закрытое`,
      ],
    ],
    clients: [
      (task) => [
        `Шаг 1: Собери всё, что известно о «${task}», в один список`,
        `Шаг 2: Напиши клиенту и зафиксируй следующий шаг по «${task}»`,
        `Шаг 3: Отметь «${task}» как отработанное и запланируй следующий контакт`,
      ],
      (task) => [
        `Шаг 1: Проверь статус по «${task}» — где сейчас застряло`,
        `Шаг 2: Реши один конкретный вопрос клиента по «${task}»`,
        `Шаг 3: Подтверди договорённость по «${task}» письменно`,
      ],
    ],
    projects: [
      (task) => [
        `Шаг 1: Определи, что именно значит «готово» для «${task}»`,
        `Шаг 2: Выбери следующий конкретный шаг по «${task}» и сделай только его`,
        `Шаг 3: Обнови статус «${task}» и отметь прогресс`,
      ],
      (task) => [
        `Шаг 1: Разбей «${task}» на 3 маленьких куска`,
        `Шаг 2: Сделай самый неприятный кусок «${task}» первым`,
        `Шаг 3: Зафиксируй результат «${task}» и что осталось`,
      ],
    ],
    finance: [
      (task) => [
        `Шаг 1: Собери все цифры, нужные для «${task}»`,
        `Шаг 2: Сведи «${task}» в одну таблицу или документ`,
        `Шаг 3: Перепроверь «${task}» и закрой на сегодня`,
      ],
      (task) => [
        `Шаг 1: Реши, какой один показатель важнее всего для «${task}»`,
        `Шаг 2: Посчитай именно его для «${task}»`,
        `Шаг 3: Запиши вывод по «${task}» и следующий шаг`,
      ],
    ],
  },
  en: {
    work: [
      (task) => [
        `Step 1: Draft the key points for "${task}"`,
        `Step 2: Set up everything you need (light, tools, data) for "${task}"`,
        `Step 3: Record the final take of "${task}" — and close it out`,
      ],
      (task) => [
        `Step 1: Decide what "done" actually means for "${task}"`,
        `Step 2: Block 25 distraction-free minutes for "${task}"`,
        `Step 3: Show "${task}" to someone, or publish it`,
      ],
    ],
    fitness: [
      () => ['Step 1: Put on your sneakers', 'Step 2: Turn on a playlist', 'Step 3: Do a 5-minute warm-up'],
      () => ['Step 1: Get water and a towel ready', 'Step 2: Pick 15 minutes of a workout that feels doable', 'Step 3: Finish the set and log the result'],
    ],
    personal: [
      (task) => [
        `Step 1: Write down every small part of "${task}" on one list`,
        `Step 2: Pick the easiest part and do it first`,
        `Step 3: Take "${task}" all the way through — no pushing it to tomorrow`,
      ],
      (task) => [
        `Step 1: Decide which part of "${task}" fits in 10 minutes`,
        `Step 2: Remove one distraction before you start`,
        `Step 3: Finish "${task}" and mark it closed`,
      ],
    ],
    clients: [
      (task) => [
        `Step 1: Gather everything you know about "${task}" in one place`,
        `Step 2: Message the client and lock in the next step for "${task}"`,
        `Step 3: Mark "${task}" handled and schedule the next check-in`,
      ],
      (task) => [
        `Step 1: Check where "${task}" is currently stuck`,
        `Step 2: Resolve one concrete client question about "${task}"`,
        `Step 3: Confirm the agreement on "${task}" in writing`,
      ],
    ],
    projects: [
      (task) => [
        `Step 1: Define what "done" actually means for "${task}"`,
        `Step 2: Pick the next concrete step for "${task}" and do only that`,
        `Step 3: Update the status of "${task}" and note the progress`,
      ],
      (task) => [
        `Step 1: Break "${task}" into 3 small pieces`,
        `Step 2: Do the most annoying piece of "${task}" first`,
        `Step 3: Log the result of "${task}" and what's left`,
      ],
    ],
    finance: [
      (task) => [
        `Step 1: Gather all the numbers needed for "${task}"`,
        `Step 2: Pull "${task}" together into one sheet or doc`,
        `Step 3: Double-check "${task}" and close it out for today`,
      ],
      (task) => [
        `Step 1: Decide which single number matters most for "${task}"`,
        `Step 2: Calculate exactly that for "${task}"`,
        `Step 3: Write down the takeaway for "${task}" and the next step`,
      ],
    ],
  },
};

async function generateSteps(lang, categoryId, task, deadlineLabel = '') {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Not signed in');

    const res = await fetch('/api/generate-steps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ lang, categoryId, task, deadlineLabel }),
    });
    if (!res.ok) throw new Error(`API responded ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data.steps) && data.steps.length > 0) {
      return data.steps;
    }
    throw new Error('No steps in response');
  } catch (err) {
    // Real AI call failed (offline, quota, rate limit hit, misconfigured
    // keys, or running locally without `vercel dev`) — quietly fall back to
    // the local template generator so the app still works end to end.
    console.warn('AI generation failed, using local fallback:', err.message);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const variants = STEP_VARIANTS[lang][categoryId];
    const pick = variants[Math.floor(Math.random() * variants.length)];
    return pick(task);
  }
}

const DURATIONS = [5, 15, 25];
const SPARK_COLORS = ['#F59E0B', '#FBBF24', '#2DD4BF', '#34D399'];
const CUP_TOTAL = 10;

function pickRandom(arr, excludeIndex = -1) {
  if (arr.length <= 1) return 0;
  let idx = excludeIndex;
  while (idx === excludeIndex) idx = Math.floor(Math.random() * arr.length);
  return idx;
}

/* ---------------------------------------------------------------------- */
/*  Ambient background glow                                               */
/* ---------------------------------------------------------------------- */
function AmbientGlow() {
  return (
    <>
      <div className="fc-blob hidden sm:block" style={{ width: 340, height: 340, top: '20%', left: -140, background: '#2DD4BF', opacity: 0.22 }} />
      <div className="fc-blob hidden sm:block" style={{ width: 340, height: 340, bottom: '5%', right: -140, background: '#F59E0B', opacity: 0.18 }} />
    </>
  );
}

/* ---------------------------------------------------------------------- */
/*  Reusable modal shell                                                  */
/* ---------------------------------------------------------------------- */
function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="fc-modal-in fc-card fc-glow-mint rounded-2xl p-6 w-full max-w-md relative border-emerald-400/25">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition" aria-label="close">
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

function TipsModal({ t, open, onClose }) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center gap-2 mb-4 text-amber-300">
        <Lightbulb size={18} />
        <h3 className="fc-display text-lg font-bold text-white">{t.tipsTitle}</h3>
      </div>
      <div className="space-y-3">
        {t.tips.map((tip, i) => (
          <div key={i} className="rounded-xl bg-slate-950/60 border border-slate-700/70 px-4 py-3">
            <p className="fc-mono text-[10px] tracking-widest text-emerald-300/80 mb-1">{String(i + 1).padStart(2, '0')}</p>
            <p className="text-sm font-semibold text-slate-100 mb-1">{tip.title}</p>
            <p className="text-[13px] text-slate-400 leading-relaxed">{tip.desc}</p>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/*  Cookie consent banner                                                  */
/*  ------------------------------------------------------------------------ */
/*  Honest about what's actually stored: everything today is localStorage  */
/*  only (no tracking/analytics cookies exist yet). Update this copy the   */
/*  moment real analytics or ad cookies are added.                         */
/* ------------------------------------------------------------------------ */
function CookieBanner({ t, consent, onChoice }) {
  if (consent) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 flex justify-center">
      <div className="fc-modal-in fc-card fc-glow-mint rounded-2xl p-4 sm:p-5 w-full max-w-2xl border-emerald-400/25 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="text-[13px] text-slate-300 leading-relaxed flex-1">{t.cookieText}</p>
        <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
          <button
            onClick={() => onChoice('declined')}
            className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold bg-slate-950/70 border border-slate-700 text-slate-300 hover:border-slate-500 transition"
          >
            {t.cookieDecline}
          </button>
          <button
            onClick={() => onChoice('accepted')}
            className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition"
            style={{ background: 'linear-gradient(135deg,#34D399,#2DD4BF)', color: '#0f172a' }}
          >
            {t.cookieAccept}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewsAppsModal({ t, open, onClose, user }) {
  const [suggestion, setSuggestion] = useState('');
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [suggestSent, setSuggestSent] = useState(false);
  const [suggestError, setSuggestError] = useState('');

  const submitSuggestion = async () => {
    const text = suggestion.trim();
    if (!text) return;
    setSuggestBusy(true);
    setSuggestError('');
    try {
      const { error } = await supabase.from('feedback').insert({
        message: text,
        user_id: user ? user.id : null,
        email: user ? user.email : null,
      });
      if (error) throw error;
      setSuggestSent(true);
      setSuggestion('');
    } catch (err) {
      setSuggestError(err.message || t.suggestError);
    } finally {
      setSuggestBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center gap-2 mb-1 text-amber-300">
        <MessageSquareQuote size={18} />
        <h3 className="fc-display text-lg font-bold text-white">{t.reviewsTitle}</h3>
      </div>
      <p className="text-[12px] text-slate-500 italic mb-4">{t.reviewsPlaceholderNote}</p>
      <div className="space-y-3 mb-6">
        {t.reviews.map((r, i) => (
          <div key={i} className="rounded-xl bg-slate-950/60 border border-slate-700/70 px-4 py-3">
            <p className="text-sm text-slate-100 leading-relaxed mb-2">«{r.text}»</p>
            <p className="fc-mono text-[10px] text-emerald-300/80">— {r.author}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3 text-emerald-300 pt-4 border-t border-slate-800">
        <Smartphone size={18} />
        <h3 className="fc-display text-lg font-bold text-white">{t.appsTitle}</h3>
      </div>
      <div className="rounded-xl bg-slate-950/60 border border-slate-700/70 px-4 py-4 text-center mb-6">
        <p className="text-sm text-slate-300">{t.appsComingSoon}</p>
      </div>

      <div className="flex items-center gap-2 mb-2 text-violet-300 pt-4 border-t border-slate-800">
        <Lightbulb size={18} />
        <h3 className="fc-display text-lg font-bold text-white">{t.suggestTitle}</h3>
      </div>
      <p className="text-sm text-slate-400 mb-3">{t.suggestSubtitle}</p>
      {suggestSent ? (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/40 px-4 py-3 text-sm text-emerald-200 text-center">
          {t.suggestThanks}
        </div>
      ) : (
        <>
          <textarea
            value={suggestion}
            onChange={(e) => setSuggestion(e.target.value)}
            placeholder={t.suggestPlaceholder}
            rows={3}
            className="w-full rounded-xl bg-slate-950/80 border border-slate-700 px-4 py-3 text-slate-100 placeholder-slate-600 text-sm outline-none focus:ring-2 focus:ring-violet-500/30 transition resize-none mb-2"
          />
          {suggestError && <p className="text-[12px] text-rose-400 mb-2">{suggestError}</p>}
          <button
            onClick={submitSuggestion}
            disabled={suggestBusy || !suggestion.trim()}
            className="w-full rounded-xl font-bold px-5 py-3 text-sm transition active:scale-95 disabled:opacity-50 border-2 bg-slate-800/40"
            style={{ borderColor: '#A855F7', color: '#D8B4FE' }}
          >
            {suggestBusy ? t.suggestSending : t.suggestSend}
          </button>
        </>
      )}
    </Modal>
  );
}


/* ---------------------------------------------------------------------- */
/*  Legal documents (Privacy Policy / Public Offer) — draft content        */
/*  ------------------------------------------------------------------------ */
/*  This is NOT a substitute for legal review. It's an honest draft that   */
/*  matches what the app actually does today (client-only, localStorage,   */
/*  no accounts). Update it the moment a backend, auth, or payments are    */
/*  added, and have a lawyer check it before any commercial launch.        */
/* ------------------------------------------------------------------------ */
function LegalModal({ title, sections, disclaimer, open, onClose }) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center gap-2 mb-3 text-emerald-300">
        <h3 className="fc-display text-lg font-bold text-white">{title}</h3>
      </div>
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[12px] leading-relaxed px-3 py-2.5 mb-4">
        {disclaimer}
      </div>
      <div className="space-y-3 max-h-[50vh] overflow-y-auto fc-scrollbar pr-1">
        {sections.map((s, i) => (
          <div key={i}>
            <p className="text-sm font-semibold text-slate-100 mb-1">{s.h}</p>
            <p className="text-[13px] text-slate-400 leading-relaxed">{s.p}</p>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function GuideModal({ t, open, onClose }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);
  const steps = t.guideSteps;
  const isLast = step === steps.length - 1;

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center gap-2 mb-4 text-emerald-300">
        <HelpCircle size={18} />
        <h3 className="fc-display text-lg font-bold text-white">{t.guideTitle}</h3>
      </div>
      <div className="flex items-center gap-1.5 mb-4">
        {steps.map((_, i) => (
          <span key={i} className="h-1.5 flex-1 rounded-full transition-colors" style={{ background: i <= step ? 'linear-gradient(90deg,#34D399,#F59E0B)' : 'rgba(148,163,184,0.2)' }} />
        ))}
      </div>
      <div key={step} className="fc-anim-pop min-h-[6.5rem]">
        <p className="fc-mono text-[10px] tracking-widest text-amber-300/80 mb-1">
          {String(step + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
        </p>
        <p className="text-base font-bold text-white mb-1.5">{steps[step].title}</p>
        <p className="text-sm text-slate-400 leading-relaxed">{steps[step].desc}</p>
      </div>
      <div className="flex items-center justify-between mt-5">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition"
        >
          <ChevronLeft size={16} />
          {t.guideBack}
        </button>
        <button
          onClick={() => (isLast ? onClose() : setStep((s) => s + 1))}
          className="flex items-center gap-1.5 rounded-xl text-slate-950 font-bold px-4 py-2.5 text-sm transition active:scale-95"
          style={{ background: 'linear-gradient(135deg,#34D399,#2DD4BF)', boxShadow: '0 0 20px -4px rgba(45,212,191,0.7)' }}
        >
          {isLast ? t.guideDone : t.guideNext}
          {!isLast && <ChevronRight size={16} />}
        </button>
      </div>
    </Modal>
  );
}

function ReminderToast({ t, toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-5 right-5 z-40 max-w-xs fc-toast-in">
      <div
        className="rounded-xl px-4 py-3 flex items-start gap-3 border border-amber-400/40"
        style={{ background: 'linear-gradient(180deg, #1e293b, #0f172a)', boxShadow: '0 12px 32px -8px rgba(0,0,0,0.6), 0 0 24px -6px rgba(245,158,11,0.4)' }}
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-amber-300" style={{ background: 'rgba(245,158,11,0.15)' }}>
          <Bell size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="fc-mono text-[9px] tracking-widest text-amber-300/80 mb-0.5">{t.reminderLabel}</p>
          <p className="text-sm text-slate-100 leading-snug">{toast.text}</p>
        </div>
        <button onClick={onDismiss} className="text-slate-500 hover:text-white transition flex-shrink-0" aria-label="dismiss">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function MiniProgress({ ratio, unlocked }) {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  const gradient = unlocked ? 'linear-gradient(90deg,#34D399,#F59E0B)' : 'linear-gradient(90deg,#CBD3DC,#B4BEC9)';
  return (
    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden mt-2">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: gradient }} />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Cup of Calm — custom illustration, Chinese-tea-ceremony inspired      */
/* ---------------------------------------------------------------------- */
function CupOfCalmIcon({ tasksDone, size = 26 }) {
  const stage = tasksDone <= 0 ? 0 : tasksDone < 3 ? 1 : tasksDone < 6 ? 2 : tasksDone < 10 ? 3 : 4;
  const leafCount = Math.min(4, tasksDone);
  const CUP_PATH = 'M12 18 H36 L32 34 Q24 40 16 34 Z';
  const fillTopY = { 1: 30, 2: 25, 3: 20, 4: 18 }[stage];
  const leafPositions = [
    { x: 15, y: 23 },
    { x: 33, y: 21 },
    { x: 24, y: 15 },
    { x: 20, y: 27 },
  ];

  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <defs>
        <clipPath id="fc-cup-clip">
          <path d={CUP_PATH} />
        </clipPath>
        <linearGradient id="fc-tea" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#FCD34D" />
        </linearGradient>
      </defs>
      {stage > 0 && (
        <g clipPath="url(#fc-cup-clip)">
          <rect x="10" y={fillTopY} width="28" height="26" fill="url(#fc-tea)" />
        </g>
      )}
      <path d={CUP_PATH} fill="none" stroke="#5EEAD4" strokeWidth="2" strokeLinejoin="round" />
      <line x1="15" y1="41" x2="33" y2="41" stroke="#5EEAD4" strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />
      {stage === 4 && (
        <>
          <path d="M17 15 Q19 11 17 7" stroke="#94A3B8" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.65" />
          <path d="M24 15 Q26 9 24 5" stroke="#94A3B8" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.65" />
          <path d="M31 15 Q33 11 31 7" stroke="#94A3B8" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.65" />
          {Array.from({ length: leafCount }).map((_, i) => {
            const p = leafPositions[i];
            return (
              <ellipse
                key={i}
                cx={p.x}
                cy={p.y}
                rx="2.4"
                ry="1.3"
                fill="#6EE7B7"
                transform={`rotate(${i * 35} ${p.x} ${p.y})`}
                style={{ filter: 'drop-shadow(0 0 3px rgba(110,231,183,0.8))' }}
              />
            );
          })}
        </>
      )}
    </svg>
  );
}

/* ---------------------------------------------------------------------- */
/*  GRISHA HERO — the merged "conversation" card                          */
/*  Grisha's status/avatar/speech bubble live in the same card as the      */
/*  category picker, the goal input, and the resulting plan — so this is  */
/*  the very first thing you see, no scrolling required.                   */
/* ---------------------------------------------------------------------- */
/* ---------------------------------------------------------------------- */
/*  Week strip — clickable Mon..Sun day pills                             */
/* ---------------------------------------------------------------------- */
function WeekStrip({ t, selectedDate, setSelectedDate, tasksByDate, onOpenCalendar }) {
  // The visible window is independent from the selected date — clicking a day
  // just highlights it, it no longer reshuffles the whole strip around itself.
  const [viewAnchor, setViewAnchor] = useState(() => getWeekDates(todayKey())[0]);
  const today = todayKey();

  const weekDates = getWeekDates(dateKeyOf(viewAnchor));
  const week2Dates = weekDates.map((d) => {
    const nd = new Date(d);
    nd.setDate(d.getDate() + 7);
    return nd;
  });
  const visibleKeys = [...weekDates, ...week2Dates].map(dateKeyOf);

  // If the calendar modal (or anything else) jumps selectedDate way outside
  // the currently visible window, bring the window back to contain it.
  useEffect(() => {
    if (!visibleKeys.includes(selectedDate)) {
      setViewAnchor(getWeekDates(selectedDate)[0]);
    }
  }, [selectedDate]);

  const shiftWindow = (days) => {
    const d = new Date(viewAnchor);
    d.setDate(d.getDate() + days);
    setViewAnchor(d);
  };

  const renderDay = (d, i) => {
    const key = dateKeyOf(d);
    const isSelected = key === selectedDate;
    const isToday = key === today;
    const dayTasks = tasksByDate[key] || [];
    const hasTasks = dayTasks.length > 0;
    return (
      <button
        key={key}
        onClick={() => setSelectedDate(key)}
        className={`flex flex-col items-center gap-1 px-1 sm:px-3 py-2 rounded-xl flex-1 sm:flex-shrink-0 sm:min-w-[52px] min-w-0 transition border ${
          isSelected ? 'border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
        }`}
        style={isSelected ? { background: '#9F7AEA' } : {}}
      >
        <span className="fc-mono text-[9px] tracking-wide opacity-80">{t.weekdaysShort[i % 7]}</span>
        <span className="text-sm font-bold">{d.getDate()}</span>
        <span
          className={`w-1 h-1 rounded-full ${hasTasks ? '' : 'opacity-0'}`}
          style={{ background: isSelected ? '#FFFFFF' : isToday ? '#F2765C' : '#94a3b8' }}
        />
      </button>
    );
  };

  return (
    <div>
      <div className="fc-card fc-glow-mint rounded-2xl px-2 sm:px-4 py-3 flex items-center gap-1 sm:gap-2 sm:overflow-x-auto">
        <button
          onClick={() => shiftWindow(-14)}
          className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 transition"
          aria-label={t.prevWeeks}
          title={t.prevWeeks}
        >
          <ChevronLeft size={15} />
        </button>
        {weekDates.map((d, i) => renderDay(d, i))}
        <div className="hidden lg:contents">{week2Dates.map((d, i) => renderDay(d, i))}</div>
        <button
          onClick={() => shiftWindow(14)}
          className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 transition"
          aria-label={t.nextWeeks}
          title={t.nextWeeks}
        >
          <ChevronRight size={15} />
        </button>
        <button
          onClick={onOpenCalendar}
          className="hidden sm:flex items-center justify-center flex-shrink-0 w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 transition ml-1"
          aria-label={t.openCalendar}
          title={t.openCalendar}
        >
          <CalendarDays size={16} />
        </button>
      </div>
      <button
        onClick={onOpenCalendar}
        className="sm:hidden w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold py-2 transition active:scale-95"
      >
        <CalendarDays size={14} />
        {t.openCalendar}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Day timeline — hourly ruler with tasks positioned by time             */
/* ---------------------------------------------------------------------- */
const SLOT_HOURS = Array.from({ length: 24 }).map((_, i) => i);
const ALL_HOURS = SLOT_HOURS;

function slotForMinutes(mins) {
  let chosen = SLOT_HOURS[0];
  for (const h of SLOT_HOURS) {
    if (mins >= h * 60) chosen = h;
  }
  return chosen;
}

function getMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7; // 0 = Mon
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - firstWeekday);
  return Array.from({ length: 42 }).map((_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

function CalendarModal({ t, open, onClose, selectedDate, setSelectedDate, tasksByDate }) {
  const initial = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  useEffect(() => {
    if (open) {
      const d = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date();
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [open, selectedDate]);

  if (!open) return null;

  const grid = getMonthGrid(viewYear, viewMonth);
  const today = todayKey();
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(t.localeCode, { month: 'long', year: 'numeric' });

  const goPrev = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };
  const goNext = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="fc-modal-in fc-card fc-glow-mint rounded-2xl p-4 sm:p-5 w-full max-w-md relative border-emerald-400/25">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition" aria-label="close">
          <X size={18} />
        </button>

        <div className="flex items-center justify-between mb-4 pr-8">
          <button onClick={goPrev} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <ChevronLeft size={16} />
          </button>
          <p className="fc-display text-sm font-bold text-white capitalize">{monthLabel}</p>
          <button onClick={goNext} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1">
          {t.weekdaysShort.map((d) => (
            <div key={d} className="fc-mono text-[8px] sm:text-[9px] text-center text-slate-500 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-3">
          {grid.map((d) => {
            const key = dateKeyOf(d);
            const inMonth = d.getMonth() === viewMonth;
            const isSelected = key === selectedDate;
            const isToday = key === today;
            const hasTasks = (tasksByDate[key] || []).length > 0;
            return (
              <button
                key={key}
                onClick={() => {
                  setSelectedDate(key);
                  onClose();
                }}
                className={`aspect-square rounded-lg text-[11px] sm:text-xs flex flex-col items-center justify-center gap-0.5 border transition ${
                  !inMonth ? 'text-slate-700 border-transparent' : isSelected ? 'font-bold border-emerald-400' : isToday ? 'text-emerald-300 font-bold border-transparent' : 'text-slate-300 border-transparent hover:bg-slate-800'
                }`}
                style={isSelected ? { color: '#5EEAD4', background: 'rgba(52,211,153,0.1)', boxShadow: '0 0 10px -3px rgba(52,211,153,0.7)' } : {}}
              >
                <span>{d.getDate()}</span>
                <span className="w-1 h-1 rounded-full" style={{ background: hasTasks && inMonth ? '#F59E0B' : 'transparent' }} />
              </button>
            );
          })}
        </div>

        <button
          onClick={() => {
            setSelectedDate(today);
            onClose();
          }}
          className="w-full rounded-lg py-2 text-xs font-bold transition active:scale-95 border-2 bg-slate-800/40"
          style={{ borderColor: '#34D399', color: '#5EEAD4' }}
        >
          {t.todayLabel}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Compact HH:MM input — two small fields instead of the native           */
/*  <input type="time">, whose rendering gets clipped at narrow widths     */
/*  depending on the browser. This version is fully custom and never       */
/*  truncates, regardless of container size.                              */
/* ---------------------------------------------------------------------- */
function HHMMInput({ value, onChange, accent = '#F59E0B', className = '' }) {
  const [hh, mm] = (value || '00:00').split(':');

  const commit = (nextHH, nextMM) => {
    const h = String(Math.max(0, Math.min(23, parseInt(nextHH, 10) || 0))).padStart(2, '0');
    const m = String(Math.max(0, Math.min(59, parseInt(nextMM, 10) || 0))).padStart(2, '0');
    onChange(`${h}:${m}`);
  };

  return (
    <div className={`flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2 py-2.5 flex-shrink-0 ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={hh}
        onChange={(e) => commit(e.target.value.replace(/\D/g, ''), mm)}
        onBlur={(e) => commit(e.target.value, mm)}
        className="w-5 bg-transparent text-slate-800 text-sm text-center outline-none"
        aria-label="HH"
      />
      <span className="text-sm font-bold" style={{ color: accent }}>:</span>
      <input
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={mm}
        onChange={(e) => commit(hh, e.target.value.replace(/\D/g, ''))}
        onBlur={(e) => commit(hh, e.target.value)}
        className="w-5 bg-transparent text-slate-800 text-sm text-center outline-none"
        aria-label="MM"
      />
    </div>
  );
}

function DayTimeline({ t, selectedDate, tasksByDate, onToggleTask, onAddTask, onEditTask, onDeleteTask }) {
  const [newTime, setNewTime] = useState(() => {
    const now = new Date();
    const rounded = Math.round(now.getMinutes() / 5) * 5;
    const h = String((rounded === 60 ? now.getHours() + 1 : now.getHours()) % 24).padStart(2, '0');
    const m = String(rounded === 60 ? 0 : rounded).padStart(2, '0');
    return `${h}:${m}`;
  });
  const [newText, setNewText] = useState('');
  const [hourGridOpen, setHourGridOpen] = useState(false);
  const [justCompletedTaskId, setJustCompletedTaskId] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [editTimeDraft, setEditTimeDraft] = useState('');
  const seenTaskIds = useRef(new Set());

  const tasks = (tasksByDate[selectedDate] || []).slice().sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  const doneCount = tasks.filter((x) => x.done).length;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const handleAdd = () => {
    const text = newText.trim();
    if (!text) return;
    onAddTask(selectedDate, newTime, text);
    setNewText('');
  };

  return (
    <div className="fc-card fc-glow-amber rounded-3xl p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <h3 className="fc-display text-lg font-bold text-slate-900">{t.timelineTitle}</h3>
        <span className="fc-mono text-[10px] text-slate-500">{pct}%</span>
      </div>
      <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden mb-4 border border-slate-200">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: '#F2765C' }}
        />
      </div>

      <div className="space-y-2 mb-4 fc-scrollbar overflow-y-auto" style={{ maxHeight: 420 }}>
        {SLOT_HOURS.map((h) => {
          const slotTasks = tasks.filter((task) => slotForMinutes(timeToMinutes(task.time)) === h);
          const hasTasks = slotTasks.length > 0;
          return (
            <div
              key={h}
              className="rounded-xl border px-4 py-3 transition"
              style={{
                background: hasTasks ? '#FAFBFC' : '#FCFCFD',
                borderColor: hasTasks ? '#E7E9ED' : '#EFF1F4',
              }}
            >
              <span className="fc-mono text-[11px] font-bold tracking-widest text-slate-400">{String(h).padStart(2, '0')}:00</span>

              {!hasTasks && <p className="text-[13px] text-slate-400 italic mt-1.5">{t.slotFreeText}</p>}

              {hasTasks && (
                <div className="mt-2 space-y-2">
                  {slotTasks.map((task) => {
                    const isNew = !seenTaskIds.current.has(task.id);
                    seenTaskIds.current.add(task.id);
                    const catStyle = task.category ? CATEGORY_STYLE[task.category] : null;
                    const accentSolid = catStyle ? catStyle.grad.match(/#[0-9A-Fa-f]{6}/)[0] : '#F2765C';
                    const isEditing = editingTaskId === task.id;

                    if (isEditing) {
                      const saveEdit = () => {
                        const trimmed = editDraft.trim();
                        if (trimmed) onEditTask(selectedDate, task.id, trimmed, editTimeDraft);
                        setEditingTaskId(null);
                      };
                      return (
                        <div key={task.id} className="flex items-center gap-2 rounded-xl px-3 py-2 border border-slate-300 bg-white">
                          <HHMMInput value={editTimeDraft} onChange={setEditTimeDraft} className="py-1" />
                          <input
                            autoFocus
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') setEditingTaskId(null);
                            }}
                            className="flex-1 bg-transparent text-sm text-slate-800 outline-none"
                          />
                          <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-500 flex-shrink-0 p-1" aria-label={t.saveEdit}>
                            <Check size={16} />
                          </button>
                          <button onClick={() => setEditingTaskId(null)} className="text-slate-400 hover:text-slate-600 flex-shrink-0 p-1" aria-label={t.cancelEdit}>
                            <X size={16} />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div key={task.id} className="group relative">
                        <button
                          onClick={() => {
                            if (!task.done) {
                              setJustCompletedTaskId(task.id);
                              setTimeout(() => setJustCompletedTaskId((cur) => (cur === task.id ? null : cur)), 900);
                            }
                            onToggleTask(selectedDate, task.id);
                          }}
                          className={`w-full flex items-center gap-2.5 rounded-lg pl-3 pr-16 py-2.5 text-left text-sm transition border-l-4 ${isNew ? 'fc-magnet-in' : ''} ${
                            task.done ? 'text-slate-400' : 'text-slate-700'
                          }`}
                          style={{ background: `${accentSolid}14`, borderLeftColor: accentSolid, borderRadius: '0 8px 8px 0' }}
                        >
                          <span className="relative flex-shrink-0">
                            <span
                              className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center ${justCompletedTaskId === task.id ? 'fc-triumph-flash' : ''}`}
                              style={{ background: task.done ? accentSolid : 'transparent', borderColor: accentSolid }}
                            >
                              {task.done && <Check size={11} className="text-white" strokeWidth={3.5} />}
                            </span>
                            {justCompletedTaskId === task.id && (
                              <span className="fc-float-xp absolute left-1/2 -top-1 fc-mono text-[10px] font-bold whitespace-nowrap pointer-events-none" style={{ color: accentSolid }}>
                                {t.xpPopup}
                              </span>
                            )}
                          </span>
                          <span className="fc-mono text-[10px] flex-shrink-0" style={{ color: accentSolid }}>{task.time}</span>
                          <span className={`truncate ${task.done ? 'line-through' : ''}`} style={task.done ? { textDecorationColor: accentSolid } : {}}>{task.text}</span>
                        </button>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditDraft(task.text);
                              setEditTimeDraft(task.time);
                              setEditingTaskId(task.id);
                            }}
                            className="text-slate-400 hover:text-slate-600 p-1.5"
                            aria-label={t.editStep}
                            title={t.editStep}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteTask(selectedDate, task.id);
                            }}
                            className="text-slate-400 hover:text-rose-500 p-1.5"
                            aria-label={t.deleteQuest}
                            title={t.deleteQuest}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100">
        <HHMMInput value={newTime} onChange={setNewTime} accent="#F2765C" />
        <button
          type="button"
          onClick={() => setHourGridOpen((v) => !v)}
          className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-slate-400 hover:text-amber-600 hover:border-amber-300 border border-slate-200 bg-white transition"
          aria-label={t.quickTimeLabel}
          title={t.quickTimeLabel}
        >
          <TimerIcon size={14} />
        </button>
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={t.addTaskPlaceholder}
          className="flex-1 rounded-lg bg-white border border-slate-200 px-3 py-2.5 text-slate-800 placeholder-slate-400 text-sm outline-none focus:ring-2 focus:ring-amber-400/30 transition"
        />
        <button
          onClick={handleAdd}
          disabled={!newText.trim()}
          className="rounded-lg px-4 py-2.5 text-sm font-bold flex-shrink-0 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white"
          style={{ background: '#F2765C' }}
        >
          <Plus size={16} />
        </button>
      </div>
      {hourGridOpen && (
        <div className="fc-slide-down grid grid-cols-6 gap-1.5 mt-3">
          {ALL_HOURS.map((h) => {
            const hStr = `${String(h).padStart(2, '0')}:00`;
            return (
              <button
                key={h}
                onClick={() => setNewTime(hStr)}
                className={`px-2 py-1.5 rounded-lg text-xs font-bold transition border ${
                  newTime === hStr ? 'text-amber-700 border-amber-300 bg-amber-50' : 'bg-white border-slate-200 text-slate-500 hover:border-amber-300'
                }`}
              >
                {hStr}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Quick notes — a small always-available scratchpad                     */
/* ---------------------------------------------------------------------- */
function QuickNotes({ t, notes, setNotes }) {
  return (
    <div className="fc-card rounded-3xl p-6 h-full flex flex-col">
      <h3 className="fc-display text-lg font-bold text-slate-900 mb-1">{t.notesTitle}</h3>
      <p className="text-sm text-slate-400 mb-4">{t.notesSubtitle}</p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t.notesPlaceholder}
        className="w-full flex-1 rounded-xl bg-white border border-slate-200 px-4 py-3 text-slate-800 placeholder-slate-400 text-sm outline-none focus:ring-2 focus:ring-emerald-400/30 transition resize-none fc-scrollbar"
      />
    </div>
  );
}

function GrishaHero({ t, lang, mood, phraseText, tasksDone, mode, quests, setQuests, onTaskCompleted, onActivity, onQuestGenerated, xp, onAwardXP, levelUpMessage, streak }) {
  const [category, setCategory] = useState('work');
  const [editingStepId, setEditingStepId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [justCompletedId, setJustCompletedId] = useState(null);
  const [floatingXpId, setFloatingXpId] = useState(null);
  const [cupDropQuestId, setCupDropQuestId] = useState(null);
  const categoryIds = CATEGORY_IDS_BY_MODE[mode] || CATEGORY_IDS_BY_MODE.personal;

  useEffect(() => {
    if (!categoryIds.includes(category)) setCategory(categoryIds[0]);
  }, [mode]);
  const [quip, setQuip] = useState(null);
  const quipTimeoutRef = useRef(null);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [deadline, setDeadline] = useState('1m'); // '1w' | '1m' | '2m' | '3m' | '6m' | '1y' | 'none'
  const [deadlinePanelOpen, setDeadlinePanelOpen] = useState(false);
  const [customDeadline, setCustomDeadline] = useState('');

  const DEADLINE_OPTIONS = ['1w', '1m', '2m', '3m', '6m', '1y', 'none'];
  const deadlineToDate = (code) => {
    if (code === 'none') return null;
    const d = new Date();
    if (code === '1w') d.setDate(d.getDate() + 7);
    else if (code === '1m') d.setMonth(d.getMonth() + 1);
    else if (code === '2m') d.setMonth(d.getMonth() + 2);
    else if (code === '3m') d.setMonth(d.getMonth() + 3);
    else if (code === '6m') d.setMonth(d.getMonth() + 6);
    else if (code === '1y') d.setFullYear(d.getFullYear() + 1);
    return dateKeyOf(d);
  };

  const catMeta = t.categories[category];
  const dotColor = mood === 'happy' || mood === 'idle' ? '#F59E0B' : '#2DD4BF';
  const statusText = mood === 'happy' ? t.statusSuccess : mood === 'idle' ? t.statusIdle : t.statusOnline;
  const displayText = quip || levelUpMessage || phraseText;
  const grishaLevel = Math.floor(xp / 100) + 1;
  const xpInLevel = xp % 100;

  useEffect(() => () => {
    if (quipTimeoutRef.current) clearTimeout(quipTimeoutRef.current);
  }, []);

  const handleCategoryChange = (id) => {
    onActivity();
    setCategory(id);
    setQuip(t.categoryIntro[id]);
    if (quipTimeoutRef.current) clearTimeout(quipTimeoutRef.current);
    quipTimeoutRef.current = setTimeout(() => setQuip(null), 3200);
  };

  const handleBreakDown = async () => {
    const val = input.trim();
    if (!val || loading) return;
    onActivity();
    setLoading(true);
    const deadlineText = customDeadline || t.deadlineOptions[deadline];
    const texts = await generateSteps(lang, category, val, deadlineText);
    const newQuest = {
      id: `${Date.now()}`,
      category,
      mode,
      goal: val,
      completed: false,
      deadlineDate: customDeadline || deadlineToDate(deadline),
      steps: texts.map((text, i) => ({ id: `${Date.now()}-${i}`, text, done: false })),
    };
    setQuests((prev) => [newQuest, ...prev]);
    if (onQuestGenerated) onQuestGenerated(texts, category);
    setInput('');
    setLoading(false);
  };

  const toggleStep = (questId, stepId) => {
    onActivity();
    setQuests((prev) =>
      prev.map((q) => {
        if (q.id !== questId) return q;
        const nextSteps = q.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s));
        const allDone = nextSteps.every((s) => s.done);
        if (allDone && !q.completed) {
          onTaskCompleted();
          setCupDropQuestId(questId);
          setTimeout(() => setCupDropQuestId((cur) => (cur === questId ? null : cur)), 1000);
        }
        const target = nextSteps.find((s) => s.id === stepId);
        if (target && target.done) {
          setJustCompletedId(stepId);
          setFloatingXpId(stepId);
          if (onAwardXP) onAwardXP(10);
          setTimeout(() => setJustCompletedId((cur) => (cur === stepId ? null : cur)), 650);
          setTimeout(() => setFloatingXpId((cur) => (cur === stepId ? null : cur)), 900);
        }
        return { ...q, steps: nextSteps, completed: allDone };
      })
    );
  };

  const editStep = (questId, stepId, newText) => {
    onActivity();
    setQuests((prev) =>
      prev.map((q) => (q.id !== questId ? q : { ...q, steps: q.steps.map((s) => (s.id === stepId ? { ...s, text: newText } : s)) }))
    );
  };

  const removeQuest = (questId) => {
    onActivity();
    setQuests((prev) => prev.filter((q) => q.id !== questId));
  };

  return (
    <div className="fc-card fc-glow-mint rounded-3xl p-6 relative overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <span className="fc-mono text-[10px] tracking-[0.2em] text-slate-400">{t.consoleLabel}</span>
        <div className="flex items-center gap-3">
          {streak > 0 && (
            <div
              className="flex items-center rounded-full bg-orange-50 border px-2.5 py-1"
              style={{ borderColor: '#F2765C' }}
            >
              <span className="fc-mono text-[11px] font-bold" style={{ color: '#993C1D' }}>{t.streakBadge(streak)}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full fc-pulse-dot" style={{ backgroundColor: dotColor }} />
            <span className="fc-mono text-[10px] tracking-[0.15em] font-semibold" style={{ color: dotColor }}>
              {statusText}
            </span>
          </div>
        </div>
      </div>

      {/* Grisha — the hero of this card */}
      <div className="flex flex-col items-center text-center mb-5">
        {/* LOGO SLOT — Grisha's avatar. Plain emoji placeholder on purpose:
            swap for an <img> tag once you have your own character art. The
            mint frame and glow keep working the same way around it. */}
        <div
          className="fc-anim-bob relative w-24 h-24 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-5xl select-none mb-3"
          style={{ borderColor: '#CDBFF0', background: '#F1EDFB' }}
          aria-hidden="true"
        >
          🦫
        </div>
        <div className="flex items-center gap-2 mb-2">
          <p className="fc-display text-base font-bold text-slate-900 tracking-wide">{t.consoleName}</p>
          <span className="fc-mono text-[10px] text-emerald-600">· {t.tasksDoneStat(tasksDone)}</span>
        </div>

        <div className="w-full max-w-[220px] mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="fc-mono text-[9px] font-bold text-emerald-600">{t.levelLabel(grishaLevel)}</span>
            <span className="fc-mono text-[9px] text-slate-400">{t.xpLabel(xpInLevel, 100)}</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${xpInLevel}%`, background: '#639922' }}
            />
          </div>
        </div>

        <div
          key={displayText}
          className="fc-anim-pop relative text-base font-semibold leading-snug text-slate-800 w-full px-5 py-4 min-h-[4rem] flex items-center justify-center rounded-2xl"
          style={{ background: '#F1EDFB', border: '1px solid #CDBFF0' }}
        >
          <span>
            {displayText}
            <span className="inline-block w-1.5 h-4 ml-1 align-middle fc-cursor" style={{ backgroundColor: dotColor }} />
          </span>
        </div>
      </div>

      {/* category quick-replies, styled like chat chips replying to Grisha */}
      <div>
        <p className="fc-mono text-[10px] tracking-widest text-slate-400 mb-1.5">{t.categoriesLabel}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {categoryIds.map((id) => {
            const meta = t.categories[id];
            const style = CATEGORY_STYLE[id];
            const Icon = style.icon;
            const active = category === id;
            const solidHex = style.grad.match(/#[0-9A-Fa-f]{6}/)[0];
            return (
              <button
                key={id}
                onClick={() => handleCategoryChange(id)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold border-2 transition active:scale-95 ${
                  id === 'personal' ? 'col-span-2 sm:col-span-1' : ''
                } ${active ? 'bg-white' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                style={active ? { borderColor: solidHex, color: solidHex, background: `${solidHex}14` } : {}}
              >
                <Icon size={15} />
                {meta.label}
              </button>
            );
          })}
        </div>

        <p className="text-base font-bold text-slate-900 mb-2.5 mt-5 pt-4 border-t border-slate-100">{t.heroGreeting}</p>
        <div className="flex flex-col gap-2.5 mb-1">
          <div className="relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBreakDown()}
              onFocus={() => setDeadlinePanelOpen(true)}
              placeholder={catMeta.placeholder}
              className="fc-input-glow w-full rounded-xl bg-white border-2 border-slate-200 pl-5 pr-12 py-4 text-slate-800 text-base placeholder-slate-400 outline-none transition"
            />
            <button
              type="button"
              onClick={() => setDeadlinePanelOpen((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 transition"
              aria-label={t.deadlineLabel}
              title={t.deadlineLabel}
            >
              <TimerIcon size={16} />
            </button>
          </div>
          {deadlinePanelOpen && (
          <div className="fc-slide-down mt-2 pt-4 border-t border-slate-100">
            <p className="fc-mono text-[9px] tracking-widest text-slate-400 mb-1.5">{t.deadlineLabel}</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {DEADLINE_OPTIONS.map((code) => (
                <button
                  key={code}
                  onClick={() => {
                    setDeadline(code);
                    setCustomDeadline('');
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition border ${
                    deadline === code && !customDeadline
                      ? 'text-amber-700 border-amber-300 bg-amber-50'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-amber-300'
                  }`}
                >
                  {t.deadlineOptions[code]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="fc-mono text-[10px] text-slate-400 flex-shrink-0">{t.orExactDate}</span>
              <input
                type="date"
                value={customDeadline}
                onChange={(e) => setCustomDeadline(e.target.value)}
                className={`rounded-lg bg-white border px-2 py-1.5 text-slate-800 text-xs outline-none focus:ring-2 focus:ring-amber-400/30 transition ${
                  customDeadline ? 'border-amber-300' : 'border-slate-200'
                }`}
              />
            </div>
          </div>
          )}
          <button
            onClick={handleBreakDown}
            disabled={loading || !input.trim()}
            className={`mt-1 rounded-xl disabled:cursor-not-allowed font-extrabold px-6 py-4 text-base flex items-center justify-center gap-2 transition active:scale-95 whitespace-nowrap text-white`}
            style={
              loading || !input.trim()
                ? { background: '#F0997B' }
                : { background: '#F2765C' }
            }
          >
            {loading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                {t.buttonLoading}
              </>
            ) : (
              <>
                <Plus size={18} strokeWidth={3} />
                {t.buttonIdle}
              </>
            )}
          </button>
        </div>

        {quests.length === 0 && !loading && (
          <p className="text-sm text-slate-400 italic mt-2 flex items-center gap-1.5">
            <span aria-hidden="true">←</span>
            {t.emptyBreak}
          </p>
        )}
      </div>

      {/* Quest list — filtered by the selected category chip and Personal/Business mode */}
      {(() => {
        const visibleQuests = quests.filter((q) => q.category === category && (q.mode || 'personal') === mode);
        if (visibleQuests.length === 0) {
          if (quests.length === 0) return null;
          return <p className="mt-4 text-sm text-slate-400 italic">{t.noQuestsInFilter}</p>;
        }
        return (
          <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
            {visibleQuests.length > 1 && <p className="fc-mono text-[10px] tracking-[0.15em] text-slate-400">{t.questListTitle(visibleQuests.length)}</p>}
            {visibleQuests.map((q) => {
              const style = CATEGORY_STYLE[q.category];
              const Icon = style.icon;
              const doneCount = q.steps.filter((s) => s.done).length;
            const planPct = Math.round((doneCount / q.steps.length) * 100);

            return (
              <div key={q.id} className="fc-anim-pop border-l-2 border-slate-200 pl-4 relative">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon size={13} className="text-slate-400 flex-shrink-0" />
                    <p className="text-sm font-semibold text-slate-900 truncate">{q.goal}</p>
                  </div>
                  <button onClick={() => removeQuest(q.id)} className="text-slate-400 hover:text-slate-600 transition flex-shrink-0 p-1" aria-label={t.deleteQuest} title={t.deleteQuest}>
                    <X size={14} />
                  </button>
                </div>
                {q.deadlineDate && <p className="fc-mono text-[10px] text-amber-600 mb-2">{t.deadlineBy}: {q.deadlineDate}</p>}

                <div className="flex items-center justify-between mb-1.5">
                  <p className="fc-mono text-[10px] text-slate-400">{t.planProgress}</p>
                  <p className="fc-mono text-[10px] text-slate-400">{planPct}%</p>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden mb-3 border border-slate-200">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${planPct}%`, background: style.grad }}
                  />
                </div>

                <ul className="space-y-2 mb-2">
                  {q.steps.map((s, i) => {
                    const isNext = !s.done && q.steps.slice(0, i).every((prev) => prev.done);
                    const isEditing = editingStepId === s.id;

                    if (isEditing) {
                      const saveEdit = () => {
                        const trimmed = editDraft.trim();
                        if (trimmed) editStep(q.id, s.id, trimmed);
                        setEditingStepId(null);
                      };
                      return (
                        <li key={s.id}>
                          <div className="flex items-center gap-2 rounded-xl px-3 py-2 border border-emerald-300 bg-white">
                            <input
                              autoFocus
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit();
                                if (e.key === 'Escape') setEditingStepId(null);
                              }}
                              className="flex-1 bg-transparent text-sm text-slate-800 outline-none"
                            />
                            <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-500 flex-shrink-0 p-1" aria-label={t.saveEdit}>
                              <Check size={16} />
                            </button>
                            <button onClick={() => setEditingStepId(null)} className="text-slate-400 hover:text-slate-600 flex-shrink-0 p-1" aria-label={t.cancelEdit}>
                              <X size={16} />
                            </button>
                          </div>
                        </li>
                      );
                    }

                    return (
                      <li key={s.id} className="group relative">
                        <button
                          onClick={() => toggleStep(q.id, s.id)}
                          className={`w-full flex items-center gap-3 rounded-xl px-4 py-3.5 pr-11 text-left text-sm transition active:scale-[0.99] border ${
                            s.done
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : isNext
                              ? 'bg-amber-50 border-amber-300 text-slate-800'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span className="relative flex-shrink-0">
                            <span
                              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition ${
                                s.done ? 'bg-emerald-500 border-emerald-500' : isNext ? 'border-amber-400' : 'border-slate-300'
                              } ${justCompletedId === s.id ? 'fc-triumph-flash' : ''}`}
                            >
                              {s.done && <Check size={14} className="text-white" strokeWidth={3.5} />}
                            </span>
                            {floatingXpId === s.id && (
                              <span className="fc-float-xp absolute left-1/2 -top-1 fc-mono text-[11px] font-bold text-emerald-600 whitespace-nowrap pointer-events-none">
                                {t.xpPopup}
                              </span>
                            )}
                          </span>
                          <span className={`fc-mono text-[10px] flex-shrink-0 ${s.done ? 'text-emerald-600' : isNext ? 'text-amber-600' : 'text-slate-400'}`}>
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span className={s.done ? 'line-through decoration-emerald-400' : isNext ? 'font-medium' : ''}>{s.text}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditDraft(s.text);
                            setEditingStepId(s.id);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1.5 opacity-0 group-hover:opacity-100 transition"
                          aria-label={t.editStep}
                          title={t.editStep}
                        >
                          <Pencil size={14} />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div
                  className={`relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition border ${
                    q.completed ? 'bg-amber-50 border-amber-300 fc-anim-unlock' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="text-lg flex-shrink-0">🏁</span>
                  <span className={q.completed ? 'text-amber-700 font-semibold' : 'text-slate-400'}>{q.completed ? t.allDone : t.questFinish}</span>
                  {cupDropQuestId === q.id && (
                    <span className="fc-float-xp absolute left-1/2 top-0 fc-mono text-[11px] font-bold text-amber-600 whitespace-nowrap pointer-events-none">
                      {t.cupDropPopup}
                    </span>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        );
      })()}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Focus timer — HUD countdown ring, now pausable                        */
/* ---------------------------------------------------------------------- */
const RING_R = 54;
const RING_C = 2 * Math.PI * RING_R;

function Sparks({ sparks }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
      {sparks.map((s) => (
        <span
          key={s.id}
          className="fc-spark"
          style={{
            position: 'absolute', left: '50%', top: '46%', width: 3, height: 12, borderRadius: 2,
            background: s.color, boxShadow: `0 0 8px ${s.color}`,
            '--x': `${s.x}px`, '--y': `${s.y}px`, '--r': `${s.r}deg`,
          }}
        />
      ))}
    </div>
  );
}

function FocusTimer({ t, onSessionComplete, onActivity }) {
  const [duration, setDuration] = useState(DURATIONS[0]);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sparks, setSparks] = useState([]);
  const [praise, setPraise] = useState('');
  const startRef = useRef(null);
  const elapsedAtPauseRef = useRef(0);
  const rafRef = useRef(null);
  const praiseTimeoutRef = useRef(null);

  const totalMs = duration * 60 * 1000;

  const stopLoop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const finishSession = useCallback(() => {
    stopLoop();
    setRunning(false);
    setPaused(false);
    setProgress(100);
    startRef.current = null;
    const msgs = t.completeMsgs;
    setPraise(msgs[Math.floor(Math.random() * msgs.length)]);
    const particles = Array.from({ length: 20 }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / 20;
      return {
        id: `${Date.now()}-${i}`,
        x: Math.cos(angle) * (60 + Math.random() * 40),
        y: Math.sin(angle) * (60 + Math.random() * 40),
        r: Math.random() * 360,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
      };
    });
    setSparks(particles);
    onSessionComplete();
    setTimeout(() => {
      setSparks([]);
      setProgress(0);
    }, 2400);
    if (praiseTimeoutRef.current) clearTimeout(praiseTimeoutRef.current);
    praiseTimeoutRef.current = setTimeout(() => setPraise(''), 7000);
  }, [t, onSessionComplete]);

  const tick = useCallback(() => {
    if (!startRef.current) return;
    const elapsed = Date.now() - startRef.current;
    const pct = Math.min(100, (elapsed / totalMs) * 100);
    setProgress(pct);
    if (pct >= 100) {
      finishSession();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [totalMs, finishSession]);

  const start = () => {
    onActivity();
    if (praiseTimeoutRef.current) clearTimeout(praiseTimeoutRef.current);
    setPraise('');
    setRunning(true);
    setPaused(false);
    setProgress(0);
    elapsedAtPauseRef.current = 0;
    startRef.current = Date.now();
    rafRef.current = requestAnimationFrame(tick);
  };

  const pause = () => {
    onActivity();
    stopLoop();
    elapsedAtPauseRef.current = Date.now() - startRef.current;
    startRef.current = null;
    setPaused(true);
  };

  const resume = () => {
    onActivity();
    startRef.current = Date.now() - elapsedAtPauseRef.current;
    setPaused(false);
    rafRef.current = requestAnimationFrame(tick);
  };

  const cancel = () => {
    onActivity();
    stopLoop();
    setRunning(false);
    setPaused(false);
    setProgress(0);
    startRef.current = null;
  };

  useEffect(() => () => {
    stopLoop();
    if (praiseTimeoutRef.current) clearTimeout(praiseTimeoutRef.current);
  }, []);

  const remainingFraction = 1 - progress / 100;
  const dashOffset = RING_C * (1 - remainingFraction);
  const totalSeconds = Math.max(0, Math.round((totalMs * remainingFraction) / 1000));
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  const nearEnd = progress > 85;
  const ringColorVar = paused ? '#94A3B8' : nearEnd ? '#F59E0B' : '#2DD4BF';

  const expanded = running || !!praise;

  return (
    <div className="fc-card fc-glow-amber rounded-3xl p-5 relative overflow-hidden">
      {!expanded ? (
        /* ---------------- COMPACT (idle) ---------------- */
        <div className="fc-anim-pop flex items-center gap-3 flex-wrap">
          <div
            className="w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0"
            style={{ borderColor: '#CDBFF0', background: '#F1EDFB' }}
          >
            <TimerIcon size={16} className="text-violet-600" />
          </div>
          <div className="flex-shrink-0 mr-1">
            <p className="fc-display text-sm font-bold text-slate-900 leading-tight">{t.timerTitle}</p>
            <p className="text-[11px] text-slate-400 leading-tight">{t.timerSubtitle}</p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            {DURATIONS.map((m) => (
              <button
                key={m}
                onClick={() => {
                  onActivity();
                  setDuration(m);
                }}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition active:scale-95 ${
                  duration === m ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300'
                }`}
              >
                {t.minutesLabel(m)}
              </button>
            ))}
          </div>
          <button
            onClick={start}
            className="ml-auto flex-shrink-0 rounded-xl text-white font-bold px-5 py-2.5 text-sm flex items-center justify-center gap-2 transition active:scale-95"
            style={{ background: '#639922' }}
          >
            <Play size={14} />
            {t.startButton}
          </button>
        </div>
      ) : (
        /* ---------------- EXPANDED (running / celebrating) ---------------- */
        <div className="fc-anim-pop">
          <div className="flex items-center gap-2 fc-mono text-[10px] tracking-[0.2em] mb-2 text-amber-600">
            <TimerIcon size={13} />
            <span>FOCUS SESSION</span>
          </div>
          <h3 className="fc-display text-lg font-bold text-slate-900 mb-1">{t.timerTitle}</h3>
          <p className="text-sm text-slate-400 mb-5">{t.timerSubtitle}</p>

          <div className="flex flex-col items-center">
            <div className="relative w-40 h-40 mb-5 flex items-center justify-center">
              <Sparks sparks={sparks} />
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r={RING_R} fill="none" stroke="#EEF0F3" strokeWidth="6" />
                <circle
                  cx="60" cy="60" r={RING_R} fill="none" stroke={ringColorVar} strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={RING_C} strokeDashoffset={running ? dashOffset : 0}
                  style={{ transition: 'stroke-dashoffset 0.15s linear, stroke 0.4s ease' }}
                  className={nearEnd && running && !paused ? 'fc-ring-pulse' : ''}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {running ? (
                  <>
                    <span className="fc-mono text-2xl font-bold text-slate-800 tracking-wider">
                      {mm}:{ss}
                    </span>
                    <span className="fc-mono text-[9px] tracking-[0.2em] text-slate-400 mt-1">{paused ? t.pausedBanner : t.remainingLabel}</span>
                  </>
                ) : (
                  <Award size={30} className="text-amber-500" strokeWidth={1.5} />
                )}
              </div>
            </div>

            {running && !paused && (
              <div className="fc-anim-pop mb-4 flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-700 fc-mono text-[10px] tracking-[0.1em] px-3 py-1.5 rounded-full">
                <Lock size={11} />
                {t.lockedBanner}
              </div>
            )}

            {!running && praise && <div className="fc-anim-pop mb-4 text-center text-amber-700 text-sm font-semibold max-w-[16rem]">{praise}</div>}

            {running ? (
              <div className="w-full flex gap-2">
                {paused ? (
                  <button
                    onClick={resume}
                    className="flex-1 rounded-xl text-white font-bold px-4 py-3.5 text-sm flex items-center justify-center gap-2 transition active:scale-95"
                    style={{ background: '#639922' }}
                  >
                    <Play size={15} />
                    {t.resumeButton}
                  </button>
                ) : (
                  <button
                    onClick={pause}
                    className="flex-1 rounded-xl bg-white hover:bg-slate-50 text-slate-600 font-bold px-4 py-3.5 text-sm flex items-center justify-center gap-2 transition active:scale-95 border border-slate-200"
                  >
                    <Pause size={15} />
                    {t.pauseButton}
                  </button>
                )}
                <button
                  onClick={finishSession}
                  className="rounded-xl text-white font-bold px-4 py-3.5 text-sm flex items-center justify-center gap-2 transition active:scale-95"
                  style={{ background: '#EF9F27' }}
                  aria-label={t.finishEarly}
                  title={t.finishEarly}
                >
                  <Zap size={15} />
                </button>
                <button
                  onClick={cancel}
                  className="rounded-xl bg-white hover:bg-slate-50 text-slate-500 font-medium px-4 py-3.5 text-sm flex items-center justify-center transition active:scale-95 border border-slate-200"
                  aria-label={t.cancelButton}
                  title={t.cancelButton}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={start}
                className="w-full rounded-xl font-bold px-5 py-3.5 text-sm flex items-center justify-center gap-2 transition active:scale-95 border-2 bg-white"
                style={{ borderColor: '#639922', color: '#3B6D11' }}
              >
                <Play size={15} />
                {t.startButton}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Medals / rewards vault                                                */
/* ---------------------------------------------------------------------- */
function MedalCard({ icon, name, desc, unlocked, ratio, progressText, lockedLabel, unlockedLabel, spin, justUnlocked, seasonLabel }) {
  return (
    <div
      className={`relative rounded-xl p-4 flex flex-col items-center text-center transition ${
        unlocked ? 'fc-card fc-glow-amber' : 'bg-slate-50 border border-slate-200'
      } ${justUnlocked ? 'fc-anim-unlock' : ''}`}
      style={unlocked ? { borderColor: '#FAC775' } : {}}
    >
      <div
        className={`w-11 h-11 rounded-full border-2 flex items-center justify-center mb-2.5 transition-colors duration-300 ${
          unlocked ? 'border-amber-400 text-amber-600' : 'border-slate-300 text-slate-400'
        } ${unlocked && spin ? 'fc-anim-spin-slow' : ''}`}
      >
        {icon}
      </div>
      <p className={`text-[13px] font-bold mb-0.5 ${unlocked ? 'text-amber-700' : 'text-slate-600'}`}>{name}</p>
      <p className="text-[11px] text-slate-400 mb-1 leading-snug">{desc}</p>
      <span className={`fc-mono text-[10px] tracking-wide font-bold px-2 py-0.5 rounded-full ${unlocked ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>
        {unlocked ? unlockedLabel : lockedLabel}
      </span>
      <span className="fc-mono text-[10px] text-slate-400 mt-1.5">{progressText}</span>
      <MiniProgress ratio={ratio} unlocked={unlocked} />
      {seasonLabel && (
        <span className="fc-mono text-[9px] tracking-widest text-amber-600/70 mt-2 pt-2 border-t border-amber-200 w-full">
          {seasonLabel}
        </span>
      )}
    </div>
  );
}

function RewardsVault({ t, tasksDone, sessionsDone, earlyBirdDone }) {
  const cupStageCount = Math.min(tasksDone, CUP_TOTAL);

  return (
    <div className="fc-card fc-glow-amber rounded-3xl p-6">
      <div className="flex items-center gap-2 fc-mono text-[10px] tracking-[0.2em] mb-2 text-amber-600">
        <Trophy size={13} />
        <span>VAULT</span>
      </div>
      <h3 className="fc-display text-lg font-bold text-slate-900 mb-1">{t.medalsTitle}</h3>
      <p className="text-sm text-slate-400 mb-4">{t.medalsSubtitle}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MedalCard
          icon={<Star size={18} />} name={t.medal1Name} desc={t.medal1Desc}
          unlocked={tasksDone >= 1} justUnlocked={tasksDone === 1}
          ratio={Math.min(tasksDone, 1) / 1} progressText={t.progressTasks(Math.min(tasksDone, 1), 1)}
          lockedLabel={t.locked} unlockedLabel={t.unlocked}
        />
        <MedalCard
          icon={<CupOfCalmIcon tasksDone={tasksDone} size={20} />} name={t.medalCupName} desc={`${t.medalCupDesc} · ${t.cupStage(tasksDone)}`}
          unlocked={tasksDone >= 1} justUnlocked={false}
          ratio={cupStageCount / CUP_TOTAL} progressText={t.progressStages(cupStageCount, CUP_TOTAL)}
          lockedLabel={t.locked} unlockedLabel={t.unlocked}
          seasonLabel={t.cupSeasonLabel}
        />
        <MedalCard
          icon={<Trophy size={18} />} name={t.medalReelsName} desc={t.medalReelsDesc}
          unlocked={tasksDone >= 1} justUnlocked={tasksDone === 1}
          ratio={Math.min(tasksDone, 1) / 1} progressText={t.progressTasks(Math.min(tasksDone, 1), 1)}
          lockedLabel={t.locked} unlockedLabel={t.unlocked} spin
        />
        <MedalCard
          icon={<Zap size={18} />} name={t.medalMasterName} desc={t.medalMasterDesc}
          unlocked={sessionsDone >= 3} justUnlocked={sessionsDone === 3}
          ratio={Math.min(sessionsDone, 3) / 3} progressText={t.progressSessions(Math.min(sessionsDone, 3), 3)}
          lockedLabel={t.locked} unlockedLabel={t.unlocked}
        />
        <MedalCard
          icon={<Award size={18} />} name={t.medalFiveName} desc={t.medalFiveDesc}
          unlocked={tasksDone >= 5} justUnlocked={tasksDone === 5}
          ratio={Math.min(tasksDone, 5) / 5} progressText={t.progressTasks(Math.min(tasksDone, 5), 5)}
          lockedLabel={t.locked} unlockedLabel={t.unlocked}
        />
        <MedalCard
          icon={<Sunrise size={18} />} name={t.medalEarlyName} desc={t.medalEarlyDesc}
          unlocked={earlyBirdDone} justUnlocked={earlyBirdDone}
          ratio={earlyBirdDone ? 1 : 0} progressText={t.progressTasks(earlyBirdDone ? 1 : 0, 1)}
          lockedLabel={t.locked} unlockedLabel={t.unlocked}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Language toggle                                                       */
/* ---------------------------------------------------------------------- */
function LangToggle({ lang, setLang }) {
  return (
    <div className="flex items-center gap-1 bg-slate-800/40 backdrop-blur-sm border border-slate-700 rounded-full p-1">
      <Globe2 size={13} className="text-slate-500 ml-1.5" />
      {['ru', 'en'].map((code) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={`fc-mono px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition border ${
            lang === code ? 'border-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
          style={lang === code ? { color: '#5EEAD4', boxShadow: '0 0 10px -2px rgba(52,211,153,0.8)' } : {}}
        >
          {code}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/*  Personal / Business mode toggle                                         */
/*  ------------------------------------------------------------------------ */
/*  STUB NOTE: this only switches a label + which categories are visible     */
/*  for now. There's no real paywall or account-tier logic behind it yet —   */
/*  when you're ready to actually charge for "Business", this is the spot    */
/*  to gate features behind a real subscription check (e.g. from Supabase).  */
/* ------------------------------------------------------------------------ */
function ModeToggle({ t, mode, setMode }) {
  return (
    <div className="flex items-center gap-1 bg-slate-800/40 backdrop-blur-sm border border-slate-700 rounded-full p-1">
      {['personal', 'business'].map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap border ${
            mode === m ? 'border-violet-400' : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
          style={mode === m ? { color: '#C4B5FD', boxShadow: '0 0 10px -2px rgba(168,85,247,0.8)' } : {}}
        >
          {m === 'personal' ? t.modePersonal : t.modeBusiness}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Toolbar (Tips / Guide buttons)                                        */
/* ---------------------------------------------------------------------- */
function Toolbar({ t, onOpenTips, onOpenGuide }) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <button
        onClick={onOpenTips}
        className="flex items-center gap-2 rounded-xl bg-slate-900/85 border border-amber-400/30 text-amber-200 text-sm font-semibold px-4 py-2.5 transition hover:border-amber-400/60 active:scale-95"
        style={{ boxShadow: '0 0 18px -6px rgba(245,158,11,0.4)' }}
      >
        <Lightbulb size={15} />
        {t.tipsButton}
      </button>
      <button
        onClick={onOpenGuide}
        className="flex items-center gap-2 rounded-xl bg-slate-900/85 border border-emerald-400/30 text-emerald-200 text-sm font-semibold px-4 py-2.5 transition hover:border-emerald-400/60 active:scale-95"
        style={{ boxShadow: '0 0 18px -6px rgba(16,185,129,0.4)' }}
      >
        <HelpCircle size={15} />
        {t.guideButton}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Weekly activity strip — now backed by a real per-day history log      */
/* ---------------------------------------------------------------------- */
function ActivityStrip({ t, days, streak }) {
  const activeDays = days.filter((d) => d.count > 0).length;
  const fraction = activeDays / 7;
  const fillTopY = 34 - fraction * 16;
  const showLeaves = fraction >= 1;
  const CUP_PATH = 'M12 18 H36 L32 34 Q24 40 16 34 Z';

  return (
    <div className="fc-card fc-glow-mint fc-fade-up rounded-2xl px-5 py-4 mb-6 flex items-center gap-5 flex-wrap">
      <div className="relative flex-shrink-0" style={{ width: 84, height: 84 }}>
        <svg viewBox="0 0 84 84" width="84" height="84" aria-hidden="true">
          <defs>
            <linearGradient id="fc-pot-body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#0F766E" />
            </linearGradient>
            <clipPath id="fc-week-cup-clip">
              <path d={CUP_PATH} />
            </clipPath>
            <linearGradient id="fc-week-tea" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#FCD34D" />
            </linearGradient>
          </defs>

          {/* teapot */}
          <ellipse cx="26" cy="14" rx="15" ry="8.5" fill="url(#fc-pot-body)" />
          <path d="M13 14 Q4 11 3 19" stroke="#0F766E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M39 12.5 Q51 10 55 20" stroke="#0F766E" strokeWidth="3" fill="none" strokeLinecap="round" />
          <ellipse cx="26" cy="7" rx="6" ry="2.5" fill="#0F766E" />

          {/* pour stream */}
          {fraction > 0 && (
            <path d="M54 21 Q60 27 63 34" stroke="#FCD34D" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.85" className="fc-pulse-dot" />
          )}

          {/* cup group — every child shares this one transform, so fill/outline/leaves always line up */}
          <g transform="translate(6,20) scale(1.5)">
            <g clipPath="url(#fc-week-cup-clip)">
              <rect x="10" y={fillTopY} width="28" height="26" fill="url(#fc-week-tea)" />
            </g>
            <path d={CUP_PATH} fill="none" stroke="#0F766E" strokeWidth="1.1" strokeLinejoin="round" />
            <line x1="15" y1="41" x2="33" y2="41" stroke="#0F766E" strokeWidth="1" opacity="0.5" strokeLinecap="round" />
            {showLeaves && (
              <>
                <path d="M17 15 Q19 11 17 7" stroke="#94A3B8" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.65" />
                <path d="M31 15 Q33 11 31 7" stroke="#94A3B8" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.65" />
                <ellipse cx="16" cy="22" rx="2" ry="1.1" fill="#34D399" transform="rotate(20 16 22)" />
                <ellipse cx="32" cy="20" rx="2" ry="1.1" fill="#34D399" transform="rotate(-15 32 20)" />
              </>
            )}
          </g>
        </svg>
      </div>

      <div className="flex-1 min-w-[200px]">
        <p className="text-sm font-semibold text-slate-900 leading-tight mb-0.5">{t.streakTitle}</p>
        <p className="fc-mono text-[10px] text-emerald-600 mb-2">{t.streakLabel(streak)}</p>
        <div className="flex items-center gap-1.5">
          {days.map((d) => (
            <span
              key={d.key}
              title={t.streakDays[d.weekdayIndex]}
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{
                background: d.count > 0 ? (d.isToday ? '#34D399' : '#0F766E') : '#E2E5E9',
              }}
            />
          ))}
        </div>
      </div>

      <span className="fc-mono text-[9px] tracking-wide text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full flex-shrink-0">{t.streakDeviceNote}</span>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Root component                                                        */
/* ---------------------------------------------------------------------- */
export default function FocusChaos() {
  const persisted = useMemo(() => loadPersisted(), []);
  const { user, loading: authLoading } = useAuthUser();
  const [cloudLoaded, setCloudLoaded] = useState(false);

  const [lang, setLang] = useState(persisted?.lang || 'ru');
  const t = T[lang];

  useFavicon(`${t.appName} — ${t.tagline}`);

  const [tasksDone, setTasksDone] = useState(persisted?.tasksDone || 0);
  const [xp, setXp] = useState(persisted?.xp || 0);
  const [levelUpMessage, setLevelUpMessage] = useState(null);
  const levelUpTimeoutRef = useRef(null);
  const [sessionsDone, setSessionsDone] = useState(persisted?.sessionsDone || 0);
  const [earlyBirdDone, setEarlyBirdDone] = useState(persisted?.earlyBirdDone || false);
  const [history, setHistory] = useState(persisted?.history || {});
  const [quests, setQuests] = useState(persisted?.quests || []);
  const [tasksByDate, setTasksByDate] = useState(persisted?.tasksByDate || {});
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [notes, setNotes] = useState(persisted?.notes || '');
  const [mode, setMode] = useState(persisted?.mode || 'personal'); // 'personal' | 'business' — see ModeToggle note

  const addTask = useCallback((dateKey, time, text, category = null) => {
    setTasksByDate((prev) => {
      const dayTasks = prev[dateKey] || [];
      const next = [...dayTasks, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time, text, done: false, category }].sort(
        (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)
      );
      return { ...prev, [dateKey]: next };
    });
  }, []);

  const handleQuestGenerated = useCallback(
    (texts, category) => {
      const key = todayKey();
      const now = new Date();
      texts.forEach((text, i) => {
        const slot = new Date(now.getTime() + i * 45 * 60000);
        addTask(key, formatTimeHHMM(slot), text, category);
      });
    },
    [addTask]
  );

  // On sign-in: pull this account's saved progress from Supabase and adopt it
  // (cloud is treated as the source of truth once logged in, so progress
  // follows the person across devices instead of staying stuck in one browser).
  useEffect(() => {
    if (!user) {
      setCloudLoaded(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('user_progress').select('state').eq('user_id', user.id).maybeSingle();
      if (!cancelled && !error && data?.state) {
        const cloud = data.state;
        if (cloud.lang) setLang(cloud.lang);
        setTasksDone(cloud.tasksDone || 0);
        setSessionsDone(cloud.sessionsDone || 0);
        setEarlyBirdDone(cloud.earlyBirdDone || false);
        setHistory(cloud.history || {});
        setQuests(cloud.quests || []);
        setXp(cloud.xp || 0);
        setTasksByDate(cloud.tasksByDate || {});
        setNotes(cloud.notes || '');
      }
      if (!cancelled) setCloudLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Always keep the local copy fresh (works instantly, no login required).
  // Once signed in and the initial cloud pull has finished, also push
  // every change up to Supabase so it's available on other devices too.
  useEffect(() => {
    const snapshot = { lang, tasksDone, sessionsDone, earlyBirdDone, history, quests, tasksByDate, notes, mode, xp };
    savePersisted(snapshot);
    if (user && cloudLoaded) {
      supabase
        .from('user_progress')
        .upsert({ user_id: user.id, state: snapshot, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) console.error('Cloud sync failed:', error.message);
        });
    }
  }, [lang, tasksDone, sessionsDone, earlyBirdDone, history, quests, tasksByDate, notes, mode, xp, user, cloudLoaded]);

  const recordActivity = useCallback(() => {
    const key = todayKey();
    setHistory((h) => ({ ...h, [key]: (h[key] || 0) + 1 }));
  }, []);

  const { weekDays, streak } = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = dateKeyOf(d);
      const weekdayIndex = (d.getDay() + 6) % 7; // 0 = Mon ... 6 = Sun
      days.push({ key, count: history[key] || 0, isToday: i === 0, weekdayIndex });
    }
    let s = 0;
    const cursor = new Date();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const key = dateKeyOf(cursor);
      if ((history[key] || 0) > 0) {
        s += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }
    return { weekDays: days, streak: s };
  }, [history]);

  const [mood, setMood] = useState('neutral');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const lastActivityRef = useRef(Date.now());
  const happyTimeoutRef = useRef(null);

  const [tab, setTab] = useState('focus'); // 'focus' | 'rewards'
  const [tipsOpen, setTipsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [cookieConsent, setCookieConsent] = useState(() => {
    try {
      return localStorage.getItem('focuschaos_cookie_consent') || null;
    } catch {
      return null;
    }
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const registerActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setMood((m) => (m === 'idle' ? 'neutral' : m));
  }, []);

  const maybeUnlockEarlyBird = () => {
    const hour = new Date().getHours();
    if (hour < 9) setEarlyBirdDone(true);
  };

  const triggerHappy = useCallback(() => {
    lastActivityRef.current = Date.now();
    setPhraseIndex((i) => pickRandom(T[lang].petHappy, i));
    setMood('happy');
    if (happyTimeoutRef.current) clearTimeout(happyTimeoutRef.current);
    happyTimeoutRef.current = setTimeout(() => setMood('neutral'), 4500);
  }, [lang]);

  const awardXP = useCallback(
    (amount) => {
      setXp((prevXp) => {
        const nextXp = prevXp + amount;
        const prevLevel = Math.floor(prevXp / 100) + 1;
        const nextLevel = Math.floor(nextXp / 100) + 1;
        if (nextLevel > prevLevel) {
          setLevelUpMessage(T[lang].levelUpPhrase(nextLevel));
          setMood('happy');
          if (happyTimeoutRef.current) clearTimeout(happyTimeoutRef.current);
          if (levelUpTimeoutRef.current) clearTimeout(levelUpTimeoutRef.current);
          happyTimeoutRef.current = setTimeout(() => setMood('neutral'), 5000);
          levelUpTimeoutRef.current = setTimeout(() => setLevelUpMessage(null), 5000);
        }
        return nextXp;
      });
    },
    [lang]
  );

  const toggleTask = useCallback(
    (dateKey, taskId) => {
      registerActivity();
      let becameDone = false;
      setTasksByDate((prev) => ({
        ...prev,
        [dateKey]: (prev[dateKey] || []).map((tsk) => {
          if (tsk.id !== taskId) return tsk;
          const nextDone = !tsk.done;
          if (nextDone) becameDone = true;
          return { ...tsk, done: nextDone };
        }),
      }));
      if (becameDone) {
        triggerHappy();
        awardXP(10);
      }
    },
    [triggerHappy, registerActivity, awardXP]
  );

  const editTask = useCallback((dateKey, taskId, newText, newTime) => {
    registerActivity();
    setTasksByDate((prev) => {
      const updated = (prev[dateKey] || [])
        .map((tsk) => (tsk.id === taskId ? { ...tsk, text: newText, time: newTime || tsk.time } : tsk))
        .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
      return { ...prev, [dateKey]: updated };
    });
  }, [registerActivity]);

  const deleteTask = useCallback((dateKey, taskId) => {
    registerActivity();
    setTasksByDate((prev) => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).filter((tsk) => tsk.id !== taskId),
    }));
  }, [registerActivity]);

  useEffect(() => {
    const iv = setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor > 14000) {
        setMood((m) => {
          if (m === 'happy') return m;
          if (m !== 'idle') setPhraseIndex((i) => pickRandom(T[lang].petIdle, i));
          return 'idle';
        });
      }
    }, 3000);
    return () => clearInterval(iv);
  }, [lang]);

  useEffect(() => () => {
    if (happyTimeoutRef.current) clearTimeout(happyTimeoutRef.current);
  }, []);

  useEffect(() => {
    const showOne = () => {
      const messages = T[lang].reminders;
      const text = messages[Math.floor(Math.random() * messages.length)];
      const id = Date.now();
      setToast({ id, text });
      setTimeout(() => {
        setToast((cur) => (cur && cur.id === id ? null : cur));
      }, 6000);
    };
    const first = setTimeout(showOne, 9000);
    const iv = setInterval(showOne, 34000);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, [lang]);

  const currentHour = new Date().getHours();
  const isNightTime = currentHour >= 21 || currentHour < 6;
  const petNeutralTimeAware = isNightTime ? t.petNeutralNight : t.petNeutralDay;
  const phraseText = mood === 'happy' ? t.petHappy[phraseIndex] : mood === 'idle' ? t.petIdle[phraseIndex] : petNeutralTimeAware;

  const handleTaskCompleted = () => {
    setTasksDone((n) => n + 1);
    recordActivity();
    maybeUnlockEarlyBird();
    triggerHappy();
  };

  const handleSessionCompleted = () => {
    setSessionsDone((n) => n + 1);
    recordActivity();
    maybeUnlockEarlyBird();
    triggerHappy();
  };

  if (authLoading) {
    return <div className="min-h-screen" style={{ background: '#0b0f19' }} />;
  }

  if (!user) {
    return (
      <>
        <GlobalStyle />
        <AuthPanel variant="gate" lang={lang} user={user} appName={t.appName} tagline={t.tagline} />
      </>
    );
  }

  return (
    <div className="fc-root min-h-screen text-slate-800 px-4 py-6 sm:px-6 relative overflow-hidden" style={{ background: '#FAF7F1' }}>
      <GlobalStyle />
      <AmbientGlow />

      <TipsModal t={t} open={tipsOpen} onClose={() => setTipsOpen(false)} />
      <ReviewsAppsModal t={t} open={moreOpen} onClose={() => setMoreOpen(false)} user={user} />
      <CookieBanner
        t={t}
        consent={cookieConsent}
        onChoice={(choice) => {
          setCookieConsent(choice);
          try {
            localStorage.setItem('focuschaos_cookie_consent', choice);
          } catch {}
        }}
      />
      <GuideModal t={t} open={guideOpen} onClose={() => setGuideOpen(false)} />
      <LegalModal title={t.legalOfferTitle} sections={t.legalOfferBody} disclaimer={t.legalDisclaimer} open={offerOpen} onClose={() => setOfferOpen(false)} />
      <LegalModal title={t.legalPrivacyTitle} sections={t.legalPrivacyBody} disclaimer={t.legalDisclaimer} open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <CalendarModal t={t} open={calendarOpen} onClose={() => setCalendarOpen(false)} selectedDate={selectedDate} setSelectedDate={setSelectedDate} tasksByDate={tasksByDate} />
      <ReminderToast t={t} toast={toast} onDismiss={() => setToast(null)} />

      <div className="max-w-5xl mx-auto relative z-10">
        <header className="fc-fade-up mb-4 pb-4 border-b border-slate-200">
          <div className="flex items-start justify-between flex-wrap gap-y-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                {/* LOGO SLOT — app mark. Swap the <Zap> icon below for an <img> tag
                    pointing at your own logo file whenever you have one ready. */}
                <div
                  className="w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0"
                  style={{ background: '#F1EDFB', borderColor: '#CDBFF0', color: '#534AB7' }}
                >
                  <Zap size={20} strokeWidth={2} />
                </div>
                <div>
                  <h1 className="fc-display text-xl font-extrabold leading-none text-slate-900 tracking-tight">{t.appName}</h1>
                  <p className="fc-mono text-[10px] text-slate-500 mt-1.5 tracking-wide">{t.tagline}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTipsOpen(true)}
                  className="w-9 h-9 rounded-full bg-white border border-slate-200 text-amber-600 flex items-center justify-center transition hover:border-amber-300"
                  aria-label={t.tipsButton}
                  title={t.tipsButton}
                >
                  <Lightbulb size={15} />
                </button>
                <button
                  onClick={() => setGuideOpen(true)}
                  className="w-9 h-9 rounded-full bg-white border border-slate-200 text-emerald-600 flex items-center justify-center transition hover:border-emerald-300"
                  aria-label={t.guideButton}
                  title={t.guideButton}
                >
                  <HelpCircle size={15} />
                </button>
                <button
                  onClick={() => setMoreOpen(true)}
                  className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-500 flex items-center justify-center transition hover:border-slate-300"
                  aria-label={t.reviewsTitle}
                  title={t.reviewsTitle}
                >
                  <MessageSquareQuote size={15} />
                </button>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3">
              <AuthPanel lang={lang} user={user} />
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <ModeToggle t={t} mode={mode} setMode={setMode} />
                <LangToggle lang={lang} setLang={setLang} />
              </div>
            </div>
          </div>
        </header>

        {/* Two tabs — only one thing on screen at a time, nothing to scroll past */}
        <div className="fc-fade-up flex gap-2 mb-5" style={{ animationDelay: '60ms' }}>
          <button
            onClick={() => setTab('focus')}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition border ${
              tab === 'focus' ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
            style={tab === 'focus' ? { background: '#9F7AEA' } : {}}
          >
            {t.tabFocus}
          </button>
          <button
            onClick={() => setTab('rewards')}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition border ${
              tab === 'rewards' ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
            style={tab === 'rewards' ? { background: '#F2765C' } : {}}
          >
            {t.tabRewards}
          </button>
        </div>

        {tab === 'focus' ? (
          <div className="fc-fade-up" style={{ animationDelay: '100ms' }}>
            <div className="mb-4">
              <WeekStrip t={t} selectedDate={selectedDate} setSelectedDate={setSelectedDate} tasksByDate={tasksByDate} onOpenCalendar={() => setCalendarOpen(true)} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <DayTimeline t={t} selectedDate={selectedDate} tasksByDate={tasksByDate} onToggleTask={toggleTask} onAddTask={addTask} onEditTask={editTask} onDeleteTask={deleteTask} />
              <GrishaHero
                t={t}
                lang={lang}
                mood={mood}
                phraseText={phraseText}
                tasksDone={tasksDone}
                mode={mode}
                quests={quests}
                setQuests={setQuests}
                onTaskCompleted={handleTaskCompleted}
                onActivity={registerActivity}
                onQuestGenerated={handleQuestGenerated}
                xp={xp}
                onAwardXP={awardXP}
                levelUpMessage={levelUpMessage}
                streak={streak}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <FocusTimer t={t} onSessionComplete={handleSessionCompleted} onActivity={registerActivity} />
              <QuickNotes t={t} notes={notes} setNotes={setNotes} />
            </div>
          </div>
        ) : (
          <div className="fc-fade-up flex flex-col gap-4" style={{ animationDelay: '100ms' }}>
            <ActivityStrip t={t} days={weekDays} streak={streak} />
            <RewardsVault t={t} tasksDone={tasksDone} sessionsDone={sessionsDone} earlyBirdDone={earlyBirdDone} />
          </div>
        )}

        <footer className="mt-8 text-center fc-mono text-[10px] text-slate-500 tracking-wide">
          <Flame size={11} className="inline mr-1 -mt-0.5 text-amber-400" />
          {t.appName} · {t.footerLine}
          <div className="mt-3 flex items-center justify-center gap-4">
            <button onClick={() => setOfferOpen(true)} className="text-slate-500 hover:text-emerald-300 underline underline-offset-2 transition">
              {t.legalOfferLabel}
            </button>
            <button onClick={() => setPrivacyOpen(true)} className="text-slate-500 hover:text-emerald-300 underline underline-offset-2 transition">
              {t.legalPrivacyLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/*  WHAT'S REAL VS. WHAT'S STILL A STUB — read this before a demo            */
/*                                                                           */
/*  REAL now:                                                                */
/*   - Persistence: tasksDone, sessionsDone, earlyBirdDone, lang, and the    */
/*     full per-day activity history survive a page refresh via             */
/*     localStorage (STORAGE_KEY above).                                    */
/*   - The weekly activity strip and streak counter are computed from that  */
/*     real history, not a seeded placeholder.                              */
/*   - The focus timer truly counts down in real time and can be paused.    */
/*                                                                           */
/*  STILL A STUB:                                                            */
/*   - generateSteps() is a local template generator with phrasing          */
/*     variants, not a real model call. See the comment above               */
/*     STEP_VARIANTS for exactly how to wire in your own backend.           */
/*   - Persistence is per-browser (localStorage), not per-account — there's */
/*     no server, so it won't sync across devices without one.              */
/* ------------------------------------------------------------------------ */