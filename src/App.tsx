import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from './utils/supabaseClient';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardPage from './pages/DashboardPage';
import AttendanceHistory from './pages/AttendanceHistory';
import AdminDashboardPage from './pages/AdminDashboardPage';
import KaryawanLayout from './layouts/KaryawanLayout';
import AdminLayout from './layouts/AdminLayout';
import UserManagement from './pages/UserManagement';
import SalaryPaymentManagement from './pages/SalaryPaymentManagement';
import DepartmentManagement from './pages/DepartmentManagement';
import PositionManagement from './pages/PositionManagement';
import ProfileSetup from './pages/ProfileSetup';
import LocationSettings from './pages/LocationSettings';
import BankManagement from './pages/BankManagement';
import AttendanceManagementByDate from './pages/AttendanceManagementByDate';
import { LanguageProvider } from './utils/languageContext';

function App() {
  return (
    <LanguageProvider>
      <div className="flex flex-col min-h-screen">
        <Router>
          <AppContent />
        </Router>
      </div>
    </LanguageProvider>
  );
}

import { User, Profile } from './types';

function AppContent() {
  const [session, setSession] = useState<{ user: User } | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<Profile['role'] | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Dapatkan session awal dengan error handling
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Jika ada error (seperti user_not_found), clear session
        console.error('Session error:', error);
        supabase.auth.signOut();
        setSession(null);
      } else {
        setSession(session);
        
        // Fetch user role if session exists
        if (session) {
          fetchUserRole(session.user.id);
        }
      }
      setLoading(false);
    }).catch((error) => {
      // Handle any unexpected errors
      console.error('Unexpected session error:', error);
      supabase.auth.signOut();
      setSession(null);
      setLoading(false);
    });

    // Dengarkan perubahan auth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      
      // Fetch user role when session changes
      if (session) {
        fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle 404s by redirecting to home page
  useEffect(() => {
    // Check if the current path doesn't match any of our routes
    const validPaths = [
      '/login', '/register', '/dashboard', '/profile-setup', 
      '/history', '/admin', '/admin/users', '/admin/departments', 
      '/admin/positions', '/admin/salary-payment', '/admin/location', 
      '/admin/bank', '/admin/attendance', '/'
    ];
    
    const isValidPath = validPaths.some(path => {
      // Check if current path starts with this valid path
      return location.pathname === path || 
             (path !== '/' && location.pathname.startsWith(path + '/'));
    });
    
    if (!isValidPath && !loading) {
      // Redirect to appropriate page based on user role
      if (!session) {
        navigate('/login');
      } else if (userRole === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    }
  }, [location.pathname, loading, session, userRole, navigate]);

  const fetchUserRole = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      setUserRole(data.role);
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex space-x-1 text-blue-600">
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-gray-600 mt-4">Memuat aplikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <Routes>
        <Route 
          path="/login" 
          element={!session ? <Login /> : (userRole === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/dashboard" replace />)} 
        />
        <Route 
          path="/register" 
          element={!session ? <Register /> : (userRole === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/dashboard" replace />)} 
        />
        <Route element={<KaryawanLayout />}>
          <Route
            path="/dashboard"
            element={session ? (userRole === 'admin' ? <Navigate to="/admin" replace /> : <DashboardPage />) : <Navigate to="/login" replace />}
          />
        </Route>
        <Route 
          path="/profile-setup" 
          element={session ? <ProfileSetup /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/history" 
          element={session ? <AttendanceHistory /> : <Navigate to="/login" replace />} 
        />
        <Route element={<AdminLayout session={session} userRole={userRole} isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />}>
          <Route
            path="/admin"
            element={session && userRole === 'admin' ? <AdminDashboardPage /> : <Navigate to={session ? "/dashboard" : "/login"} replace />}
          />
        </Route>
        <Route 
          path="/admin/users" 
          element={session && userRole === 'admin' ? <UserManagement /> : <Navigate to={session ? "/dashboard" : "/login"} replace />} 
        />
        <Route 
          path="/admin/departments" 
          element={session && userRole === 'admin' ? <DepartmentManagement /> : <Navigate to={session ? "/dashboard" : "/login"} replace />} 
        />
        <Route 
          path="/admin/positions" 
          element={session && userRole === 'admin' ? <PositionManagement /> : <Navigate to={session ? "/dashboard" : "/login"} replace />} 
        />
        <Route 
          path="/admin/salary-payment" 
          element={session && userRole === 'admin' ? <SalaryPaymentManagement /> : <Navigate to={session ? "/dashboard" : "/login"} replace />} 
        />
        <Route 
          path="/admin/location" 
          element={session && userRole === 'admin' ? <LocationSettings /> : <Navigate to={session ? "/dashboard" : "/login"} replace />} 
        />
        <Route 
          path="/admin/bank" 
          element={session && userRole === 'admin' ? <BankManagement /> : <Navigate to={session ? "/dashboard" : "/login"} replace />} 
        />
        <Route 
          path="/admin/attendance" 
          element={session && userRole === 'admin' ? <AttendanceManagementByDate /> : <Navigate to={session ? "/dashboard" : "/login"} replace />} 
        />
        <Route 
          path="/" 
          element={
            !session ? <Navigate to="/login" replace /> : 
            userRole === 'admin' ? <Navigate to="/admin" replace /> : 
            <Navigate to="/dashboard" replace />
          } 
        />
        {/* Catch-all route to handle 404s */}
        <Route 
          path="*" 
          element={
            !session ? <Navigate to="/login" replace /> : 
            userRole === 'admin' ? <Navigate to="/admin" replace /> : 
            <Navigate to="/dashboard" replace />
          } 
        />
      </Routes>
    </div>
  );
}

export default App;