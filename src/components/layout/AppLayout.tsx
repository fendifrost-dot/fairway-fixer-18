import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { useIsMobile } from '@/hooks/use-mobile';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className={isMobile ? "min-h-screen" : "ml-64 min-h-screen transition-all duration-300"}>
        <div className={isMobile ? "p-4 pt-14" : "p-8"}>
          {children}
        </div>
      </main>
    </div>
  );
}
