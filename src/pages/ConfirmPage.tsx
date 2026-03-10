import { useEffect, useState } from 'react';
import { exchangeCode, startLogin } from '@/features/auth/api';

type ConfirmState = 'loading' | 'failed';

export const ConfirmPage = () => {
  const [state, setState] = useState<ConfirmState>('loading');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      startLogin();
      return;
    }

    const run = async () => {
      try {
        await exchangeCode(code);
        window.location.href = '/';
      } catch {
        setState('failed');
      }
    };

    run();
  }, []);

  if (state === 'failed') {
    return (
      <div className="empty-state">
        인증 처리에 실패했습니다.{' '}
        <button type="button" onClick={startLogin}>
          다시 로그인
        </button>
      </div>
    );
  }

  return <div className="empty-state">인증 처리 중...</div>;
};
