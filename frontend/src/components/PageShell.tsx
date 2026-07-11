import React from 'react';
import PageHeader, { type Breadcrumb } from './PageHeader';

interface PageShellProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  /** If true, content area has no padding (for full-bleed layouts) */
  flush?: boolean;
}

export default function PageShell({ title, breadcrumbs, headerActions, children, flush }: PageShellProps) {
  return (
    <>
      <PageHeader title={title} breadcrumbs={breadcrumbs}>
        {headerActions}
      </PageHeader>
      <div className={`page-content ${flush ? '' : 'p-6'}`}>
        <div className="animate-slide-up">
          {children}
        </div>
      </div>
    </>
  );
}
