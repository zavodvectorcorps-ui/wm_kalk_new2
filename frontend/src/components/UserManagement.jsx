import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Users, Plus, Pencil, Trash2, Waves, Flame, Shield, Save, X } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const UserManagement = () => {
  const { i18n } = useTranslation();
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({ username: '', password: '', access: 'balia' });

  const texts = {
    ru: {
      title: 'Управление сотрудниками',
      addEmployee: 'Добавить сотрудника',
      username: 'Имя пользователя',
      password: 'Пароль',
      newPassword: 'Новый пароль (оставьте пустым, чтобы не менять)',
      access: 'Доступ',
      accessBalia: 'Только Balia',
      accessSauna: 'Только Sauna',
      accessAll: 'Все калькуляторы',
      role: 'Роль',
      admin: 'Администратор',
      employee: 'Сотрудник',
      observer: 'Наблюдатель',
      roleEmployee: 'Сотрудник (может создавать заказы)',
      roleObserver: 'Наблюдатель (только просмотр)',
      actions: 'Действия',
      edit: 'Редактировать',
      delete: 'Удалить',
      save: 'Сохранить',
      cancel: 'Отмена',
      addTitle: 'Добавить сотрудника',
      addDesc: 'Создайте новую учетную запись сотрудника',
      editTitle: 'Редактировать сотрудника',
      editDesc: 'Измените данные сотрудника',
      deleteTitle: 'Удалить сотрудника',
      deleteDesc: 'Вы уверены, что хотите удалить этого сотрудника?',
      deleteConfirm: 'Удалить',
      noUsers: 'Сотрудники не найдены',
      created: 'Создан',
      userAdded: 'Сотрудник добавлен!',
      userUpdated: 'Сотрудник обновлен!',
      userDeleted: 'Сотрудник удален!',
      error: 'Произошла ошибка',
      usernameExists: 'Имя пользователя уже существует',
    },
    pl: {
      title: 'Zarządzanie pracownikami',
      addEmployee: 'Dodaj pracownika',
      username: 'Nazwa użytkownika',
      password: 'Hasło',
      newPassword: 'Nowe hasło (pozostaw puste, aby nie zmieniać)',
      access: 'Dostęp',
      accessBalia: 'Tylko Balia',
      accessSauna: 'Tylko Sauna',
      accessAll: 'Wszystkie kalkulatory',
      role: 'Rola',
      admin: 'Administrator',
      employee: 'Pracownik',
      observer: 'Obserwator',
      roleEmployee: 'Pracownik (może tworzyć zamówienia)',
      roleObserver: 'Obserwator (tylko podgląd)',
      actions: 'Akcje',
      edit: 'Edytuj',
      delete: 'Usuń',
      save: 'Zapisz',
      cancel: 'Anuluj',
      addTitle: 'Dodaj pracownika',
      addDesc: 'Utwórz nowe konto pracownika',
      editTitle: 'Edytuj pracownika',
      editDesc: 'Zmień dane pracownika',
      deleteTitle: 'Usuń pracownika',
      deleteDesc: 'Czy na pewno chcesz usunąć tego pracownika?',
      deleteConfirm: 'Usuń',
      noUsers: 'Nie znaleziono pracowników',
      created: 'Utworzono',
      userAdded: 'Pracownik dodany!',
      userUpdated: 'Pracownik zaktualizowany!',
      userDeleted: 'Pracownik usunięty!',
      error: 'Wystąpił błąd',
      usernameExists: 'Nazwa użytkownika już istnieje',
    },
  };

  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      toast.error(txt.error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success(txt.userAdded);
        setIsAddDialogOpen(false);
        setFormData({ username: '', password: '', access: 'balia' });
        fetchUsers();
      } else {
        const error = await response.json();
        if (error.detail?.includes('exists')) {
          toast.error(txt.usernameExists);
        } else {
          toast.error(txt.error);
        }
      }
    } catch (err) {
      toast.error(txt.error);
    }
  };

  const handleEditUser = async () => {
    try {
      const updateData = {
        username: formData.username,
        access: formData.access
      };
      if (formData.password) {
        updateData.password = formData.password;
      }

      const response = await fetch(`${API_URL}/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        toast.success(txt.userUpdated);
        setIsEditDialogOpen(false);
        setSelectedUser(null);
        setFormData({ username: '', password: '', access: 'balia' });
        fetchUsers();
      } else {
        const error = await response.json();
        if (error.detail?.includes('exists')) {
          toast.error(txt.usernameExists);
        } else {
          toast.error(txt.error);
        }
      }
    } catch (err) {
      toast.error(txt.error);
    }
  };

  const handleDeleteUser = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users/${selectedUser.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success(txt.userDeleted);
        setIsDeleteDialogOpen(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        toast.error(txt.error);
      }
    } catch (err) {
      toast.error(txt.error);
    }
  };

  const openEditDialog = (user) => {
    setSelectedUser(user);
    setFormData({ username: user.username, password: '', access: user.access });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (user) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const getAccessBadge = (access) => {
    switch (access) {
      case 'balia':
        return (
          <Badge variant="secondary" className="gap-1">
            <Waves className="w-3 h-3" />
            Balia
          </Badge>
        );
      case 'sauna':
        return (
          <Badge variant="secondary" className="gap-1 bg-orange-100 text-orange-700">
            <Flame className="w-3 h-3" />
            Sauna
          </Badge>
        );
      case 'all':
        return (
          <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700">
            <Shield className="w-3 h-3" />
            {txt.accessAll}
          </Badge>
        );
      default:
        return null;
    }
  };

  const employees = users.filter(u => u.role === 'employee');

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-xl">{txt.title}</CardTitle>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            {txt.addEmployee}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {txt.noUsers}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{txt.username}</TableHead>
                    <TableHead>{txt.access}</TableHead>
                    <TableHead>{txt.created}</TableHead>
                    <TableHead className="text-right">{txt.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{getAccessBadge(user.access)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(user)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{txt.addTitle}</DialogTitle>
            <DialogDescription>{txt.addDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{txt.username}</Label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder={txt.username}
              />
            </div>
            <div className="space-y-2">
              <Label>{txt.password}</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={txt.password}
              />
            </div>
            <div className="space-y-2">
              <Label>{txt.access}</Label>
              <Select
                value={formData.access}
                onValueChange={(value) => setFormData({ ...formData, access: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balia">
                    <div className="flex items-center gap-2">
                      <Waves className="w-4 h-4" />
                      {txt.accessBalia}
                    </div>
                  </SelectItem>
                  <SelectItem value="sauna">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4" />
                      {txt.accessSauna}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              <X className="w-4 h-4 mr-2" />
              {txt.cancel}
            </Button>
            <Button onClick={handleAddUser} disabled={!formData.username || !formData.password}>
              <Save className="w-4 h-4 mr-2" />
              {txt.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{txt.editTitle}</DialogTitle>
            <DialogDescription>{txt.editDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{txt.username}</Label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder={txt.username}
              />
            </div>
            <div className="space-y-2">
              <Label>{txt.newPassword}</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label>{txt.access}</Label>
              <Select
                value={formData.access}
                onValueChange={(value) => setFormData({ ...formData, access: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balia">
                    <div className="flex items-center gap-2">
                      <Waves className="w-4 h-4" />
                      {txt.accessBalia}
                    </div>
                  </SelectItem>
                  <SelectItem value="sauna">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4" />
                      {txt.accessSauna}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              <X className="w-4 h-4 mr-2" />
              {txt.cancel}
            </Button>
            <Button onClick={handleEditUser} disabled={!formData.username}>
              <Save className="w-4 h-4 mr-2" />
              {txt.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{txt.deleteTitle}</DialogTitle>
            <DialogDescription>
              {txt.deleteDesc}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <p className="font-medium">{selectedUser.username}</p>
              <p className="text-sm text-muted-foreground">{getAccessBadge(selectedUser.access)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {txt.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              <Trash2 className="w-4 h-4 mr-2" />
              {txt.deleteConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
