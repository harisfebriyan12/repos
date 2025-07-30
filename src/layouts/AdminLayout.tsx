import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from '../components/AdminSidebar';
import { useAuth } from '../App';
const AdminLayout: React.FC = () => {
  const { isCollapsed } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 flex font-sans">
      <AdminSidebar />
      <main
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <div className="p-4">
            <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
