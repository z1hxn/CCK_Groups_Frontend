import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { Header } from '@/widgets/header/Header.tsx';
import { logout, startLogin } from '@/features/auth/api';
import { AdminCompetitionPage } from '@/pages/admin/AdminCompetitionPage';
import { AdminCompetitionPlayerPage } from '@/pages/admin/AdminCompetitionPlayerPage';
import { AdminPage } from '@/pages/admin/AdminPage';
import { CompetitionPlayerPage } from '@/pages/competition/CompetitionPlayerPage';
import { CompetitionPage } from '@/pages/competition/CompetitionPage';
import { CompetitionRoundPage } from '@/pages/competition/CompetitionRoundPage';
import { ConfirmPage } from '@/pages/ConfirmPage';
import { LogoutPage } from '@/pages/LogoutPage';
import { MainPage } from '@/pages/main/MainPage';
import './App.css';

const LoginRedirectPage = () => {
  useEffect(() => {
    startLogin();
  }, []);
  return <div className="empty-state">로그인 페이지로 이동 중...</div>;
};

function AppShell() {
  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  return (
    <div className="app-shell">
      <Header onLogoutClick={handleLogout} />
      <main className="content-area">
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/competition/:compIdx" element={<AdminCompetitionPage />} />
          <Route path="/admin/competition/:compIdx/player/:cckId" element={<AdminCompetitionPlayerPage />} />
          <Route path="/competition/:compIdx" element={<CompetitionPage />} />
          <Route path="/competition/:compIdx/player/:cckId" element={<CompetitionPlayerPage />} />
          <Route path="/competition/:compIdx/round/:roundIdx" element={<CompetitionRoundPage />} />
          <Route path="/confirm" element={<ConfirmPage />} />
          <Route path="/logout" element={<LogoutPage />} />
          <Route path="/login" element={<LoginRedirectPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
