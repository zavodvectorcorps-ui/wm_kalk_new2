import React, { useState, useEffect } from 'react';
import {
  Calculator, Kanban, Truck, Phone, BarChart3, FileText, Moon,
  Zap, Shield, Clock, Bot, Workflow, Globe, Database, Sparkles,
  ArrowRight, ChevronDown, Check, Code2, Layers, Cpu
} from 'lucide-react';

const CONTENT = {
  en: {
    nav: { features: 'Features', modules: 'Modules', stack: 'Stack', numbers: 'Numbers' },
    hero: {
      badge: 'Case study · 2025 – 2026',
      title: 'WM kalkulator',
      subtitle: 'Sauna manufacturing platform',
      desc: 'A full-stack operations system for a European sauna manufacturer: product configurator, ERP/CRM, logistics with live map, AI-powered call analytics, lead SLA tracking and deep amoCRM sync.',
      cta1: 'Explore modules',
      cta2: 'Tech stack',
    },
    metrics: [
      { v: '40+', l: 'REST endpoints' },
      { v: '8', l: 'integrated services' },
      { v: '12k+', l: 'lines of production code' },
      { v: '9', l: 'role-based modules' },
    ],
    pitch: {
      title: 'One workspace for the whole manufacturer',
      desc: 'Sales configure and price products → deals land in amoCRM → production sees a Kanban board → logistics plans routes on a map → calls and leads are auto-scored by AI. Every step of the pipeline, inside one tool.',
    },
    features: [
      { icon: Calculator, title: 'Product configurator', desc: 'Step-by-step wizard for two product lines with live pricing, discounts, layout variants and auto-PDF commercial proposal.' },
      { icon: Kanban, title: 'CRM / ERP', desc: 'Kanban + calendar + list views. Stages: invoice → prepayment → approved → in production → ready → delivered.' },
      { icon: Truck, title: 'Logistics with live map', desc: 'Google Maps routing, drivers panel with navigation, trip planning, delivery photo attachments.' },
      { icon: Phone, title: 'AI call analytics', desc: 'Auto-pulls calls from amoCRM & Binotel, transcribes with Whisper, diarizes M/C and scores with GPT-5.2 by custom rules.' },
      { icon: BarChart3, title: 'Lead analytics (SLA)', desc: 'Tracks first-response time, untouched leads, per-manager ranking and AI-powered recommendations.' },
      { icon: Workflow, title: 'amoCRM deep sync', desc: 'Two-way webhook sync, auto PDF upload to deal, field mapping per pipeline, Widget inside amoCRM.' },
      { icon: FileText, title: 'Auto PDF proposals', desc: 'Pixel-perfect branded PDFs uploaded to Cloudinary and attached to the amoCRM deal automatically.' },
      { icon: Moon, title: 'Dark theme', desc: 'Fully themed UI with localStorage persistence and prefers-color-scheme detection.' },
    ],
    modulesTitle: 'Modules',
    modules: [
      { img: '01_hero_dashboard.jpeg', title: 'Role-based workspace selector', desc: 'After login each user sees only the modules their role grants — admin, manager, warehouse, driver, marketer.' },
      { img: '02_sauna_calculator.jpeg', title: 'Sauna configurator + auto PDF', desc: 'Customer data, model picker with illustrations and prices, dynamic options, live total and a one-click PDF offer uploaded to amoCRM.' },
      { img: '03_admin_orders.jpeg', title: 'Admin orders panel', desc: 'Unified orders view across all product lines — inline edit, PDF/Excel export, responsible manager, price and source badges.' },
      { img: '04_crm_kanban.jpeg', title: 'Production Kanban CRM', desc: 'Drag orders across manufacturing stages. Calendar and list views available. Auto-synced from amoCRM deals.' },
      { img: '05_logistics.jpeg', title: 'Logistics with live Google Map', desc: 'Every order appears as a pin on the map (free / in trip / warehouse). Drivers have their own mobile panel.' },
      { img: '06_call_analytics.jpeg', title: 'AI call analytics', desc: 'Pulls calls from amoCRM/Binotel, transcribes via OpenAI Whisper, runs GPT-4o-mini diarization with context-overlap chunking, then GPT-5.2 scores each conversation by your custom rules.' },
      { img: '07_lead_analytics.jpeg', title: 'Lead SLA analytics', desc: 'Real-time KPIs: fast-processed vs delayed leads, stuck deals, manager ranking, average reaction time, AI-generated department digest.' },
    ],
    stackTitle: 'Engineered with',
    stackGroups: [
      { icon: Code2, title: 'Frontend', items: ['React 18', 'Shadcn/UI', 'Tailwind CSS', 'Lucide icons', 'Axios'] },
      { icon: Cpu, title: 'Backend', items: ['FastAPI', 'Python 3.11', 'Motor (async MongoDB)', 'httpx', 'BackgroundTasks'] },
      { icon: Database, title: 'Storage', items: ['MongoDB', 'Cloudinary (PDF/audio/images)'] },
      { icon: Bot, title: 'AI & APIs', items: ['OpenAI Whisper', 'GPT-4o-mini', 'GPT-5.2', 'amoCRM', 'Binotel', 'Google Maps', 'Telegram'] },
    ],
    highlightsTitle: 'What makes it solid',
    highlights: [
      { icon: Zap, title: 'Context-aware AI chunking', desc: 'Long calls are split by Whisper timestamps and fed to GPT-4o-mini in 6k-char chunks with 2-line context overlap — speaker identity stays consistent across any length.' },
      { icon: Shield, title: 'Anti-hang background jobs', desc: 'Every sync writes a `lastHeartbeat`; if 5 minutes silent, the system auto-unblocks. No frozen syncs in production.' },
      { icon: Clock, title: 'Cost-aware caching', desc: 'GPT evaluations cached by `transcript_hash` in MongoDB — identical transcripts never pay twice.' },
      { icon: Sparkles, title: 'Production-grade diagnostics', desc: 'Every integration has a health endpoint with granular status (401/403/timeout/domain) and actionable user-facing hints.' },
    ],
    footer: 'Built for a real European manufacturer · Private case study',
  },
  ru: {
    nav: { features: 'Возможности', modules: 'Модули', stack: 'Стек', numbers: 'Цифры' },
    hero: {
      badge: 'Кейс · 2025 – 2026',
      title: 'WM kalkulator',
      subtitle: 'Платформа производителя саун',
      desc: 'Полнофункциональная операционная система для европейского производителя саун: конфигуратор продукта, CRM/ERP, логистика с живой картой, AI-аналитика звонков, SLA-контроль лидов и глубокая синхронизация с amoCRM.',
      cta1: 'Смотреть модули',
      cta2: 'Технологии',
    },
    metrics: [
      { v: '40+', l: 'REST-эндпоинтов' },
      { v: '8', l: 'интеграций' },
      { v: '12к+', l: 'строк боевого кода' },
      { v: '9', l: 'ролевых модулей' },
    ],
    pitch: {
      title: 'Одна система для всего производства',
      desc: 'Отдел продаж считает КП → сделка попадает в amoCRM → производство видит Kanban → логистика планирует маршруты на карте → звонки и лиды автоматически оцениваются AI. Каждый шаг воронки внутри одного инструмента.',
    },
    features: [
      { icon: Calculator, title: 'Конфигуратор продукта', desc: 'Пошаговый визард для двух товарных линеек с живым пересчётом цены, скидками, вариантами планировки и авто-PDF коммерческим.' },
      { icon: Kanban, title: 'CRM / ERP', desc: 'Канбан + календарь + список. Этапы: счёт → предоплата → согласование → производство → готов → доставлен.' },
      { icon: Truck, title: 'Логистика с картой', desc: 'Маршруты через Google Maps, панель водителя с навигацией, планирование рейсов, фото доставки.' },
      { icon: Phone, title: 'AI-аналитика звонков', desc: 'Тянет звонки из amoCRM и Binotel, транскрибирует Whisper, диаризует М/К и оценивает GPT-5.2 по вашим правилам.' },
      { icon: BarChart3, title: 'Аналитика лидов (SLA)', desc: 'Время первой реакции, зависшие лиды, рейтинг менеджеров, AI-рекомендации по улучшению обработки.' },
      { icon: Workflow, title: 'Глубокая amoCRM-синхронизация', desc: 'Двусторонние вебхуки, авто-загрузка PDF в сделку, маппинг полей по воронкам, встроенный виджет внутри amoCRM.' },
      { icon: FileText, title: 'Авто-PDF КП', desc: 'Фирменные PDF генерируются, загружаются в Cloudinary и цепляются к сделке amoCRM автоматически.' },
      { icon: Moon, title: 'Тёмная тема', desc: 'Полноценная тёмная тема с сохранением в localStorage и автоопределением prefers-color-scheme.' },
    ],
    modulesTitle: 'Модули',
    modules: [
      { img: '01_hero_dashboard.jpeg', title: 'Ролевой выбор рабочего места', desc: 'После входа каждый сотрудник видит только те модули, которые доступны его роли — админ, менеджер, склад, водитель, маркетолог.' },
      { img: '02_sauna_calculator.jpeg', title: 'Конфигуратор саун + авто-PDF', desc: 'Данные клиента, подбор модели с иллюстрациями и ценами, динамические опции, живой итог и одна кнопка — PDF-оферта сразу в amoCRM.' },
      { img: '03_admin_orders.jpeg', title: 'Админ-панель заказов', desc: 'Единая таблица заказов по всем линейкам: инлайн-редактирование, выгрузка PDF/Excel, ответственный менеджер, бейджи цены и источника.' },
      { img: '04_crm_kanban.jpeg', title: 'Kanban производства', desc: 'Перетаскивание заказов по этапам производства. Есть виды календарь/список. Авто-синхронизация со сделками amoCRM.' },
      { img: '05_logistics.jpeg', title: 'Логистика на живой карте', desc: 'Каждый заказ — пин на карте (свободен / в рейсе / на складе). У водителей свой мобильный панель.' },
      { img: '06_call_analytics.jpeg', title: 'AI-аналитика звонков', desc: 'Импорт из amoCRM/Binotel, транскрибация OpenAI Whisper, диаризация GPT-4o-mini с перекрытием контекста, оценка GPT-5.2 по вашим правилам.' },
      { img: '07_lead_analytics.jpeg', title: 'SLA-аналитика лидов', desc: 'KPI в реальном времени: быстро/с задержкой, зависшие сделки, рейтинг менеджеров, среднее время реакции, AI-дайджест по отделу.' },
    ],
    stackTitle: 'Технологии',
    stackGroups: [
      { icon: Code2, title: 'Фронтенд', items: ['React 18', 'Shadcn/UI', 'Tailwind CSS', 'Lucide icons', 'Axios'] },
      { icon: Cpu, title: 'Бэкенд', items: ['FastAPI', 'Python 3.11', 'Motor (async MongoDB)', 'httpx', 'BackgroundTasks'] },
      { icon: Database, title: 'Хранилища', items: ['MongoDB', 'Cloudinary (PDF/audio/images)'] },
      { icon: Bot, title: 'AI и API', items: ['OpenAI Whisper', 'GPT-4o-mini', 'GPT-5.2', 'amoCRM', 'Binotel', 'Google Maps', 'Telegram'] },
    ],
    highlightsTitle: 'Инженерные решения',
    highlights: [
      { icon: Zap, title: 'Context-aware AI-чанкинг', desc: 'Длинные звонки режутся по таймкодам Whisper и подаются в GPT-4o-mini чанками по 6к символов с перекрытием 2 реплик — кто менеджер, а кто клиент, остаётся однозначно на любом разговоре.' },
      { icon: Shield, title: 'Anti-hang фоновые задачи', desc: 'Каждая синхронизация пишет `lastHeartbeat`; если 5 минут тихо — система сама разблокирует. В проде нет зависших синхронизаций.' },
      { icon: Clock, title: 'Кэш по стоимости', desc: 'Оценки GPT кэшируются по `transcript_hash` в MongoDB — одинаковые транскрипты не оплачиваются дважды.' },
      { icon: Sparkles, title: 'Production-grade диагностика', desc: 'У каждой интеграции health-эндпоинт с понятным статусом (401/403/timeout/домен) и подсказкой, что именно починить.' },
    ],
    footer: 'Сделано для реального европейского производителя · Приватный кейс',
  },
};

