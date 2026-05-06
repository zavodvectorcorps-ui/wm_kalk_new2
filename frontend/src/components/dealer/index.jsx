import React, { useState } from 'react';
import DealerLogin from './DealerLogin';
import DealerApp from './DealerApp';
import { getDealerToken } from '../../utils/dealerAuth';

export default function DealerEntry() {
  const [authed, setAuthed] = useState(!!getDealerToken());
  if (!authed) return <DealerLogin onSuccess={() => setAuthed(true)} />;
  return <DealerApp />;
}
