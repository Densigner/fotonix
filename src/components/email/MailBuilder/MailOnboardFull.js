import React from 'react';
import { useNavigate } from 'react-router-dom';
import MailBuilderOnboarding from './MailOnboard';

export default function MailOnboardFull() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen w-full bg-white text-black p-6 md:p-8">
      <MailBuilderOnboarding
        open={true}
        onFinish={() => navigate('/?openComposer=1')}
      />
    </div>
  );
}
