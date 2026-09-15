import { NavLink } from 'react-router-dom';
import { useSidebar } from '../context/SidebarContext';
import { useAuth } from '../context/AuthContext';
import { useI18n, LANGS } from '../i18n';

export function Sidebar() {
  const { isOpen, close } = useSidebar();
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useI18n();

  const modules = [
    { to: '/treino', label: t.nav.workouts, icon: '🏋' },
    { to: '/calendario', label: t.nav.calendar, icon: '📅' },
    { to: '/muscle-use', label: t.nav.muscleUse, icon: '💪' },
  ];

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={close} aria-hidden="true" />}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
        <div className="sidebar-header">
          <img className="sidebar-logo" src="/logo.png" alt="" width={40} height={40} />
          <div className="sidebar-brand">
            <span className="sidebar-title">{t.app.name}</span>
            {user && <span className="sidebar-user">{user.name}</span>}
          </div>
        </div>

        <nav className="sidebar-nav">
          {modules.map((mod) => (
            <NavLink
              key={mod.to}
              to={mod.to}
              onClick={close}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon" aria-hidden="true">
                {mod.icon}
              </span>
              {mod.label}
            </NavLink>
          ))}
        </nav>

        {/* A segmented control rather than a flag: a flag maps a language onto a country and
            gets it wrong (English is not the UK). "PT"/"EN" read the same in both languages
            and therefore need no translation (spec 004 §9.4). */}
        <div className="sidebar-lang" role="radiogroup" aria-label={t.common.language}>
          {LANGS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={lang === option}
              className={`sidebar-lang-option ${lang === option ? 'active' : ''}`}
              onClick={() => setLang(option)}
            >
              {option.toUpperCase()}
            </button>
          ))}
        </div>

        <button type="button" className="sidebar-logout" onClick={() => logout()}>
          {t.common.logout}
        </button>
      </aside>
    </>
  );
}
