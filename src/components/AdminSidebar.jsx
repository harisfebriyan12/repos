import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Users, 
  BarChart3, 
  MapPin, 
  LogOut,
  UserPlus,
  Building,
  CreditCard,
  Menu,
  X,
  Database,
  Briefcase,
  Calendar
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

const AdminSidebar = ({ user, profile }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      await window.Swal.fire({
        icon: 'success',
        title: 'Logout Berhasil',
        text: 'Anda telah berhasil logout.'
      });
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const menuItems = [
    {
      title: 'Dashboard',
      icon: <BarChart3 className="h-5 w-5" />,
      path: '/admin',
      active: location.pathname === '/admin'
    },
    {
      title: 'Master Data',
      icon: <Database className="h-5 w-5" />,
      submenu: [
        {
          title: 'Kelola Pengguna',
          icon: <UserPlus className="h-5 w-5" />,
          path: '/admin/users',
          active: location.pathname === '/admin/users'
        },
        {
          title: 'Kelola Departemen',
          icon: <Building className="h-5 w-5" />,
          path: '/admin/departments',
          active: location.pathname === '/admin/departments'
        },
        {
          title: 'Kelola Jabatan',
          icon: <Briefcase className="h-5 w-5" />,
          path: '/admin/positions',
          active: location.pathname === '/admin/positions'
        },
        {
          title: 'Kelola Bank',
          icon: <Database className="h-5 w-5" />,
          path: '/admin/bank',
          active: location.pathname === '/admin/bank'
        }
      ]
    },
    {
      title: 'Kelola Absensi',
      icon: <Calendar className="h-5 w-5" />,
      path: '/admin/attendance',
      active: location.pathname === '/admin/attendance'
    },
    {
      title: 'Kelola Pembayaran',
      icon: <CreditCard className="h-5 w-5" />,
      path: '/admin/salary-payment',
      active: location.pathname === '/admin/salary-payment'
    },
    {
      title: 'Lokasi Kantor',
      icon: <MapPin className="h-5 w-5" />,
      path: '/admin/location',
      active: location.pathname === '/admin/location'
    }
  ];

  const [expandedMenus, setExpandedMenus] = useState(['Master Data']);

  const toggleSubmenu = (title) => {
    setExpandedMenus(prev => 
      prev.includes(title) 
        ? prev.filter(item => item !== title)
        : [...prev, title]
    );
  };

  return (
    <>
      {/* Mobile menu button - always visible */}
      <div className="lg:hidden fixed top-3 left-4 z-50 print:hidden">
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 rounded-lg bg-white shadow-md text-gray-700 hover:bg-gray-100"
        >
          {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      <div 
        className={`lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ${
          isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileOpen(false)}
      ></div>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 bg-white shadow-lg transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-20' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          print:hidden
          w-11/12 max-w-xs lg:w-64
        `}
        style={{ maxWidth: isCollapsed ? '5rem' : undefined }}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-center h-16 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-start px-4'}`}>
              <Building className="h-8 w-8 flex-shrink-0" />
              {!isCollapsed && <span className="ml-2 text-xl font-bold">Admin Panel</span>}
            </div>
          </div>

          {/* User info */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center py-4' : 'px-4 py-4'} border-b border-gray-200`}>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.name} 
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <Users className="h-5 w-5 text-blue-600" />
              )}
            </div>
            {!isCollapsed && (
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-medium text-gray-900 truncate">{profile?.name || 'Admin'}</p>
                <p className="text-xs text-gray-500 truncate">{profile?.email || user?.email}</p>
              </div>
            )}
          </div>

          {/* Menu items */}
          <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            <ul className="space-y-1">
              {menuItems.map((item) => (
                <li key={item.title}>
                  {item.submenu ? (
                    <div>
                      <button
                        onClick={() => toggleSubmenu(item.title)}
                        className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-4'} py-3 text-sm font-medium transition-colors text-gray-700 hover:bg-gray-100`}
                      >
                        <div className="flex items-center">
                          <span className="text-gray-500">{item.icon}</span>
                          {!isCollapsed && <span className="ml-3">{item.title}</span>}
                        </div>
                        {!isCollapsed && (
                          <span className={`transform transition-transform ${expandedMenus.includes(item.title) ? 'rotate-90' : ''}`}>
                            ▶
                          </span>
                        )}
                      </button>
                      {(!isCollapsed && expandedMenus.includes(item.title)) && (
                        <ul className="ml-2 md:ml-4 space-y-1">
                          {item.submenu.map((subItem) => (
                            <li key={subItem.path}>
                              <button
                                onClick={() => {
                                  navigate(subItem.path);
                                  if (window.innerWidth < 1024) setIsMobileOpen(false);
                                }}
                                className={`w-full flex items-center justify-start px-3 md:px-4 py-2 text-sm font-medium transition-colors
                                  ${subItem.active 
                                    ? 'text-blue-700 bg-blue-50 border-r-4 border-blue-500' 
                                    : 'text-gray-600 hover:bg-gray-100'}`}
                              >
                                <span className={`${subItem.active ? 'text-blue-600' : 'text-gray-400'}`}>
                                  {subItem.icon}
                                </span>
                                <span className="ml-3">{subItem.title}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        navigate(item.path);
                        if (window.innerWidth < 1024) setIsMobileOpen(false);
                      }}
                      className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start px-4'} py-3 text-sm font-medium transition-colors
                        ${item.active 
                          ? 'text-blue-700 bg-blue-50 border-r-4 border-blue-500' 
                          : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      <span className={`${item.active ? 'text-blue-600' : 'text-gray-500'}`}>
                        {item.icon}
                      </span>
                      {!isCollapsed && <span className="ml-3">{item.title}</span>}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* Logout button */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} py-2 px-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors`}
            >
              <LogOut className="h-5 w-5" />
              {!isCollapsed && <span className="ml-3">Logout</span>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminSidebar;