import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './utils/supabaseClient.ts';
import { Session, User } from '@supabase/supabase-js';

// Layouts
import KaryawanLayout from './layouts/KaryawanLayout';
import AdminLayout from './layouts/AdminLayout';

// Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Karyawan Pages
import DashboardPage from './pages/karyawan/DashboardPage';
import AttendanceHistory from './pages/karyawan/AttendanceHistory';
import ProfileSetup from './pages/karyawan/ProfileSetup';

// Admin Pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import UserManagement from './pages/admin/UserManagement';
import SalaryPaymentManagement from './pages/admin/SalaryPaymentManagement';
import DepartmentManagement from './pages/admin/DepartmentManagement';
import PositionManagement from './pages/admin/PositionManagement';
import LocationSettings from './pages/admin/LocationSettings';
import BankManagement from './pages/admin/BankManagement';
import AttendanceManagement from './pages/admin/AttendanceManagement';

// Components
import ProtectedRoute from './components/auth/ProtectedRoute';
import { LanguageProvider } from './utils/languageContext';
import { Profile } from './types';

// Auth Context
interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const setData = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Error getting session:", error);
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (error) {
          console.error("Error fetching profile:", error);
        } else {
          setProfile(data);
        }
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error) {
          console.error("Error fetching profile on auth state change:", error);
          setProfile(null);
        } else {
          setProfile(data);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    // Initial load is handled by onAuthStateChange, so we can remove the explicit setData() call.

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user,
    profile,
    loading,
    isCollapsed,
    setIsCollapsed,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

function App() {
  return (
    <LanguageProvider>
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </LanguageProvider>
  );
}

function AppRoutes() {
  const { loading, session, profile } = useAuth();

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
    <Routes>
      <Route path="/login" element={!session ? <Login /> : <Navigate to={profile?.role === 'admin' ? '/admin' : '/dashboard'} replace />} />
      <Route path="/register" element={!session ? <Register /> : <Navigate to={profile?.role === 'admin' ? '/admin' : '/dashboard'} replace />} />

      <Route element={<ProtectedRoute isAllowed={!!session && profile?.role === 'karyawan'} redirectTo="/login" />}>
        <Route element={<KaryawanLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/history" element={<AttendanceHistory />} />
          <Route path="/profile-setup" element={<ProfileSetup />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute isAllowed={!!session && profile?.role === 'admin'} redirectTo="/dashboard" />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/departments" element={<DepartmentManagement />} />
          <Route path="/admin/positions" element={<PositionManagement />} />
          <Route path="/admin/salary-payment" element={<SalaryPaymentManagement />} />
          <Route path="/admin/location" element={<LocationSettings />} />
          <Route path="/admin/bank" element={<BankManagement />} />
          <Route path="/admin/attendance" element={<AttendanceManagement />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to={!session ? '/login' : profile?.role === 'admin' ? '/admin' : '/dashboard'} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;