export default function PortfolioPage() {
  const [lang, setLang] = useState(() => localStorage.getItem('portfolio-lang') || 'en');
  const t = CONTENT[lang];
  const imgBase = (process.env.PUBLIC_URL || '') + '/portfolio-screenshots/';

  useEffect(() => {
    localStorage.setItem('portfolio-lang', lang);
    document.title = 'WM kalkulator · Portfolio case study';
  }, [lang]);

  return (
    <div className="min-h-screen text-slate-100 relative overflow-x-hidden" style={{ background: '#070a13' }} data-testid="portfolio-root">
      {/* Animated gradient backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[55vw] h-[55vw] rounded-full blur-[120px] opacity-[0.35]" style={{ background: 'radial-gradient(circle, #4f46e5 0%, transparent 60%)' }} />
        <div className="absolute top-[30%] right-[-15%] w-[60vw] h-[60vw] rounded-full blur-[120px] opacity-[0.28]" style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 60%)' }} />
        <div className="absolute bottom-[-20%] left-[20%] w-[50vw] h-[50vw] rounded-full blur-[120px] opacity-[0.22]" style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 60%)' }} />
        {/* Grain */}
        <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' /></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/></svg>\")" }} />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-40 backdrop-blur-xl border-b border-white/5" style={{ background: 'rgba(7,10,19,0.6)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-[15px] font-bold text-white shadow-lg shadow-indigo-500/30">W</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">WM kalkulator</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Portfolio case</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-[13px] text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">{t.nav.features}</a>
            <a href="#modules" className="hover:text-white transition-colors">{t.nav.modules}</a>
            <a href="#stack" className="hover:text-white transition-colors">{t.nav.stack}</a>
            <a href="#numbers" className="hover:text-white transition-colors">{t.nav.numbers}</a>
          </nav>
          <div className="flex items-center gap-1 rounded-full border border-white/10 p-0.5 bg-white/5" data-testid="portfolio-lang-switch">
            {['en','ru'].map(L => (
              <button key={L} onClick={() => setLang(L)} data-testid={`lang-${L}`}
                className={`px-3 py-1 rounded-full text-[11px] font-medium uppercase tracking-wide transition-all ${lang === L ? 'bg-white text-slate-900 shadow' : 'text-slate-300 hover:text-white'}`}>
                {L}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] uppercase tracking-[0.2em] text-slate-300 mb-8" data-testid="portfolio-hero-badge">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {t.hero.badge}
          </span>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-slate-400">{t.hero.title}</span>
            <br />
            <span className="text-slate-400 text-3xl sm:text-4xl lg:text-5xl font-medium">{t.hero.subtitle}</span>
          </h1>
          <p className="text-lg text-slate-300 leading-relaxed mb-10 max-w-2xl">{t.hero.desc}</p>
          <div className="flex flex-wrap gap-3">
            <a href="#modules" className="group inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-slate-900 text-sm font-semibold hover:bg-slate-200 transition-colors" data-testid="hero-cta-modules">
              {t.hero.cta1} <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
            <a href="#stack" className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/15 text-sm font-semibold hover:bg-white/5 transition-colors" data-testid="hero-cta-stack">
              {t.hero.cta2}
            </a>
          </div>
        </div>

        {/* Hero screenshot */}
        <div className="mt-20 relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-indigo-900/40">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#070a13] pointer-events-none z-10" />
          <img src={imgBase + '01_hero_dashboard.jpeg'} alt="Dashboard" className="w-full block" loading="eager" data-testid="portfolio-hero-img" />
        </div>

        {/* Metrics */}
        <div id="numbers" className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
          {t.metrics.map((m, i) => (
            <div key={i} className="p-8 bg-[#070a13]" data-testid={`metric-${i}`}>
              <div className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400">{m.v}</div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mt-2">{m.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pitch */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/5">
        <div className="flex flex-col md:flex-row gap-12">
          <div className="md:w-1/3">
            <Layers className="h-8 w-8 text-indigo-400 mb-4" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">{t.pitch.title}</h2>
          </div>
          <div className="md:w-2/3 pt-2">
            <p className="text-lg text-slate-300 leading-relaxed">{t.pitch.desc}</p>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20 border-t border-white/5">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-12">{t.nav.features}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {t.features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="group relative p-6 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.06] hover:border-white/20 transition-all" data-testid={`feature-${i}`}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 bg-gradient-to-br from-indigo-500/20 to-cyan-400/20 border border-white/10 group-hover:from-indigo-500/30 group-hover:to-cyan-400/30 transition-colors">
                  <Icon className="h-5 w-5 text-cyan-300" />
                </div>
                <h3 className="text-base font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Modules with screenshots */}
      <section id="modules" className="max-w-6xl mx-auto px-6 py-20 border-t border-white/5">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-12">{t.modulesTitle}</h2>
        <div className="space-y-24">
          {t.modules.map((m, i) => (
            <div key={i} className={`flex flex-col ${i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-10 items-center`} data-testid={`module-${i}`}>
              <div className="lg:w-1/2">
                <div className="rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40 group hover:border-white/20 transition-colors">
                  <img src={imgBase + m.img} alt={m.title} className="w-full block group-hover:scale-[1.02] transition-transform duration-700" loading="lazy" />
                </div>
              </div>
              <div className="lg:w-1/2">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-3">{String(i + 1).padStart(2, '0')} / {String(t.modules.length).padStart(2, '0')}</div>
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">{m.title}</h3>
                <p className="text-slate-300 leading-relaxed text-base">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Engineering highlights */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/5">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-12">{t.highlightsTitle}</h2>
        <div className="grid md:grid-cols-2 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/10">
          {t.highlights.map((h, i) => {
            const Icon = h.icon;
            return (
              <div key={i} className="p-8 bg-[#070a13]" data-testid={`highlight-${i}`}>
                <Icon className="h-6 w-6 text-amber-300 mb-4" />
                <h3 className="text-lg font-semibold mb-3">{h.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{h.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Stack */}
      <section id="stack" className="max-w-6xl mx-auto px-6 py-20 border-t border-white/5">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-12">{t.stackTitle}</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {t.stackGroups.map((g, i) => {
            const Icon = g.icon;
            return (
              <div key={i} className="p-6 rounded-2xl border border-white/10 bg-white/[0.03]" data-testid={`stack-${i}`}>
                <Icon className="h-6 w-6 text-indigo-300 mb-4" />
                <div className="text-sm font-semibold mb-4 uppercase tracking-wider text-slate-300">{g.title}</div>
                <ul className="space-y-2">
                  {g.items.map((it, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-slate-400">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-12 border-t border-white/5 text-center">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-500">
          <Globe className="h-3.5 w-3.5" />
          {t.footer}
        </div>
      </footer>
    </div>
  );
}
