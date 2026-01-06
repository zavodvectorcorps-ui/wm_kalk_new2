import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { LogIn, User, Lock, AlertCircle, Smartphone, Share, Plus, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';

export const LoginPage = () => {
  const { i18n } = useTranslation();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const texts = {
    ru: {
      title: 'Вход в систему',
      subtitle: 'Введите данные для входа',
      username: 'Имя пользователя',
      usernamePlaceholder: 'Введите имя',
      password: 'Пароль',
      passwordPlaceholder: 'Введите пароль',
      login: 'Войти',
      loading: 'Вход...',
      error: 'Неверное имя пользователя или пароль',
      success: 'Вход выполнен успешно!',
      installApp: 'Установить как приложение',
      installInstructions: {
        ios: 'iPhone/iPad: нажмите',
        iosShare: '(Поделиться)',
        iosThen: '→ «На экран Домой»',
        android: 'Android: нажмите',
        androidMenu: '(меню)',
        androidThen: '→ «Добавить на главный экран»'
      }
    },
    pl: {
      title: 'Logowanie',
      subtitle: 'Wprowadź dane logowania',
      username: 'Nazwa użytkownika',
      usernamePlaceholder: 'Wprowadź nazwę',
      password: 'Hasło',
      passwordPlaceholder: 'Wprowadź hasło',
      login: 'Zaloguj',
      loading: 'Logowanie...',
      error: 'Nieprawidłowa nazwa użytkownika lub hasło',
      success: 'Zalogowano pomyślnie!',
      installApp: 'Zainstaluj jako aplikację',
      installInstructions: {
        ios: 'iPhone/iPad: naciśnij',
        iosShare: '(Udostępnij)',
        iosThen: '→ «Dodaj do ekranu początkowego»',
        android: 'Android: naciśnij',
        androidMenu: '(menu)',
        androidThen: '→ «Dodaj do ekranu głównego»'
      }
    },
  };

  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  const txt = texts[lang];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password);
      toast.success(txt.success);
    } catch (err) {
      setError(txt.error);
      toast.error(txt.error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">{txt.title}</CardTitle>
          <CardDescription>{txt.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="username">{txt.username}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={txt.usernamePlaceholder}
                  className="pl-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{txt.password}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={txt.passwordPlaceholder}
                  className="pl-10"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  {txt.loading}
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  {txt.login}
                </>
              )}
            </Button>
          </form>
          
          {/* Install as app instructions */}
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Smartphone className="h-4 w-4" />
              <span className="font-medium">{txt.installApp}</span>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <p className="flex items-center gap-1 flex-wrap">
                <span>{txt.installInstructions.ios}</span>
                <Share className="h-3 w-3 inline" />
                <span>{txt.installInstructions.iosShare}</span>
                <span>{txt.installInstructions.iosThen}</span>
              </p>
              <p className="flex items-center gap-1 flex-wrap">
                <span>{txt.installInstructions.android}</span>
                <MoreVertical className="h-3 w-3 inline" />
                <span>{txt.installInstructions.androidMenu}</span>
                <span>{txt.installInstructions.androidThen}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
