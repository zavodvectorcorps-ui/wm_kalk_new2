import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { toast } from 'sonner';
import { Code, Copy, Check, ExternalLink, Monitor, Smartphone, Tablet } from 'lucide-react';

export const EmbedCodePage = () => {
  const { i18n } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [height, setHeight] = useState('900');
  const [width, setWidth] = useState('100%');
  
  const lang = i18n.language === 'pl' ? 'pl' : 'ru';
  
  // Get current domain
  const currentDomain = window.location.origin;
  const embedUrl = `${currentDomain}/embed/balia`;
  
  const txt = {
    ru: {
      title: 'Код для вставки калькулятора',
      description: 'Скопируйте код ниже и вставьте на ваш сайт',
      embedUrl: 'URL калькулятора',
      settings: 'Настройки',
      width: 'Ширина',
      height: 'Высота (px)',
      iframeCode: 'Код iframe',
      copy: 'Копировать',
      copied: 'Скопировано!',
      preview: 'Предпросмотр',
      openInNewTab: 'Открыть в новой вкладке',
      instructions: 'Инструкция',
      step1: '1. Скопируйте код iframe выше',
      step2: '2. Вставьте код в HTML вашего сайта',
      step3: '3. Настройте ширину и высоту при необходимости',
      note: 'Примечание: Калькулятор адаптивный и подстраивается под размер контейнера',
      responsive: 'Адаптивность',
      desktop: 'Десктоп',
      tablet: 'Планшет', 
      mobile: 'Мобильный'
    },
    pl: {
      title: 'Kod do osadzenia kalkulatora',
      description: 'Skopiuj poniższy kod i wklej na swoją stronę',
      embedUrl: 'URL kalkulatora',
      settings: 'Ustawienia',
      width: 'Szerokość',
      height: 'Wysokość (px)',
      iframeCode: 'Kod iframe',
      copy: 'Kopiuj',
      copied: 'Skopiowano!',
      preview: 'Podgląd',
      openInNewTab: 'Otwórz w nowej karcie',
      instructions: 'Instrukcja',
      step1: '1. Skopiuj powyższy kod iframe',
      step2: '2. Wklej kod w HTML swojej strony',
      step3: '3. Dostosuj szerokość i wysokość w razie potrzeby',
      note: 'Uwaga: Kalkulator jest responsywny i dostosowuje się do rozmiaru kontenera',
      responsive: 'Responsywność',
      desktop: 'Desktop',
      tablet: 'Tablet',
      mobile: 'Mobilny'
    }
  }[lang];

  const iframeCode = `<iframe 
  src="${embedUrl}" 
  width="${width}" 
  height="${height}px" 
  frameborder="0"
  style="border: none; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);"
  allow="clipboard-write"
></iframe>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(iframeCode);
      setCopied(true);
      toast.success(txt.copied);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            {txt.title}
          </CardTitle>
          <CardDescription>{txt.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Embed URL */}
          <div className="space-y-2">
            <Label>{txt.embedUrl}</Label>
            <div className="flex gap-2">
              <Input value={embedUrl} readOnly className="font-mono text-sm" />
              <Button
                variant="outline"
                onClick={() => window.open(embedUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Settings */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">{txt.settings}</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="width">{txt.width}</Label>
                <Input
                  id="width"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="100% lub 800px"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">{txt.height}</Label>
                <Input
                  id="height"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="900"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Code */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">{txt.iframeCode}</Label>
              <Button
                variant={copied ? "default" : "outline"}
                size="sm"
                onClick={handleCopy}
                className={copied ? "bg-green-600 hover:bg-green-700" : ""}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    {txt.copied}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    {txt.copy}
                  </>
                )}
              </Button>
            </div>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
              {iframeCode}
            </pre>
          </div>

          <Separator />

          {/* Instructions */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">{txt.instructions}</Label>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2 text-sm">
              <p>{txt.step1}</p>
              <p>{txt.step2}</p>
              <p>{txt.step3}</p>
              <p className="text-blue-600 mt-3">{txt.note}</p>
            </div>
          </div>

          <Separator />

          {/* Responsive info */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">{txt.responsive}</Label>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-gray-50 rounded-lg">
                <Monitor className="h-8 w-8 mx-auto mb-2 text-gray-600" />
                <p className="text-sm font-medium">{txt.desktop}</p>
                <p className="text-xs text-muted-foreground">1200px+</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <Tablet className="h-8 w-8 mx-auto mb-2 text-gray-600" />
                <p className="text-sm font-medium">{txt.tablet}</p>
                <p className="text-xs text-muted-foreground">768px - 1199px</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <Smartphone className="h-8 w-8 mx-auto mb-2 text-gray-600" />
                <p className="text-sm font-medium">{txt.mobile}</p>
                <p className="text-xs text-muted-foreground">&lt; 768px</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            {txt.preview}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden bg-gray-100 p-2">
            <iframe
              src={embedUrl}
              width={width}
              height={`${Math.min(parseInt(height) || 500, 500)}px`}
              frameBorder="0"
              style={{ border: 'none', borderRadius: '8px' }}
              title="Calculator Preview"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {lang === 'ru' ? 'Превью ограничено по высоте. Реальный виджет будет выше.' : 'Podgląd jest ograniczony wysokością. Rzeczywisty widget będzie wyższy.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmbedCodePage;
