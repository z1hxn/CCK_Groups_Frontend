import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

type PageHeaderAction = {
  label: ReactNode;
  iconSrc?: string;
  iconClassName?: string;
  to?: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  iconSrc?: string;
  containerClassName?: string;
  titleAreaClassName?: string;
  titleTextClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  actions?: PageHeaderAction[];
};

export const PageHeader = ({
  title,
  subtitle,
  icon,
  iconSrc,
  containerClassName = 'comp-header',
  titleAreaClassName = 'page-title-area round-title-area',
  titleTextClassName = 'round-title-text',
  titleClassName = 'page-title',
  subtitleClassName = 'page-title-meta',
  actions = [],
}: PageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className={containerClassName}>
      <div className={titleAreaClassName}>
        {icon ? (
          <div className="page-title-icon" aria-hidden="true">
            {icon}
          </div>
        ) : iconSrc ? (
          <div className="page-title-icon" aria-hidden="true">
            <img src={iconSrc} alt="" loading="lazy" />
          </div>
        ) : null}

        <div className={titleTextClassName}>
          <h1 className={titleClassName}>{title}</h1>
          {subtitle ? <div className={subtitleClassName}>{subtitle}</div> : null}
        </div>
      </div>

      {actions.length > 0 ? (
        <div className="page-actions">
          {actions.map((action, index) => {
            const className = ['page-action-btn', action.className].filter(Boolean).join(' ');
            const iconNode = action.iconSrc ? (
              <img
                className={action.iconClassName ?? 'page-action-icon'}
                src={action.iconSrc}
                alt=""
                aria-hidden="true"
              />
            ) : null;
            const key = `${typeof action.label === 'string' ? action.label : 'action'}-${index}`;

            return (
              <button
                key={key}
                type="button"
                className={className}
                onClick={() => {
                  if (action.disabled) return;
                  if (action.onClick) {
                    action.onClick();
                    return;
                  }
                  if (action.to) {
                    navigate(action.to);
                    return;
                  }
                  if (action.href) {
                    window.location.href = action.href;
                  }
                }}
                disabled={action.disabled}
              >
                {iconNode}
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
