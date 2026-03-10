import { useEffect } from 'react';
import { logout, startLogin } from '@/features/auth/api';

export const LogoutPage = () => {
  useEffect(() => {
    const run = async () => {
      await logout();
      if (window.location.pathname === '/logout') {
        try {
          startLogin();
        } catch {
          window.location.href = '/';
        }
      }
    };
    run();
  }, []);

  return <div className="empty-state">로그아웃 처리 중...</div>;
};
