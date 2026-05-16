import React, { useState } from 'react';
import axios from 'axios';
import { Plus, Loader2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { Calendar as CalIcon } from 'lucide-react';
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/api';
import { getAuthHeaders, formatDate } from './constants';

const API = getApiUrl();

export default function QuickCreate({ users, directions, defaultDirection, onCreated }) {
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [direction, setDirection] = useState(defaultDirection || 'other');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await axios.post(`${API}/api/planner/tasks`, {
        title: title.trim(),
        businessDirection: direction || 'other',
        assigneeUserId: assignee || null,
        dueDate: dueDate || null,
        status: 'planned',
      }, { headers: getAuthHeaders() });
      toast.success('Задача создана');
      setTitle(''); setAssignee(''); setDueDate(''); setDirection(defaultDirection || 'other');
      onCreated?.(res.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Ошибка создания');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border rounded-lg bg-card p-3 flex flex-wrap items-center gap-2" data-testid="quick-create-bar">
      <Input
        placeholder="Быстрое создание задачи (Enter)..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && create()}
        className="flex-1 min-w-[220px] h-9"
        data-testid="quick-create-title"
      />
      <Select value={direction || 'other'} onValueChange={setDirection}>
        <SelectTrigger className="w-[150px] h-9" data-testid="quick-create-direction"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(directions || []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={assignee || '__none__'} onValueChange={(v) => setAssignee(v === '__none__' ? '' : v)}>
        <SelectTrigger className="w-[180px] h-9" data-testid="quick-create-assignee"><SelectValue placeholder="Ответственный" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Общая задача</SelectItem>
          {(users || []).map((u) => <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>)}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9" data-testid="quick-create-due">
            <CalIcon className="w-4 h-4 mr-1" />
            {dueDate ? formatDate(dueDate) : 'Срок'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-auto">
          <Calendar
            mode="single"
            selected={dueDate ? new Date(dueDate + 'T00:00:00') : undefined}
            onSelect={(d) => setDueDate(d ? d.toISOString().slice(0, 10) : '')}
            initialFocus
          />
          {dueDate && (
            <div className="p-2 border-t">
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setDueDate('')}>Убрать срок</Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Button onClick={create} disabled={!title.trim() || busy} className="bg-orange-500 hover:bg-orange-600 h-9" data-testid="quick-create-submit">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
        Создать
      </Button>
    </div>
  );
}
