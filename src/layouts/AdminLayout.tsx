import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from '../components/AdminSidebar';
import { useAuth } from '../App';

const AdminLayout: React.FC = () => {
  const { isCollapsed } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex font-sans">
      <AdminSidebar />
      <main
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
