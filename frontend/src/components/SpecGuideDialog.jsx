import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Sparkles, FolderTree, ListChecks, ToggleLeft, Link2, ArrowRight, Layers, Type } from 'lucide-react';

const SPEC_IMG = 'https://res.cloudinary.com/dhyj13jgs/image/upload/v1787848305/wm-calculator/wm-calculator/a695da56799c4d8c993ea2123ab5cb11.jpg';

const Figure = ({ src, caption }) => (
  <figure className="my-3">
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
      <img src={src} alt={caption} className="w-full object-contain max-h-[420px]" loading="lazy" />
    </div>
    {caption && <figcaption className="text-xs text-muted-foreground mt-1.5 text-center italic">{caption}</figcaption>}
  </figure>
);

const Step = ({ n, icon: Icon, title, children, accent = 'amber' }) => {
  const grad = { amber: 'from-amber-500 to-orange-500', indigo: 'from-indigo-500 to-blue-600', emerald: 'from-emerald-500 to-teal-500', violet: 'from-violet-500 to-purple-500' }[accent];
  const bg = { amber: 'border-amber-200 bg-amber-50/60', indigo: 'border-indigo-200 bg-indigo-50/60', emerald: 'border-emerald-200 bg-emerald-50/60', violet: 'border-violet-200 bg-violet-50/60' }[accent];
  return (
    <div className={`relative rounded-2xl border ${bg} p-5 pl-16`}>
      <div className={`absolute left-4 top-5 w-9 h-9 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white shadow-md`}><Icon className="w-5 h-5" /></div>
      {n != null && <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Шаг {n}</span>}
      <h3 className="font-semibold text-base leading-tight mb-2 mt-0.5">{title}</h3>
      <div className="text-sm text-muted-foreground space-y-1.5 leading-relaxed">{children}</div>
    </div>
  );
};

