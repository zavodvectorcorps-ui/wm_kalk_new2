import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import {
  Sparkles, Layers, Square, Ruler, Type, MousePointer, Upload, Save, Eye,
  Copy, Package, Settings2, ArrowRight, Grid3X3, Link2
} from 'lucide-react';

const CONF_IMG = 'https://res.cloudinary.com/dhyj13jgs/image/upload/v1787610787/wm-calculator/wm-calculator/d7fa58eee90d4a73ab030fe6c2777b08.jpg';

const Figure = ({ src, caption }) => (
  <figure className="my-3">
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
      <img src={src} alt={caption} className="w-full object-contain max-h-[420px]" loading="lazy" />
    </div>
    {caption && <figcaption className="text-xs text-muted-foreground mt-1.5 text-center italic">{caption}</figcaption>}
  </figure>
);

const Step = ({ n, icon: Icon, title, children, accent = 'indigo' }) => {
  const grad = {
    indigo: 'from-indigo-500 to-blue-600', emerald: 'from-emerald-500 to-teal-500',
    amber: 'from-amber-500 to-orange-500', violet: 'from-violet-500 to-purple-500',
    rose: 'from-rose-500 to-rose-600',
  }[accent];
  const bg = {
    indigo: 'border-indigo-200 bg-indigo-50/60', emerald: 'border-emerald-200 bg-emerald-50/60',
    amber: 'border-amber-200 bg-amber-50/60', violet: 'border-violet-200 bg-violet-50/60',
    rose: 'border-rose-200 bg-rose-50/60',
  }[accent];
  return (
    <div className={`relative rounded-2xl border ${bg} p-5 pl-16`}>
      <div className={`absolute left-4 top-5 w-9 h-9 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white shadow-md`}>
        <Icon className="w-5 h-5" />
      </div>
      {n != null && <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Шаг {n}</span>}
      <h3 className="font-semibold text-base leading-tight mb-2 mt-0.5">{title}</h3>
      <div className="text-sm text-muted-foreground space-y-1.5 leading-relaxed">{children}</div>
    </div>
  );
};

