import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Header } from '@/widgets/header/Header.tsx';
import { logout } from '@/features/auth/api';
import { CompetitionPage } from '@/pages/competition/CompetitionPage';
import { ConfirmPage } from '@/pages/ConfirmPage';
import { LogoutPage } from '@/pages/LogoutPage';
import { MainPage } from '@/pages/main/MainPage';
import './App.css';

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
          <Route path="/competition/:compIdx" element={<CompetitionPage />} />
          <Route path="/confirm" element={<ConfirmPage />} />
          <Route path="/logout" element={<LogoutPage />} />
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