export const SpecGuideDialog = ({ open, onOpenChange }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0" data-testid="spec-guide-dialog">
      <div className="sticky top-0 z-10 bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 text-white px-8 py-6 rounded-t-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-white">
            <Sparkles className="w-6 h-6" /> Настройка тех.задания (Спецификация)
          </DialogTitle>
          <DialogDescription className="text-white/85 text-sm">
            Как собрать шаблон тех.задания, задать поля и связать их с опциями калькулятора
          </DialogDescription>
        </DialogHeader>
      </div>

      <div className="px-8 py-6 space-y-8">
        <Figure src={SPEC_IMG} caption="Вкладка «Спецификация» → «Управление тех.заданием»: подвкладки Главные категории / Подкатегории / Опции" />

        {/* Hierarchy */}
        <section>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><span className="w-1.5 h-6 bg-amber-500 rounded-full" /> Структура (иерархия)</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
            <span className="px-3 py-1.5 rounded-full bg-amber-100 border border-amber-200 font-medium flex items-center gap-1"><FolderTree className="w-4 h-4" />Главные категории (разделы)</span>
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <span className="px-3 py-1.5 rounded-full bg-indigo-100 border border-indigo-200 font-medium flex items-center gap-1"><ListChecks className="w-4 h-4" />Подкатегории (поля)</span>
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <span className="px-3 py-1.5 rounded-full bg-emerald-100 border border-emerald-200 font-medium flex items-center gap-1"><ToggleLeft className="w-4 h-4" />Опции (варианты ответа)</span>
          </div>
          <p className="text-sm text-muted-foreground">Главные категории = разделы в PDF. Подкатегории = сами поля. Опции = варианты для полей типа «выбор».</p>
        </section>

        {/* Field types */}
        <section>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><span className="w-1.5 h-6 bg-indigo-500 rounded-full" /> Типы полей (inputType)</h2>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
            <li><b>radio</b> — выбор одного варианта из списка опций.</li>
            <li><b>checkbox</b> — выбор нескольких вариантов.</li>
            <li><b>text</b> — короткое текстовое поле (размер, число и т.п.).</li>
            <li><b>textarea</b> — многострочный текст (примечания).</li>
            <li><b>mixed</b> — набор полей внутри одной подкатегории.</li>
            <li className="flex items-center gap-1"><Type className="w-3.5 h-3.5" /> Можно включить <b>Изображения</b> — варианты показываются картинками.</li>
          </ul>
        </section>

        {/* Workflow */}
        <section>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><span className="w-1.5 h-6 bg-emerald-500 rounded-full" /> Как настроить — по шагам</h2>
          <div className="grid gap-3">
            <Step n={1} icon={FolderTree} title="Создать разделы (Главные категории)" accent="amber">
              Подвкладка «Главные категории» → «Добавить главную категорию». Например: «Цвета и отделка», «Конструкция и мебель», «Оборудование».
            </Step>
            <Step n={2} icon={ListChecks} title="Добавить поля (Подкатегории)" accent="indigo">
              Подвкладка «Подкатегории» → выбрать раздел, задать <b>название</b>, <b>тип поля</b> (radio/checkbox/text/textarea/mixed), при желании включить изображения и ширину.
            </Step>
            <Step n={3} icon={ToggleLeft} title="Добавить опции (варианты ответа)" accent="emerald">
              Подвкладка «Опции» → для полей radio/checkbox добавить варианты (напр. «Палисандр», «Антрацит»), можно с картинками.
            </Step>
            <Step n={4} icon={Link2} title="Связать с калькулятором" accent="violet">
              Чтобы поля заполнялись автоматически — свяжите опции калькулятора с полями тех.задания (см. блок ниже). Не забудьте «Сохранить всё».
            </Step>
          </div>
        </section>

        {/* Mapping — two levels */}
        <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-3"><Link2 className="w-5 h-5 text-violet-600" />Связь опций калькулятора с тех.заданием — два уровня</h3>
          <div className="space-y-3 text-sm">
            <div className="bg-white/70 rounded-xl border p-3">
              <p className="font-medium flex items-center gap-2"><ToggleLeft className="w-4 h-4 text-violet-600" />По отдельной опции</p>
              <p className="text-muted-foreground">В редакторе опции калькулятора (Прайс → Опции) есть блок <b>«Маппинг на Тех.Задание»</b>: выбираете категорию и опцию тех.задания для конкретной опции.</p>
            </div>
            <div className="bg-white/70 rounded-xl border p-3">
              <p className="font-medium flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-600" />По целой категории <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Новое</span></p>
              <p className="text-muted-foreground">В редакторе <b>категории</b> калькулятора (Прайс → Категории → ✎) появился выпадающий список <b>«Маппинг категории на Тех.Задание»</b>. Все опции этой категории будут попадать в выбранное поле — <b>если у самой опции не задан свой маппинг</b> (индивидуальный имеет приоритет).</p>
            </div>
          </div>
          <p className="text-xs text-violet-800 bg-violet-100/60 rounded-lg p-2.5 mt-3">
            Приоритет заполнения: <b>маппинг опции</b> → <b>маппинг её категории</b> → совпадение по названию.
          </p>
        </section>

        {/* Result */}
        <section>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><span className="w-1.5 h-6 bg-rose-500 rounded-full" /> Как это используется</h2>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
            <li>В карточке заказа → «Калькулятор / Тех. задание» поля заполняются автоматически из выбора клиента.</li>
            <li>Кнопка «Создать PDF» сохраняет тех.задание в документы и отправляет в тему производства в Telegram.</li>
            <li>Планировка подставляется автоматически.</li>
          </ul>
        </section>

        <p className="text-xs text-muted-foreground border-t pt-4">После изменений структуры обязательно нажимайте «Сохранить всё».</p>
      </div>
    </DialogContent>
  </Dialog>
);

export default SpecGuideDialog;
