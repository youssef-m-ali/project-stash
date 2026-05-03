import { AppProvider } from '@/lib/context/AppContext';
import { DashboardNav, Sidebar } from '@/components/dashboard/DashboardNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <div className="min-h-screen flex flex-col">
        <DashboardNav />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 min-w-0 px-8 py-8">
            {children}
          </main>
        </div>
      </div>
    </AppProvider>
  );
}
