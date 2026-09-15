import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSidebar } from '../context/SidebarContext';
import { useI18n } from '../i18n';

interface TopBarProps {
  title: string;
  back?: boolean;
  menu?: boolean;
  action?: ReactNode;
}

export function TopBar({ title, back, menu, action }: TopBarProps) {
  const navigate = useNavigate();
  const { toggle } = useSidebar();
  const { t } = useI18n();

  return (
    <header className="topbar">
      {back ? (
        <button type="button" className="icon-btn" aria-label={t.common.back} onClick={() => navigate(-1)}>
          ‹
        </button>
      ) : menu ? (
        <button type="button" className="icon-btn" aria-label={t.common.openMenu} onClick={toggle}>
          ☰
        </button>
      ) : (
        <span className="icon-btn-spacer" />
      )}
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-action">{action}</div>
    </header>
  );
}
