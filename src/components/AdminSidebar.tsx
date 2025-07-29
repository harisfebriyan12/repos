import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Users,
  BarChart3,
  LogOut,
  Building,
  CreditCard,
  Menu,
  X,
  Database,
  Briefcase,
  CalendarClock,
  ChevronLeft,
  Settings,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../App'; // Import useAuth

const AdminSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, isCollapsed, setIsCollapsed } = useAuth(); // Gunakan useAuth
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState(['Kelola']);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setIsMobileOpen(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      // SweetAlert is not available on window, so we'll just navigate
      navigate('/login');
    } catch (error) {
      console.error('Logout gagal:', error);
    }
  };

  const toggleSubmenu = (title) => {
    setExpandedMenus((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  const handleMobileToggle = () => setIsMobileOpen(!isMobileOpen);
  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) setIsMobileOpen(false);
  };

  const menuItems = [
    {
      title: 'Dashboard',
      icon: <BarChart3 className="h-5 w-5" />,
      path: '/admin',
      active: location.pathname === '/admin',
    },
    {
      title: 'Kelola',
      icon: <Database className="h-5 w-5" />,
      submenu: [
        { title: 'Kelola Pengguna', icon: <Users className="h-5 w-5" />, path: '/admin/users' },
        { title: 'Kelola Departemen', icon: <Building className="h-5 w-5" />, path: '/admin/departments' },
        { title: 'Kelola Jabatan', icon: <Briefcase className="h-5 w-5" />, path: '/admin/positions' },
        { title: 'Kelola Bank', icon: <CreditCard className="h-5 w-5" />, path: '/admin/bank' },
        { title: 'Kelola Absensi', icon: <CalendarClock className="h-5 w-5" />, path: '/admin/attendance' },
        { title: 'Kelola Pembayaran', icon: <CreditCard className="h-5 w-5" />, path: '/admin/salary-payment' },
      ],
    },
    {
      title: 'Pengaturan Sistem',
      icon: <Settings className="h-5 w-5" />,
      path: '/admin/location',
      active: location.pathname === '/admin/location',
    },
  ];

  return (
    <>
      {/* FAB untuk mobile */}
      {isMobile && (
        <button
          onClick={handleMobileToggle}
          className="fixed bottom-5 right-5 z-50 p-3 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition"
        >
          {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 bg-white border-r shadow-md transition-all duration-300
          ${isCollapsed && !isMobile ? 'w-16' : 'w-64'}
          ${isMobile ? (isMobileOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-16 bg-gradient-to-r from-blue-700 to-indigo-600 text-white">
            {!isCollapsed && <span className="font-semibold text-lg truncate">Admin Panel</span>}
            {!isMobile && (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1 hover:bg-blue-800 rounded transition"
              >
                <ChevronLeft className={`h-5 w-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>

          {/* Profil */}
          <div className="flex items-center gap-3 px-4 py-4 border-b bg-gray-50">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <Users className="h-6 w-6 text-blue-600" />
              )}
            </div>
            {!isCollapsed && (
              <div className="truncate">
                <p className="text-sm font-medium text-gray-900">{profile?.name || 'Admin'}</p>
                <p className="text-xs text-gray-500">{profile?.email || user?.email}</p>
              </div>
            )}
          </div>

          {/* Menu */}
          <nav className="flex-1 overflow-y-auto py-4 px-2">
            <ul className="space-y-1">
              {menuItems.map((item) => (
                <li key={item.title}>
                  {item.submenu ? (
                    <>
                      <button
                        onClick={() => toggleSubmenu(item.title)}
                        className={`w-full flex items-center justify-between px-3 py-3 text-sm rounded-lg transition
                          ${expandedMenus.includes(item.title)
                            ? 'bg-blue-50 text-blue-600'
                            : 'hover:bg-gray-100 text-gray-700'}`}
                      >
                        <div className="flex items-center gap-3">
                          {item.icon}
                          {!isCollapsed && <span>{item.title}</span>}
                        </div>
                        {!isCollapsed && (
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              expandedMenus.includes(item.title) ? 'rotate-180' : ''
                            }`}
                          />
                        )}
                      </button>
                      <div
                        className={`overflow-hidden transition-all duration-300 ${
                          expandedMenus.includes(item.title) ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <ul className="ml-5 mt-1 space-y-1 border-l pl-4 border-gray-200">
                          {item.submenu.map((sub) => (
                            <li key={sub.path}>
                              <button
                                onClick={() => handleNavigation(sub.path)}
                                className={`flex w-full items-center gap-3 px-3 py-2 text-sm rounded-md transition
                                  ${location.pathname === sub.path
                                    ? 'bg-blue-50 text-blue-600 font-semibold'
                                    : 'text-gray-600 hover:bg-gray-100'}
                                `}
                              >
                                {sub.icon}
                                {!isCollapsed && <span>{sub.title}</span>}
                                {location.pathname === sub.path && !isCollapsed && (
                                  <ChevronRight className="ml-auto h-4 w-4 text-blue-500" />
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => handleNavigation(item.path)}
                      className={`flex w-full items-center gap-3 px-3 py-3 text-sm rounded-lg transition
                        ${item.active ? 'bg-blue-50 text-blue-600 font-medium' : 'hover:bg-gray-100 text-gray-700'}
                      `}
                    >
                      {item.icon}
                      {!isCollapsed && <span>{item.title}</span>}
                      {item.active && !isCollapsed && <ChevronRight className="ml-auto h-4 w-4 text-blue-500" />}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* Logout */}
          <div className="p-3 border-t">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 text-sm text-red-600 rounded-lg hover:bg-red-50 transition"
            >
              <LogOut className="h-5 w-5" />
              {!isCollapsed && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay untuk mobile */}
      {isMobile && isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={handleMobileToggle}
          aria-hidden="true"
        />
      )}
    </>
  );
};

export default AdminSidebar;