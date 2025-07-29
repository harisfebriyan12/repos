import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from '../components/AdminSidebar';
import { useAuth } from '../App';
import ThemeSwitcher from '../components/ThemeSwitcher';

const AdminLayout: React.FC = () => {
  const { isCollapsed } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 flex font-sans">
      <AdminSidebar />
      <main
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <div className="p-4">
            <div className="flex justify-end">
                <ThemeSwitcher />
            </div>
            <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
