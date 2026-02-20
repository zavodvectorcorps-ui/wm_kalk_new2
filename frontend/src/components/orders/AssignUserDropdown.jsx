import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { UserCircle, ChevronDown, Check, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

// Smart API URL
const getApiUrl = () => { 
  if (typeof window !== 'undefined') { 
    const o = window.location.origin; 
    if (o.includes('wm-kalkulator.pl') || o.includes('.emergent.host') || o.includes('.emergentagent.com')) return o; 
  } 
  return process.env.REACT_APP_BACKEND_URL || ''; 
};
const API_URL = getApiUrl();

export const AssignUserDropdown = ({ 
  order, 
  currentUser, 
  onAssigned,
  isSauna = true,
  lang = 'ru'
}) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [open, setOpen] = useState(false);

  const texts = {
    ru: {
      assignTo: 'Назначить',
      assigned: 'Назначено',
      noUsers: 'Нет пользователей',
      error: 'Ошибка',
      success: 'Ответственный изменён',
    },
    pl: {
      assignTo: 'Przypisz',
      assigned: 'Przypisano',
      noUsers: 'Brak użytkowników',
      error: 'Błąd',
      success: 'Odpowiedzialny zmieniony',
    },
  };
  const txt = texts[lang] || texts.ru;

  // Fetch users when dropdown opens
  useEffect(() => {
    if (open && users.length === 0) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter to show only employees/managers and admins who can handle orders
      const relevantUsers = response.data.filter(u => 
        ['admin', 'employee'].includes(u.role)
      );
      setUsers(relevantUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error(txt.error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (username) => {
    if (username === order.createdBy) {
      setOpen(false);
      return;
    }

    setAssigning(true);
    try {
      const token = localStorage.getItem('token');
      const endpoint = isSauna 
        ? `${API_URL}/api/sauna/orders/${order.id}/assign`
        : `${API_URL}/api/orders/${order.id}/assign`;
      
      const response = await axios.patch(endpoint, {
        createdBy: username,
        assignedBy: currentUser?.username || 'admin'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(txt.success);
      if (onAssigned) {
        onAssigned(response.data);
      }
    } catch (error) {
      console.error('Error assigning user:', error);
      toast.error(txt.error);
    } finally {
      setAssigning(false);
      setOpen(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 px-2 text-sm font-normal gap-1"
          disabled={assigning}
          data-testid={`assign-user-btn-${order.id}`}
        >
          {assigning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserCircle className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="max-w-[80px] truncate">
            {order.createdBy || '-'}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            {txt.noUsers}
          </div>
        ) : (
          users.map(user => (
            <DropdownMenuItem
              key={user.id}
              onClick={() => handleAssign(user.username)}
              className="flex items-center justify-between cursor-pointer"
              data-testid={`assign-option-${user.username}`}
            >
              <div className="flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                <span>{user.username}</span>
              </div>
              {user.username === order.createdBy && (
                <Check className="h-4 w-4 text-green-600" />
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