export const LayoutGuideDialog = ({ open, onOpenChange }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0" data-testid="layout-guide-dialog">
      <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 text-white px-8 py-6 rounded-t-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-white">
            <Sparkles className="w-6 h-6" /> Конфигуратор планировок — инструкция
          </DialogTitle>
          <DialogDescription className="text-white/85 text-sm">
            Как рисовать планировки саун и связывать их с моделями, вариантами и калькулятором
          </DialogDescription>
        </DialogHeader>
      </div>

      <div className="px-8 py-6 space-y-8">
        <Figure src={CONF_IMG} caption="Общий вид: слева «Настройки» и «Элементы», по центру холст с сеткой и инструментами, справа «Свойства»" />

        {/* Concepts */}
        <section>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><span className="w-1.5 h-6 bg-indigo-500 rounded-full" /> Ключевые понятия</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border p-3 bg-white/70"><p className="font-semibold flex items-center gap-2"><Package className="w-4 h-4 text-indigo-600" />Элементы (Библиотека)</p><p className="text-muted-foreground">Картинки PNG/SVG: печь, лавка, дверь, окно… с реальными размерами в см. «Кубики» для расстановки.</p></div>
            <div className="rounded-xl border p-3 bg-white/70"><p className="font-semibold flex items-center gap-2"><Square className="w-4 h-4 text-amber-600" />Контур (Outline)</p><p className="text-muted-foreground">Внешний контур модели/варианта с реальными размерами. Подложка-основа и масштаб см↔пиксели.</p></div>
            <div className="rounded-xl border p-3 bg-white/70"><p className="font-semibold flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-600" />Планировка (Layout)</p><p className="text-muted-foreground">Готовый чертёж, привязан к <b>Модель + Вариант</b>. Именно он показывается клиенту.</p></div>
            <div className="rounded-xl border p-3 bg-white/70"><p className="font-semibold flex items-center gap-2"><Link2 className="w-4 h-4 text-violet-600" />Опции + Варианты</p><p className="text-muted-foreground">Правила, которые двигают элементы по выбору в калькуляторе (сторона двери/печи) — без 10 отдельных планировок.</p></div>
          </div>
          <div className="mt-3 text-xs text-indigo-800 bg-indigo-100/60 rounded-lg p-2.5">
            Главная связь: <b>Планировка ↔ Модель + Вариант</b>. Клиент выбирает модель/вариант — подтягивается опубликованная планировка.
          </div>
        </section>

        {/* Sections */}
        <section>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><span className="w-1.5 h-6 bg-blue-500 rounded-full" /> Разделы интерфейса</h2>
          <ul className="text-sm space-y-2">
            <li className="flex gap-2"><Settings2 className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" /><span><b>Настройки</b> (слева): модель/вариант, «Загрузить контур», сетка, показ размеров, масштаб, очистить, экспорт PNG, сохранить.</span></li>
            <li className="flex gap-2"><MousePointer className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" /><span><b>Инструменты</b> (сверху): Выбор (V), Прямоугольник (R), Стена/Линия (L), Линейка (M), Текст (T), Комната, Перегородка, цвет/толщина/заливка, Отмена (Ctrl+Z).</span></li>
            <li className="flex gap-2"><Package className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" /><span><b>Элементы</b> (справа): вкладки «Библиотека» (кубики), «Планировки» (список: дублировать / опубликовать-скрыть / удалить) и «Варианты».</span></li>
            <li className="flex gap-2"><Grid3X3 className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" /><span><b>Свойства</b>: точные координаты, размеры в см, поворот и отражение выделенного элемента.</span></li>
          </ul>
        </section>

        {/* Workflow */}
        <section>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><span className="w-1.5 h-6 bg-emerald-500 rounded-full" /> Порядок работы</h2>
          <div className="grid gap-3">
            <Step n={0} icon={Upload} title="Собрать библиотеку элементов (один раз)" accent="indigo">
              «Элементы» → «Добавить». Загрузите PNG/SVG (прозрачный фон) для печи, лавки, двери, окна и т.д., укажите тип и <b>реальные размеры в см</b>. Для лавок — «фиксированная высота».
            </Step>
            <Step n={1} icon={Square} title="Загрузить контур модели/варианта" accent="amber">
              Выберите модель (и вариант) → «Загрузить контур» → файл + реальные внешние/внутренние размеры и толщина стен. Масштаб рассчитается автоматически.
            </Step>
            <Step n={2} icon={MousePointer} title="Нарисовать планировку" accent="blue">
              Убедитесь, что выбраны <b>Модель + Вариант</b>. Расставьте элементы из библиотеки, дорисуйте стены/комнаты, добавьте подписи и замеры. Включите «Размеры» и «Сетку» для точности.
            </Step>
            <Step n={3} icon={Save} title="Сохранить → Экспорт PNG → Опубликовать" accent="emerald">
              «Сохранить» (привязка к модели+варианту) → «Экспорт PNG» (эта картинка идёт клиенту) → на вкладке «Планировки» нажмите <b>глаз</b>, чтобы опубликовать. Только опубликованная планировка видна в калькуляторе.
            </Step>
            <Step n={4} icon={Copy} title="Клонировать на другие размеры" accent="violet">
              Планировку можно клонировать на другую модель с масштабированием (2м → 3м) — позиции и размеры пересчитаются пропорционально. Рисуем один раз, клонируем и правим детали.
            </Step>
          </div>
        </section>

        {/* Advanced */}
        <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-2"><Link2 className="w-5 h-5 text-violet-600" />Авто-подстройка под выбор клиента (Опции + Варианты)</h3>
          <p className="text-sm text-muted-foreground mb-2">Чтобы не рисовать отдельную планировку под каждую комбинацию:</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
            <li><b>Опция</b> — например «Сторона печи».</li>
            <li><b>Вариант</b> — «Печь слева» / «справа»: задаёт новые позиции/видимость элементов (elementConfigs).</li>
            <li><b>Условия (conditions)</b> — показывать вариант только при определённой комбинации других опций.</li>
            <li><b>Связь с калькулятором (calculatorMapping)</b> — при выборе опции в калькуляторе вариант применяется <b>автоматически</b>: элементы на плане перемещаются сами.</li>
          </ul>
        </section>

        {/* Link to calc */}
        <section>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><span className="w-1.5 h-6 bg-rose-500 rounded-full" /> Связь с калькулятором и тех.заданием</h2>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
            <li>Планировка ↔ Модель + Вариант: подтягивается по выбору клиента.</li>
            <li>Опция планировки ↔ опция калькулятора (calculatorMapping): выбор меняет расстановку на плане.</li>
            <li>Планировка автоматически попадает в <b>тех.задание</b> и <b>производственное КП</b>.</li>
          </ul>
        </section>

        {/* Checklist */}
        <section>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><span className="w-1.5 h-6 bg-indigo-500 rounded-full" /> Чек-лист задачи</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {['Библиотека элементов', 'Контуры моделей/вариантов', 'Нарисовать планировки', 'Сохранить + Экспорт PNG + Публикация', 'Клонировать на др. размеры', 'Опции+Варианты (calculatorMapping)', 'Проверить в калькуляторе'].map((s, i, arr) => (
              <React.Fragment key={i}>
                <span className="px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 font-medium">{i + 1}. {s}</span>
                {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-slate-400" />}
              </React.Fragment>
            ))}
          </div>
        </section>

        <p className="text-xs text-muted-foreground border-t pt-4">Все размеры — в сантиметрах. Изображения хранятся в облаке. Горячие клавиши: V/R/L/M/T, Ctrl+Z, Del, Esc.</p>
      </div>
    </DialogContent>
  </Dialog>
);

export default LayoutGuideDialog;
