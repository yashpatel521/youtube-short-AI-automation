import React from 'react';
import { useNavigate } from 'react-router-dom';

export interface Breadcrumb {
  label: string;
  path?: string;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
  children?: React.ReactNode;
}

export default function PageHeader({ title, breadcrumbs, children }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="page-header">
      {/* Left: Breadcrumbs + Title */}
      <div className="flex items-center gap-3 min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="breadcrumb-sep">/</span>}
                {crumb.path ? (
                  <span
                    className="breadcrumb-item"
                    onClick={() => navigate(crumb.path!)}
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <span className="breadcrumb-current truncate max-w-[200px]">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        ) : (
          <h1 className="text-base font-bold text-white truncate">{title}</h1>
        )}
      </div>

      {/* Right: Actions slot */}
      {children && (
        <div className="flex items-center gap-2 shrink-0">
          {children}
        </div>
      )}
    </div>
  );
}
