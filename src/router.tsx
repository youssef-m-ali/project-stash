import { createBrowserRouter, Outlet } from 'react-router-dom';
import RootPage from './app/page';
import SetupPage from './app/setup/page';
import AppLayout from './app/(app)/layout';
import DashboardPage from './app/(app)/dashboard/page';
import ReviewPage from './app/(app)/review/page';
import ImportPage from './app/(app)/import/page';
import HistoryPage from './app/(app)/history/page';
import SettingsPage from './app/(app)/settings/page';

function AppLayoutRoute() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootPage />,
  },
  {
    path: '/setup',
    element: <SetupPage />,
  },
  {
    element: <AppLayoutRoute />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/review',    element: <ReviewPage /> },
      { path: '/import',    element: <ImportPage /> },
      { path: '/history',   element: <HistoryPage /> },
      { path: '/settings',  element: <SettingsPage /> },
    ],
  },
]);
