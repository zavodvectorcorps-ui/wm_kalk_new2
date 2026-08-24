import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import {
  FileText, FileSignature, ClipboardList, Send, MessageCircle, Camera,
  CheckCircle2, CalendarDays, ThumbsUp, Package, RefreshCw, ArrowRight,
  Sparkles, Building2, User, PhoneCall
} from 'lucide-react';

const StepCard = ({ n, icon: Icon, title, children, accent = 'rose' }) => {
  const accents = {
    rose: 'from-rose-500 to-rose-600 border-rose-200 bg-rose-50/60',
    amber: 'from-amber-500 to-orange-500 border-amber-200 bg-amber-50/60',
    blue: 'from-blue-500 to-indigo-500 border-blue-200 bg-blue-50/60',
    emerald: 'from-emerald-500 to-teal-500 border-emerald-200 bg-emerald-50/60',
    violet: 'from-violet-500 to-purple-500 border-violet-200 bg-violet-50/60',
  };
  return (
    <div className={`relative rounded-2xl border ${accents[accent].split(' ').slice(1).join(' ')} p-5 pl-16`}>
      <div className={`absolute left-4 top-5 w-9 h-9 rounded-xl bg-gradient-to-br ${accents[accent].split(' ')[0]} ${accents[accent].split(' ')[1]} flex items-center justify-center text-white shadow-md`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Шаг {n}</span>
      </div>
      <h3 className="font-semibold text-base leading-tight mb-2">{title}</h3>
      <div className="text-sm text-muted-foreground space-y-1.5 leading-relaxed">{children}</div>
    </div>
  );
};

const Btn = ({ children, color = 'slate' }) => {
  const map = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    rose: 'bg-rose-100 text-rose-700 border-rose-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${map[color]} whitespace-nowrap`}>
      {children}
    </span>
  );
};

