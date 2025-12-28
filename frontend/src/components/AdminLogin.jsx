import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Lock, LogIn } from 'lucide-react';
import { toast } from 'sonner';

const ADMIN_PASSWORD = '159357';

export const AdminLogin = ({ isOpen, onClose, onSuccess }) => {
  const { t, i18n } = useTranslation();
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Get localized texts
  const texts = {
    ru: {
      title: 'Вход для администратора',
      description: 'Введите пароль для доступа к разделу управления ценами',
      passwordLabel: 'Пароль администратора',
      placeholder: 'Введите пароль',
      cancel: 'Отмена',
      login: 'Войти',
      checking: 'Проверка...',
      success: 'Вход выполнен успешно!',
      error: 'Неверный пароль!',
    },
    pl: {
      title: 'Logowanie administratora',
      description: 'Wprowadź hasło, aby uzyskać dostęp do zarządzania cenami',
      passwordLabel: 'Hasło administratora',
      placeholder: 'Wprowadź hasło',
      cancel: 'Anuluj',
      login: 'Zaloguj',
      checking: 'Sprawdzanie...',
      success: 'Zalogowano pomyślnie!',
      error: 'Nieprawidłowe hasło!',
    },
  };

  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      if (password === ADMIN_PASSWORD) {
        // Save auth state
        sessionStorage.setItem('adminAuth', 'true');
        toast.success(txt.success);
        onSuccess();
        setPassword('');
      } else {
        toast.error(txt.error);
      }
      setIsLoading(false);
    }, 500);
  };

  const handleClose = () => {
    setPassword('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            {txt.title}
          </DialogTitle>
          <DialogDescription>
            {txt.description}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-password">{txt.passwordLabel}</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={txt.placeholder}
                autoFocus
                required
                disabled={isLoading}
              />
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              {txt.cancel}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  {txt.checking}
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  {txt.login}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
