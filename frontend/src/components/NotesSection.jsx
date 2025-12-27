import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { FileText } from 'lucide-react';

export const NotesSection = ({ formData, onChange }) => {
  const { t } = useTranslation();

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          {t('notes')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="notes" className="text-sm font-medium">
            {t('notes')}
          </Label>
          <Textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={onChange}
            placeholder={t('notesPlaceholder')}
            rows={4}
            className="resize-none"
          />
        </div>
      </CardContent>
    </Card>
  );
};
