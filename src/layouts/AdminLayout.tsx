import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from '../components/AdminSidebar';
import { User, Profile } from '../types';

interface AdminLayoutProps {
  user: User | null;
  profile: Profile | null;
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
}

const AdminLayout = ({ user, profile, isCollapsed, setIsCollapsed }: AdminLayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex font-sans">
      <AdminSidebar
        user={user}
        profile={profile}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />
      <div
        className={`flex-1 transition-all duration-300 ease-in-out
          ${isCollapsed ? 'lg:ml-20' : 'lg:ml-64'}
          pt-16 lg:pt-0`}
      >
        <Outlet />
      </div>
    </div>
  );
};

export default AdminLayout;
