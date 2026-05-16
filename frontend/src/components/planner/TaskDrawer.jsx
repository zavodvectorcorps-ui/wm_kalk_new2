import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Save, Trash2, X, MessageSquare, ListChecks, Clock, Send, Pencil, CheckSquare, Square, Calendar as CalIcon, Archive } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '../ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Badge } from '../ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/api';
import { STATUSES, PRIORITIES, getAuthHeaders, formatDate, formatDateTime, dirById, isOverdue } from './constants';

const API = getApiUrl();

export default function TaskDrawer({ task, users, directions, currentUser, onClose, onChanged, isAdmin }) {
  const [draft, setDraft] = useState(task);
  const [saving, setSaving] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newChecklistText, setNewChecklistText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  useEffect(() => setDraft(task), [task?.id]);

  if (!task) return null;
  const overdue = isOverdue(draft);
  const dir = dirById(directions, draft.businessDirection);

  // ---- save (only changed fields) ----
  const persist = async (patch, optimistic = true) => {
    setSaving(true);
    if (optimistic) setDraft((d) => ({ ...d, ...patch }));
    try {
      const res = await axios.put(`${API}/api/planner/tasks/${task.id}`, patch, { headers: getAuthHeaders() });
      setDraft(res.data);
      onChanged?.(res.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const saveMain = async () => {
    const patch = {};
    if (draft.title !== task.title) patch.title = draft.title;
    if (draft.description !== task.description) patch.description = draft.description;
    if (Object.keys(patch).length === 0) return;
    await persist(patch, false);
    toast.success('Сохранено');
  };

  // ---- comments ----
  const addComment = async () => {
    const t = newComment.trim();
    if (!t) return;
    try {
      await axios.post(`${API}/api/planner/tasks/${task.id}/comments`, { text: t }, { headers: getAuthHeaders() });
      setNewComment('');
      const res = await axios.get(`${API}/api/planner/tasks/${task.id}`, { headers: getAuthHeaders() });
      setDraft(res.data); onChanged?.(res.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка');
    }
  };
  const saveCommentEdit = async (cid) => {
    try {
      await axios.put(`${API}/api/planner/tasks/${task.id}/comments/${cid}`, { text: editingCommentText.trim() }, { headers: getAuthHeaders() });
      setEditingCommentId(null);
      const res = await axios.get(`${API}/api/planner/tasks/${task.id}`, { headers: getAuthHeaders() });
      setDraft(res.data); onChanged?.(res.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка');
    }
  };
  const deleteComment = async (cid) => {
    if (!window.confirm('Удалить комментарий?')) return;
    try {
      await axios.delete(`${API}/api/planner/tasks/${task.id}/comments/${cid}`, { headers: getAuthHeaders() });
      const res = await axios.get(`${API}/api/planner/tasks/${task.id}`, { headers: getAuthHeaders() });
      setDraft(res.data); onChanged?.(res.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка');
    }
  };

  // ---- checklist ----
  const addChecklistItem = async () => {
    const t = newChecklistText.trim();
    if (!t) return;
    try {
      await axios.post(`${API}/api/planner/tasks/${task.id}/checklist`, { text: t }, { headers: getAuthHeaders() });
      setNewChecklistText('');
      const res = await axios.get(`${API}/api/planner/tasks/${task.id}`, { headers: getAuthHeaders() });
      setDraft(res.data); onChanged?.(res.data);
    } catch (e) {
      toast.error('Ошибка');
    }
  };
  const toggleChecklist = async (itemId) => {
    try {
      await axios.patch(`${API}/api/planner/tasks/${task.id}/checklist/${itemId}`, {}, { headers: getAuthHeaders() });
      const res = await axios.get(`${API}/api/planner/tasks/${task.id}`, { headers: getAuthHeaders() });
      setDraft(res.data); onChanged?.(res.data);
    } catch (e) {
      toast.error('Ошибка');
    }
  };
  const deleteChecklistItem = async (itemId) => {
    try {
      await axios.delete(`${API}/api/planner/tasks/${task.id}/checklist/${itemId}`, { headers: getAuthHeaders() });
      const res = await axios.get(`${API}/api/planner/tasks/${task.id}`, { headers: getAuthHeaders() });
      setDraft(res.data); onChanged?.(res.data);
    } catch (e) {
      toast.error('Ошибка');
    }
  };

  const removeTask = async () => {
    if (!window.confirm('Удалить задачу безвозвратно?')) return;
    try {
      await axios.delete(`${API}/api/planner/tasks/${task.id}`, { headers: getAuthHeaders() });
      toast.success('Задача удалена');
      onChanged?.(null);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Только админ может удалить');
    }
  };

  const archiveTask = () => persist({ archived: !draft.archived });

  const checklistDone = (draft.checklist || []).filter((c) => c.done).length;
  const checklistTotal = (draft.checklist || []).length;

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" data-testid="task-drawer">
        <VisuallyHidden>
          <SheetTitle>{draft.title || 'Задача'}</SheetTitle>
        </VisuallyHidden>
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start gap-2">
            <span className="inline-block w-1.5 h-8 rounded shrink-0 mt-1" style={{ backgroundColor: dir.color }} />
            <div className="flex-1 min-w-0">
              <Input
                value={draft.title || ''}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                onBlur={saveMain}
                className="text-lg font-semibold border-transparent hover:border-slate-200 focus:border-slate-300 px-1"
                data-testid="task-title-input"
              />
              <SheetDescription className="flex flex-wrap items-center gap-1.5 mt-1 text-xs">
                <span>Создал: <b className="text-foreground">{draft.createdByUsername || '—'}</b></span>
                <span>·</span>
                <span>{formatDateTime(draft.createdAt)}</span>
                {draft.archived && <Badge variant="outline" className="ml-2">В архиве</Badge>}
                {overdue && <Badge variant="outline" className="border-red-300 text-red-700">Просрочено</Badge>}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Properties */}
        <div className="py-4 grid grid-cols-2 gap-3 text-sm">
          <PropRow label="Статус">
            <Select value={draft.status} onValueChange={(v) => persist({ status: v })}>
              <SelectTrigger className="h-8" data-testid="drawer-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </PropRow>
          <PropRow label="Приоритет">
            <Select value={draft.priority} onValueChange={(v) => persist({ priority: v })}>
              <SelectTrigger className="h-8" data-testid="drawer-priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </PropRow>
          <PropRow label="Направление">
            <Select value={draft.businessDirection || 'other'} onValueChange={(v) => persist({ businessDirection: v })}>
              <SelectTrigger className="h-8" data-testid="drawer-direction"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(directions || []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </PropRow>
          <PropRow label="Ответственный">
            <Select value={draft.assigneeUserId || '__none__'} onValueChange={(v) => persist({ assigneeUserId: v === '__none__' ? '' : v })}>
              <SelectTrigger className="h-8" data-testid="drawer-assignee"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— не назначен —</SelectItem>
                {(users || []).map((u) => <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>)}
              </SelectContent>
            </Select>
          </PropRow>
          <PropRow label="Дедлайн">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={`h-8 justify-start font-normal ${overdue ? 'border-red-300 text-red-700' : ''}`} data-testid="drawer-due">
                  <CalIcon className="w-4 h-4 mr-1" />
                  {draft.dueDate ? formatDate(draft.dueDate) : 'Установить'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-auto">
                <Calendar
                  mode="single"
                  selected={draft.dueDate ? new Date(draft.dueDate + 'T00:00:00') : undefined}
                  onSelect={(d) => persist({ dueDate: d ? d.toISOString().slice(0, 10) : '' })}
                  initialFocus
                />
                {draft.dueDate && (
                  <div className="p-2 border-t">
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => persist({ dueDate: '' })}>Убрать срок</Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </PropRow>
          <PropRow label="Завершена">
            <div className="text-xs text-muted-foreground h-8 flex items-center">
              {draft.completedAt ? formatDateTime(draft.completedAt) : '—'}
            </div>
          </PropRow>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Описание</label>
          <Textarea
            value={draft.description || ''}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            onBlur={saveMain}
            placeholder="Подробное описание задачи..."
            className="min-h-[100px]"
            data-testid="task-description"
          />
        </div>

        {/* Tabs: checklist / comments / history */}
        <Tabs defaultValue="checklist" className="mt-4">
          <TabsList>
            <TabsTrigger value="checklist" data-testid="tab-checklist">
              <ListChecks className="w-4 h-4 mr-1" /> Чек-лист {checklistTotal > 0 && `(${checklistDone}/${checklistTotal})`}
            </TabsTrigger>
            <TabsTrigger value="comments" data-testid="tab-comments">
              <MessageSquare className="w-4 h-4 mr-1" /> Комментарии ({(draft.comments || []).length})
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <Clock className="w-4 h-4 mr-1" /> История
            </TabsTrigger>
          </TabsList>

          <TabsContent value="checklist" className="space-y-2">
            {(draft.checklist || []).map((it) => (
              <div key={it.id} className="flex items-start gap-2 group" data-testid={`checklist-item-${it.id}`}>
                <button onClick={() => toggleChecklist(it.id)} className="mt-0.5 text-slate-400 hover:text-orange-500">
                  {it.done ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm ${it.done ? 'line-through text-muted-foreground' : ''}`}>{it.text}</div>
                  {it.done && it.doneByUsername && (
                    <div className="text-[11px] text-muted-foreground">{it.doneByUsername} · {formatDateTime(it.doneAt)}</div>
                  )}
                </div>
                <button onClick={() => deleteChecklistItem(it.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2">
              <Input
                placeholder="Новый пункт..."
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()}
                className="h-8"
                data-testid="checklist-new-text"
              />
              <Button size="sm" onClick={addChecklistItem} disabled={!newChecklistText.trim()} data-testid="checklist-add">
                Добавить
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="comments" className="space-y-3">
            {(draft.comments || []).length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4">Комментариев пока нет</div>
            )}
            {(draft.comments || []).map((c) => {
              const canEdit = c.authorUserId === currentUser?.id || isAdmin;
              return (
                <div key={c.id} className="text-sm border rounded-md p-2.5 bg-slate-50/50 group" data-testid={`comment-${c.id}`}>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span><b className="text-foreground">{c.authorUsername}</b> · {formatDateTime(c.createdAt)}{c.editedAt ? ' · ред.' : ''}</span>
                    {canEdit && editingCommentId !== c.id && (
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                        <button onClick={() => { setEditingCommentId(c.id); setEditingCommentText(c.text); }} className="text-slate-500 hover:text-slate-700"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteComment(c.id)} className="text-slate-500 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                  {editingCommentId === c.id ? (
                    <div className="space-y-2">
                      <Textarea value={editingCommentText} onChange={(e) => setEditingCommentText(e.target.value)} className="min-h-[60px]" />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveCommentEdit(c.id)} disabled={!editingCommentText.trim()}>Сохранить</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingCommentId(null)}>Отмена</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-sm">{c.text}</div>
                  )}
                </div>
              );
            })}
            <div className="flex items-end gap-2 pt-2">
              <Textarea
                placeholder="Написать комментарий..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[60px]"
                data-testid="comment-new-text"
              />
              <Button onClick={addComment} disabled={!newComment.trim()} data-testid="comment-add">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-1.5">
            {(draft.history || []).length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4">История пуста</div>
            ) : [...draft.history].reverse().map((h) => (
              <div key={h.id} className="text-xs flex items-start gap-2 py-1.5 border-b last:border-b-0">
                <Clock className="w-3 h-3 mt-0.5 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <span className="font-medium">{h.actorUsername}</span>
                  <span className="text-muted-foreground"> · {formatDateTime(h.at)}</span>
                  <div className="text-slate-600">
                    {h.action === 'created' && <>создал задачу: «{h.newValue}»</>}
                    {h.action === 'status' && <>изменил статус: <s className="opacity-60">{h.oldValue || '—'}</s> → <b>{h.newValue}</b></>}
                    {h.action === 'priority' && <>приоритет: <s className="opacity-60">{h.oldValue || '—'}</s> → <b>{h.newValue}</b></>}
                    {h.action === 'assignee' && <>ответственный: <s className="opacity-60">{h.oldValue || '—'}</s> → <b>{h.newValue || '—'}</b></>}
                    {h.action === 'due_date' && <>дедлайн: <s className="opacity-60">{h.oldValue || '—'}</s> → <b>{h.newValue || '—'}</b></>}
                    {h.action === 'direction' && <>направление: <s className="opacity-60">{h.oldValue || '—'}</s> → <b>{h.newValue}</b></>}
                    {h.action === 'title' && <>переименовал: «{h.newValue}»</>}
                    {h.action === 'comment' && <>добавил комментарий</>}
                    {h.action === 'archived' && <>{h.newValue === 'True' ? 'архивировал' : 'вернул из архива'}</>}
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>

        <SheetFooter className="pt-4 border-t mt-4 flex-row justify-between sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={archiveTask} data-testid="task-archive">
              <Archive className="w-4 h-4 mr-1" /> {draft.archived ? 'Вернуть' : 'В архив'}
            </Button>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={removeTask} className="border-red-300 text-red-600 hover:bg-red-50" data-testid="task-delete">
                <Trash2 className="w-4 h-4 mr-1" /> Удалить
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={onClose} data-testid="task-close">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <X className="w-4 h-4 mr-1" />} Закрыть
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function PropRow({ label, children }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
