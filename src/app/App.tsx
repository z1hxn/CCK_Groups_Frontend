import { logout } from '@/features/auth/api';
import { AppRoutes } from '@/app/routes';
import './App.css';

export default function App() {
  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  return <AppRoutes onLogoutClick={handleLogout} />;
}
