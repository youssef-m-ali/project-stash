import { AppProvider } from '@/lib/context/AppContext';
import { DashboardNav } from '@/components/dashboard/DashboardNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <div className="min-h-screen flex flex-col">
        <DashboardNav />
        <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">
          {children}
        </main>
      </div>
    </AppProvider>
  );
}
