// Vercel serverless function — runs on Vercel's server, never in the browser.
// The API key lives only here, read from environment variables, so it's
// never visible to anyone visiting the site.
//
// REQUIRED environment variables (set these in Vercel → Project → Settings
// → Environment Variables, and locally in a `.env` file that is gitignored):
//   YANDEX_API_KEY            — the secret key ("Ваш секретный ключ")
//   YANDEX_FOLDER_ID          — the folder ID from Yandex Cloud
//   SUPABASE_URL              — same Project URL as in supabaseClient.js
//   SUPABASE_SERVICE_ROLE_KEY — Settings → API → "service_role" key
//                               (DIFFERENT from the "anon" key — this one is
//                               secret, never put it in supabaseClient.js
//                               or anywhere that ships to the browser)
//
// This endpoint now REQUIRES a signed-in user and enforces TWO layers of
// protection so no single person, AND no genuine traffic spike (e.g. a viral
// video sending a huge one-day wave of new visitors), can run up an
// unbounded bill:
//   1. RATE_LIMIT_MAX      — per-user cap
//   2. GLOBAL_DAILY_LIMIT  — hard ceiling on ALL AI calls across ALL users,
//                            combined, per calendar day. Once hit, everyone
//                            falls back to the offline templates until the
//                            next day — the app keeps working, it just stops
//                            spending money on real AI calls for the day.

import { createClient } from '@supabase/supabase-js';

const RATE_LIMIT_MAX = 20; // max AI requests per user per rolling 24h window
const RATE_LIMIT_WINDOW_HOURS = 24;
const GLOBAL_DAILY_LIMIT = 500; // hard ceiling across ALL users combined, per day — tune this to match what you're comfortable spending

