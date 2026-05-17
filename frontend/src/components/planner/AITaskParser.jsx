import React, { useState } from 'react';
import axios from 'axios';
import { Sparkles, Loader2, Wand2, X, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/api';
import { getAuthHeaders, PRIORITIES } from './constants';

const API = getApiUrl();

const SAMPLE = `1. Срочно позвонить клиенту Кравчуку насчёт договора
2. Подготовить КП для Wiking 4m, дедлайн пятница
- Разобрать склад сауны: разделить опции и крепеж
- Обновить картинки для маркетинга на сайте`;

/**
 * "AI Parse Tasks" button → modal that turns free-form Russian/Polish text
 * into a list of structured task drafts, lets the user review/edit/delete
 * each row, then commits them in a single bulk-create call.
 *
 * Two-step flow on purpose: the LLM is good but not perfect, so the user
 * always gets to vet before writing to DB.
 */
export default function AITaskParser({ users, directions, defaultDirection, onCreated }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [direction, setDirection] = useState(defaultDirection || 'other');
  const [parsed, setParsed] = useState(null); // null = haven't parsed yet, [] = parsed, drafts editable
  const [busy, setBusy] = useState(false);

  const handleParse = async () => {
    if (!text.trim()) {
      toast.error('Введите текст с задачами');
      return;
    }
    setBusy(true);
    try {
      const r = await axios.post(`${API}/api/planner/ai-parse`, {
        text: text.trim(),
        defaultDirection: direction,
        assignableUsers: (users || []).map((u) => ({ id: u.id, username: u.username })),
      }, { headers: getAuthHeaders() });
      const drafts = (r.data?.tasks || []).map((t) => ({ ...t, _selected: true }));
      setParsed(drafts);
      if (drafts.length === 0) {
        toast.warning('ИИ не нашёл задач в этом тексте. Попробуйте сформулировать яснее.');
      } else {
        toast.success(`Распознано задач: ${drafts.length}`);
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка распознавания');
    } finally {
      setBusy(false);
    }
  };

  const updateDraft = (idx, patch) => {
    setParsed((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const removeDraft = (idx) => {
    setParsed((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCommit = async () => {
    const selected = (parsed || []).filter((d) => d._selected && d.title.trim());
    if (selected.length === 0) {
      toast.error('Нет задач для создания');
      return;
    }
    setBusy(true);
    try {
      const r = await axios.post(`${API}/api/planner/tasks/bulk-create`, {
        tasks: selected.map((d) => ({
          title: d.title,
          description: d.description,
          businessDirection: d.businessDirection,
          priority: d.priority,
          dueDate: d.dueDate || null,
          assigneeUserId: d.assigneeUserId || null,
          tags: d.tags || [],
          checklist: d.checklist || [],
        })),
      }, { headers: getAuthHeaders() });
      toast.success(`Создано задач: ${r.data?.created || 0}`);
      onCreated?.();
      handleClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка создания');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setText('');
    setParsed(null);
    setBusy(false);
  };

  const selectedCount = (parsed || []).filter((d) => d._selected && d.title.trim()).length;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-950/30 gap-1.5"
        data-testid="ai-parse-tasks-btn"
      >
        <Sparkles className="h-3.5 w-3.5" /> Распознать ИИ
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && !busy && handleClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="ai-parse-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" /> Распознать задачи с помощью ИИ
            </DialogTitle>
            <DialogDescription>
              Вставьте текст из заметок — ИИ разобьёт его на отдельные задачи. Можно отредактировать и удалить, прежде чем создавать.
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: input */}
          {parsed === null && (
            <div className="space-y-3 flex-1 overflow-auto pr-1">
              <div>
                <Label className="text-xs">Текст задач (русский, польский — любой)</Label>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Пример:\n${SAMPLE}`}
                  rows={10}
                  className="font-mono text-sm"
                  data-testid="ai-parse-textarea"
                  maxLength={10000}
                  autoFocus
                />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                  <span>{text.length} / 10 000</span>
                  <button
                    type="button"
                    onClick={() => setText(SAMPLE)}
                    className="underline hover:text-foreground"
                    data-testid="ai-parse-fill-sample"
                  >
                    Вставить пример
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Направление по умолчанию (если ИИ не распознает)</Label>
                <Select value={direction} onValueChange={setDirection}>
                  <SelectTrigger className="h-8 text-sm" data-testid="ai-parse-default-direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(directions || []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 2: preview & edit */}
          {parsed !== null && (
            <div className="space-y-2 flex-1 overflow-auto pr-1" data-testid="ai-parse-preview">
              {parsed.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  ИИ не нашёл задач. Вернитесь назад и переформулируйте.
                </div>
              ) : (
                parsed.map((d, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border p-3 ${d._selected ? 'bg-card' : 'bg-muted/30 opacity-60'} space-y-2`}
                    data-testid={`ai-draft-${idx}`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={d._selected}
                        onChange={(e) => updateDraft(idx, { _selected: e.target.checked })}
                        className="mt-1.5"
                        data-testid={`ai-draft-select-${idx}`}
                      />
                      <Input
                        value={d.title}
                        onChange={(e) => updateDraft(idx, { title: e.target.value })}
                        placeholder="Название"
                        className="font-medium"
                        data-testid={`ai-draft-title-${idx}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDraft(idx)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        data-testid={`ai-draft-remove-${idx}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pl-7">
                      <div>
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Направление</Label>
                        <Select value={d.businessDirection} onValueChange={(v) => updateDraft(idx, { businessDirection: v })}>
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(directions || []).map((dir) => (
                              <SelectItem key={dir.id} value={dir.id}>{dir.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Приоритет</Label>
                        <Select value={d.priority} onValueChange={(v) => updateDraft(idx, { priority: v })}>
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITIES.map((p) => (
                              <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Срок</Label>
                        <Input
                          type="date"
                          value={d.dueDate || ''}
                          onChange={(e) => updateDraft(idx, { dueDate: e.target.value })}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Исполнитель</Label>
                        <Select
                          value={d.assigneeUserId || '__none__'}
                          onValueChange={(v) => updateDraft(idx, { assigneeUserId: v === '__none__' ? '' : v })}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">(не назначен)</SelectItem>
                            {(users || []).map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {(d.description || d.checklist?.length > 0) && (
                      <div className="pl-7 text-[11px] text-muted-foreground space-y-1">
                        {d.description && <div className="italic">«{d.description}»</div>}
                        {d.checklist?.length > 0 && (
                          <div>
                            <span className="font-semibold">Чек-лист:</span>{' '}
                            {d.checklist.map((c) => c.text).join(' · ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {parsed === null ? (
              <>
                <Button variant="outline" onClick={handleClose} disabled={busy}>Отмена</Button>
                <Button
                  onClick={handleParse}
                  disabled={busy || !text.trim()}
                  className="bg-purple-600 hover:bg-purple-700"
                  data-testid="ai-parse-submit"
                >
                  {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1" />}
                  Распознать
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setParsed(null)} disabled={busy}>
                  <X className="h-3.5 w-3.5 mr-1" /> Назад к тексту
                </Button>
                <Button
                  onClick={handleCommit}
                  disabled={busy || selectedCount === 0}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  data-testid="ai-commit-tasks"
                >
                  {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Создать {selectedCount > 0 ? `(${selectedCount})` : ''}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
