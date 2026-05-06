import React, { useState, useEffect } from 'react';
import i18n from 'i18next';
import DealerLogin from './DealerLogin';
import DealerApp from './DealerApp';
import { getDealerToken } from '../../utils/dealerAuth';

export default function DealerEntry() {
  const [authed, setAuthed] = useState(!!getDealerToken());

  // Dealer portal is Polish-only — force i18n into 'pl' so the embedded
  // SaunaCalculator renders Polish copy/labels.
  useEffect(() => {
    if (i18n.language !== 'pl') {
      try { i18n.changeLanguage('pl'); } catch (_e) { /* ignore */ }
    }
  }, []);

  if (!authed) return <DealerLogin onSuccess={() => setAuthed(true)} />;
  return <DealerApp />;
}