const CATEGORY_LABEL = {
  ru: { work: 'работа/блог', fitness: 'фитнес и здоровье', personal: 'личные дела', clients: 'работа с клиентом', projects: 'проект', finance: 'финансы' },
  en: { work: 'work/blog', fitness: 'fitness & health', personal: 'personal task', clients: 'client work', projects: 'project', finance: 'finance' },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.YANDEX_API_KEY;
  const folderId = process.env.YANDEX_FOLDER_ID;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey || !folderId) {
    console.error('Missing env vars — YANDEX_API_KEY present:', !!apiKey, '| YANDEX_FOLDER_ID present:', !!folderId);
    return res.status(500).json({ error: 'YANDEX_API_KEY / YANDEX_FOLDER_ID not configured on the server' });
  }
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing env vars — SUPABASE_URL present:', !!supabaseUrl, '| SUPABASE_SERVICE_ROLE_KEY present:', !!serviceRoleKey);
    return res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured on the server' });
  }

  // --- 1. Require a real, signed-in user ---------------------------------
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Not signed in' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  const userId = userData.user.id;

  // --- 2. Global cap: total AI calls across EVERYONE, today --------------
  // Protects against a genuine traffic spike (e.g. a viral post sending a
  // huge wave of new, distinct visitors) — per-user limits alone don't help
  // there, since each of those visitors is a brand-new user with a fresh
  // quota. This one hard-stops total spend regardless of how many unique
  // people show up.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: globalCount, error: globalCountError } = await supabaseAdmin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', todayStart.toISOString());

  if (globalCountError) {
    console.error('Global rate-limit check failed:', globalCountError.message);
  } else if ((globalCount || 0) >= GLOBAL_DAILY_LIMIT) {
    return res.status(429).json({ error: 'GLOBAL_LIMIT_EXCEEDED' });
  }

  // --- 3. Per-user limit: this person's requests in the last 24h ---------
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabaseAdmin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', windowStart);

  if (countError) {
    console.error('Rate-limit check failed:', countError.message);
    // Fail closed on the side of NOT blocking real usage over a transient
    // DB hiccup — but log it loudly so it doesn't go unnoticed.
  } else if ((count || 0) >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED', limit: RATE_LIMIT_MAX, windowHours: RATE_LIMIT_WINDOW_HOURS });
  }

  // --- 4. Log this request (spends one "slot" before we even call the AI,
  //        so a request that times out still counts — errs toward safety) --
  await supabaseAdmin.from('ai_usage').insert({ user_id: userId });

  const { lang = 'ru', categoryId = 'work', task = '', deadlineLabel = '' } = req.body || {};
  const trimmedTask = String(task).trim().slice(0, 300);
  if (!trimmedTask) {
    return res.status(400).json({ error: 'task is required' });
  }

  const categoryLabel = (CATEGORY_LABEL[lang] || CATEGORY_LABEL.ru)[categoryId] || categoryId;
  const deadlineNote = deadlineLabel
    ? lang === 'en'
      ? ` The person wants this done by: ${deadlineLabel}. Take that timeframe into account — steps should feel realistic and paced for that deadline, not generic.`
      : ` Человек хочет успеть к сроку: ${deadlineLabel}. Учти этот срок — шаги должны быть реалистичны именно для этого времени, а не абстрактными.`
    : '';

  const systemPrompt =
    lang === 'en'
      ? `You help people with ADHD and procrastination break a big goal into exactly 3 small, concrete, IMMEDIATELY doable steps. The goal belongs to the category "${categoryLabel}".${deadlineNote}

Hard rules:
- NEVER write meta-steps like "make a plan", "set goals", "figure out how" — those are not actions, they're procrastination in disguise.
- If the goal has a number in it (money, reps, pages, etc.), at least one step must use real arithmetic based on that number (e.g. split it into a daily/weekly amount).
- Every step must be something the person could literally start doing in the next 5 minutes.
- Step 1 is always the easiest possible first move — something so small there's no excuse not to do it right now.

Reply with ONLY a JSON array of exactly 3 short strings, no extra text, no markdown, no numbering — just ["step one", "step two", "step three"]. Each step under 15 words, warm but efficient tone.`
      : `Ты помогаешь людям с СДВГ и прокрастинацией разбивать большую цель на ровно 3 маленьких, конкретных, СРАЗУ выполнимых шага. Цель относится к категории "${categoryLabel}".${deadlineNote}

Жёсткие правила:
- НИКОГДА не пиши шаги-заглушки вроде «составить план», «определить цели», «понять как» — это не действия, а замаскированная прокрастинация.
- Если в цели есть число (деньги, повторения, страницы и т.п.) — хотя бы один шаг должен реально его использовать, посчитав конкретную сумму в день/неделю/месяц.
- Каждый шаг — то, что человек может буквально начать делать в ближайшие 5 минут.
- Шаг 1 — всегда самое простое возможное первое действие, настолько маленькое, что нет повода его не сделать прямо сейчас.

Ответь ТОЛЬКО JSON-массивом из ровно 3 коротких строк, без лишнего текста, без markdown, без нумерации — просто ["шаг один", "шаг два", "шаг три"]. Каждый шаг до 15 слов, тёплый, но деловой тон.`;

  const userPrompt = lang === 'en' ? `Goal: "${trimmedTask}"` : `Цель: «${trimmedTask}»`;

  try {
    const ygptRes = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Api-Key ${apiKey}`,
        'x-folder-id': folderId,
      },
      body: JSON.stringify({
        modelUri: `gpt://${folderId}/yandexgpt-lite/latest`,
        completionOptions: { stream: false, temperature: 0.6, maxTokens: '400' },
        messages: [
          { role: 'system', text: systemPrompt },
          { role: 'user', text: userPrompt },
        ],
      }),
    });

    if (!ygptRes.ok) {
      const errText = await ygptRes.text();
      console.error('YandexGPT error:', ygptRes.status, errText);
      return res.status(502).json({ error: 'YandexGPT request failed', detail: errText });
    }

    const data = await ygptRes.json();
    const rawText = data?.result?.alternatives?.[0]?.message?.text || '';

    // The model is asked for pure JSON, but strip stray markdown fences just in case.
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    let steps;
    try {
      steps = JSON.parse(cleaned);
    } catch {
      // Fallback: split by lines if the model didn't return clean JSON.
      steps = cleaned
        .split('\n')
        .map((s) => s.replace(/^[-*\d.\s]+/, '').trim())
        .filter(Boolean)
        .slice(0, 3);
    }

    if (!Array.isArray(steps) || steps.length === 0) {
      return res.status(502).json({ error: 'Could not parse steps from model response' });
    }

    const prefix = lang === 'en' ? 'Step' : 'Шаг';
    const formatted = steps.slice(0, 3).map((s, i) => `${prefix} ${i + 1}: ${s}`);

    return res.status(200).json({ steps: formatted });
  } catch (err) {
    console.error('generate-steps error:', err);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}