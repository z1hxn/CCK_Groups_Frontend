import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { authChangeEvent, getAccessToken, getAuthUserProfile } from '@/shared/auth/tokenStorage.ts';
import { startLogin } from '@/features/auth/api.ts';

type HeaderProps = {
  onLogoutClick: () => void;
};

export const Header = ({ onLogoutClick }: HeaderProps) => {
  const [token, setToken] = useState(getAccessToken());
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const profile = token ? getAuthUserProfile() : null;
  const isLoggedIn = Boolean(token);

  useEffect(() => {
    const sync = () => setToken(getAccessToken());
    window.addEventListener(authChangeEvent, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(authChangeEvent, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  return (
    <header className="header">
      <div className="header-left">
        <Link to="/">
          <img src="/logo/cck-groups-black.png" alt="CCK Groups" className="logo" draggable={false} />
        </Link>
      </div>

      <nav className="header-center">
        <a className="menu" href="https://cubingclub.com" target="_self">
          Main
        </a>
        <a className="menu" href="https://ranking.cubingclub.com" target="_self">
          Ranking
        </a>
        <a className="menu" href="https://payment.cubingclub.com" target="_self">
          Payment
        </a>
        <a className="menu active" target="_self">
          Groups
        </a>
        <a className="menu" href="https://recorder.cubingclub.com" target="_self">
          Recorder
        </a>
      </nav>

      <div className="header-right">
        {!isLoggedIn ? (
          <button className="login-btn" onClick={startLogin}>
            로그인
          </button>
        ) : (
          <div className="header-user-dropdown" ref={menuRef}>
            <button
              type="button"
              className="avatar-btn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <span className="avatar-text">{(profile?.name ?? 'U').slice(0, 1)}</span>
            </button>
            {menuOpen ? (
              <div className="header-user-menu" role="menu">
                <div className="header-user-info">
                  <div className="header-user-info-name">{profile?.name ?? '사용자'}</div>
                  <div className="header-user-info-id">{profile?.cckId || '-'}</div>
                </div>
                <button
                  type="button"
                  className="header-user-menu-item header-user-menu-item--danger"
                  role="menuitem"
                  onClick={onLogoutClick}
                >
                  <img className="btn-left-icon" src="/icon/button/back.svg" alt="" aria-hidden="true" />
                  로그아웃
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </header>
  );
};