export const ManagerGuideDialog = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0" data-testid="manager-guide-dialog">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-rose-600 via-rose-500 to-orange-500 text-white px-8 py-6 rounded-t-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-white">
              <Sparkles className="w-6 h-6" /> Инструкция менеджера
            </DialogTitle>
            <DialogDescription className="text-white/85 text-sm">
              Полный путь заказа: от сделки в amoCRM до передачи в производство и связи через Telegram
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-8 py-6 space-y-8">
          {/* PART 1 — Workflow */}
          <section>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-rose-500 rounded-full" /> Этапы работы
            </h2>
            <div className="grid gap-4">
              <StepCard n={1} icon={Building2} title="Заказ приходит из amoCRM" accent="blue">
                <p>Сделка из amoCRM автоматически появляется на доске (канбан) как карточка заказа с данными клиента, телефоном, моделью и ссылкой на сделку.</p>
                <p>Откройте карточку кликом. Любое изменение уходит обратно в amoCRM примечанием.</p>
              </StepCard>

              <StepCard n={2} icon={ClipboardList} title="Калькулятор и комплектация" accent="rose">
                <p>Нажмите <Btn color="rose">Калькулятор / Тех. задание</Btn>, выберите модель и опции (цвет, лавки, печь, окна, освещение), сохраните.</p>
                <p>💡 При смене модели её название теперь автоматически обновляется в карточке и во всех документах.</p>
              </StepCard>

              <StepCard n={3} icon={FileText} title="КП для клиента" accent="blue">
                <p>Сформируйте <b>КП</b> — PDF с ценами, промо, размерами и галереей. Сохраняется в раздел <Btn color="blue">Документы → КП</Btn>, готово к отправке клиенту.</p>
              </StepCard>

              <StepCard n={4} icon={ArrowRight} title="Перенос на нужный этап" accent="violet">
                <p>Перетащите карточку в нужную колонку канбана (Согласование / Оплата / В производстве и т.д.).</p>
              </StepCard>

              <StepCard n={5} icon={ClipboardList} title="Тех. задание (спецификация)" accent="amber">
                <p>Откройте <Btn color="rose">Калькулятор / Тех. задание</Btn> → раздел <b>Тех. задание</b>. Поля заполняются автоматически по настроенному соответствию опций и по названиям; планировка подтягивается сама.</p>
                <p>Проверьте, дополните, добавьте комментарий и нажмите <Btn color="blue">Создать PDF</Btn>. Тех.задание сохранится в документы, а если тема в Telegram уже есть — сразу уйдёт в производство.</p>
              </StepCard>

              <StepCard n={6} icon={FileSignature} title="Договор" accent="violet">
                <p>Сформируйте договор по <Btn color="violet">Шаблон договора</Btn>. Сохраняется в <Btn color="blue">Документы → Договор</Btn>. В производство договор не отправляется.</p>
              </StepCard>

              <StepCard n={7} icon={Send} title="Отправить в производство" accent="emerald">
                <p>Нажмите <Btn color="emerald">Отправить в производство</Btn> — далее всё автоматически (см. блок ниже).</p>
              </StepCard>
            </div>
          </section>

          {/* PART 2 — Production logic */}
          <section>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-emerald-500 rounded-full" /> Логика связи с производством
            </h2>

            {/* What happens on send */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 mb-5">
              <div className="flex items-center gap-2 mb-3">
                <Send className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold">Что происходит при нажатии «Отправить в производство»</h3>
              </div>
              <ol className="space-y-2.5 text-sm">
                <li className="flex gap-3"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center">1</span>
                  <span>В рабочем Telegram-чате производства создаётся <b>отдельная тема (топик)</b> под этот заказ.</span></li>
                <li className="flex gap-3"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center">2</span>
                  <span>Отправляется сообщение <b>«ЗАКАЗ В ПРОИЗВОДСТВО»</b> на русском: номер, клиент, модель, спецификация опций и комментарий.</span></li>
                <li className="flex gap-3"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center">3</span>
                  <span>Автоматически формируется <b>«Производственное КП»</b> — версия <b>на русском и без цен</b> — и прикрепляется в тему и в карточку.</span></li>
                <li className="flex gap-3"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center">4</span>
                  <span>Клиентское КП с ценами и договор в производство <b>не отправляются</b>.</span></li>
              </ol>
              <div className="mt-3 flex items-start gap-2 text-xs text-emerald-800 bg-emerald-100/60 rounded-lg p-2.5">
                <RefreshCw className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Повторное нажатие <b>обновляет</b> данные в теме (новая тема не создаётся).</span>
              </div>
            </div>

            {/* Production KP explainer */}
            <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-5 mb-5">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold">Как формируется и обновляется «Производственное КП»</h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-emerald-700 mb-1">✅ Что остаётся</p>
                  <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                    <li>Модель, лавки, печь, цвет</li>
                    <li>Список выбранных опций (без цен)</li>
                    <li>Комментарий к заказу</li>
                    <li>Схема-планировка</li>
                    <li>Галерея фото</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-rose-700 mb-1">🚫 Что убирается</p>
                  <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                    <li>Все цены и «Итого»</li>
                    <li>Промо-блок / акции</li>
                    <li>Доставка и рассрочка</li>
                    <li>Вторая страница с доп.опциями</li>
                  </ul>
                </div>
              </div>
              <div className="mt-3 text-xs text-orange-800 bg-orange-100/60 rounded-lg p-2.5 space-y-1">
                <p><b>Когда обновляется:</b> при каждом нажатии «Отправить в производство» документ пересоздаётся заново из текущего состава заказа — старая версия заменяется на свежую.</p>
                <p><b>Где взять:</b> в карточке → раздел <Btn color="amber">Документы → Производственное КП</Btn> (оранжевый бейдж), можно скачать отдельно.</p>
              </div>
            </div>

            {/* Two-way communication */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
              <div className="flex items-center gap-2 mb-4">
                <MessageCircle className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold">Как производство отвечает — и что попадает в карточку</h3>
              </div>
              <div className="space-y-3">
                <div className="flex gap-3 items-start bg-white/70 rounded-xl border p-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Кнопка «Принять в работу» ✅</p>
                    <p className="text-muted-foreground">Фиксируется, кто и когда принял заказ. В карточке пропадает метка «Ждут приёмки».</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start bg-white/70 rounded-xl border p-3">
                  <CalendarDays className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Кнопки «Плановый старт» / «Дата производства» 📅</p>
                    <p className="text-muted-foreground">Бот попросит ответить датой в формате ДД.ММ.ГГГГ — дата сохранится в карточку.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start bg-white/70 rounded-xl border p-3">
                  <MessageCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Комментарий — двумя способами 💬</p>
                    <p className="text-muted-foreground">Можно нажать кнопку «Комментарий», <b>а можно просто написать сообщение прямо в теме заказа</b> — оно автоматически сохранится как комментарий производства в карточку.</p>
                    <p className="text-muted-foreground mt-1 inline-flex items-center gap-1"><ThumbsUp className="w-4 h-4 text-blue-600" /> Бот ставит реакцию <b>👍</b> — значит сообщение попало в карточку.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start bg-white/70 rounded-xl border p-3">
                  <Camera className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Фото 📷</p>
                    <p className="text-muted-foreground">Фотография, отправленная в тему, сохраняется в карточку (Документы → «Фото производства»).</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 text-xs text-blue-800 bg-blue-100/60 rounded-lg p-2.5">
                <User className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Всё видно в карточке в реальном времени: статус приёмки, даты, комментарии и фото. При новом сообщении появляется отметка «Новое сообщение/фото от производства».</span>
              </div>
            </div>
          </section>

          {/* Checklist */}
          <section>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full" /> Чек-лист
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {['Открыть заказ из amoCRM', 'Калькулятор: модель/опции', 'КП клиенту', 'Этап на канбане', 'Тех. задание → PDF', 'Договор', 'Отправить в производство', 'Следить за ответами в карточке'].map((s, i, arr) => (
                <React.Fragment key={i}>
                  <span className="px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 font-medium">{i + 1}. {s}</span>
                  {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-slate-400" />}
                </React.Fragment>
              ))}
            </div>
          </section>

          <p className="text-xs text-muted-foreground border-t pt-4 flex items-center gap-1">
            <PhoneCall className="w-3.5 h-3.5" /> Вопросы по работе сервиса — обращайтесь к администратору.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerGuideDialog;
