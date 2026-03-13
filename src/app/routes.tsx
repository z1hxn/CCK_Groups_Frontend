import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { startLogin } from '@/features/auth/api';
import { AdminCompetitionAutoPage } from '@/pages/admin/AdminCompetitionAutoPage';
import { AdminCompetitionGroupsPage } from '@/pages/admin/AdminCompetitionGroupsPage';
import { AdminCompetitionPage } from '@/pages/admin/AdminCompetitionPage';
import { AdminCompetitionPlayerPage } from '@/pages/admin/AdminCompetitionPlayerPage';
import { AdminCompetitionRoundPage } from '@/pages/admin/AdminCompetitionRoundPage';
import { AdminPage } from '@/pages/admin/AdminPage';
import { ConfirmPage } from '@/pages/ConfirmPage';
import { LogoutPage } from '@/pages/LogoutPage';
import { CompetitionPage } from '@/pages/competition/CompetitionPage';
import { CompetitionPlayerPage } from '@/pages/competition/CompetitionPlayerPage';
import { CompetitionRoundPage } from '@/pages/competition/CompetitionRoundPage';
import { MainPage } from '@/pages/main/MainPage';
import { Header } from '@/widgets/header/Header';

type AppRoutesProps = {
  onLogoutClick: () => void | Promise<void>;
};

const LoginRedirectPage = () => {
  useEffect(() => {
    startLogin();
  }, []);

  return <div className="empty-state">로그인 페이지로 이동 중...</div>;
};

export const AppRoutes = ({ onLogoutClick }: AppRoutesProps) => (
  <BrowserRouter>
    <div className="app-shell">
      <Header onLogoutClick={onLogoutClick} />
      <main className="content-area">
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/competition/:compIdx" element={<AdminCompetitionPage />} />
          <Route path="/admin/competition/:compIdx/groups" element={<AdminCompetitionGroupsPage />} />
          <Route path="/admin/competition/:compIdx/player/:cckId" element={<AdminCompetitionPlayerPage />} />
          <Route path="/admin/competition/:compIdx/round/:roundIdx" element={<AdminCompetitionRoundPage />} />
          <Route path="/admin/competition/:compIdx/groups/player/:cckId" element={<AdminCompetitionPlayerPage />} />
          <Route path="/admin/competition/:compIdx/groups/round/:roundIdx" element={<AdminCompetitionRoundPage />} />
          <Route path="/admin/competition/:compIdx/auto" element={<AdminCompetitionAutoPage />} />
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
  </BrowserRouter>
);
