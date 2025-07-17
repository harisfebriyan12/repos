import Swal from 'sweetalert2';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, Calendar, MapPin, User, LogOut, CheckCircle, XCircle,
  AlertTriangle, BarChart3, Settings, Camera, Edit, DollarSign, 
  TrendingUp, Bell, ChevronLeft, ChevronRight, CalendarDays
} from 'lucide-react';

import { supabase } from '../utils/supabaseClient';
import AttendanceForm from '../components/AttendanceForm';
import NotificationSystem from '../components/NotificationSystem';
import { getCameraVerificationSettings } from '../utils/supabaseClient';
import ReactCalendar from 'react-calendar';
import { format, isToday, isWeekend, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { id } from 'date-fns/locale';
import AttendanceHistory from './AttendanceHistory';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [salaryInfo, setSalaryInfo] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [stats, setStats] = useState({
    thisMonth: 0,
    onTime: 0,
    late: 0,
    totalHours: 0,
    expectedSalary: 0,
    currentMonthSalary: 0,
    dailySalaryEarned: 0
  });
  const [loading, setLoading] = useState(true);
  const [showAttendanceForm, setShowAttendanceForm] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showAttendanceHistory, setShowAttendanceHistory] = useState(false);
  const [cameraVerificationEnabled, setCameraVerificationEnabled] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarAttendance, setCalendarAttendance] = useState({});
  const [showCalendar, setShowCalendar] = useState(false);

  // Memoize expensive calculations
  const isAdmin = useMemo(() => profile?.role === 'admin', [profile?.role]);

  const checkUser = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      setUser(user);
      
      // Update last login
      await supabase
        .from('profiles')
        .update({ 
          last_login: new Date().toISOString(),
          device_info: {
            user_agent: navigator.userAgent,
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', user.id);
      
      // Fetch data in parallel for better performance
      await Promise.all([
        fetchUserProfile(user.id),
        fetchAttendanceData(user.id),
        fetchSalaryInfo(user.id),
        fetchWarnings(user.id),
        fetchCameraSettings()
      ]).then(() => {
        // After fetching data, load calendar data for current month
        if (user) {
          fetchMonthlyAttendance(user.id, currentMonth);
        }
      });
    } catch (error) {
      console.error('Error checking user:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  const fetchUserProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          positions(name_id, department, base_salary)
        `)
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Profile fetch error:', error);
        throw error;
      }

      if (data) {
        setProfile(data);
        
        // Redirect admin to admin panel
        if (data.role === 'admin') {
          navigate('/admin');
          return;
        }
      } else {
        // Create default profile if not exists
        const { data: authUser } = await supabase.auth.getUser();
        if (authUser.user) {
          const defaultProfile = {
            id: userId,
            name: authUser.user.email.split('@')[0],
            full_name: authUser.user.email.split('@')[0],
            email: authUser.user.email,
            role: 'karyawan',
            title: 'Karyawan',
            bio: 'Karyawan sistem absensi',
            department: 'General',
            employee_id: `EMP${Date.now().toString().slice(-6)}`,
            status: 'active',
            salary: 3500000,
            join_date: new Date().toISOString().split('T')[0],
            contract_start_date: new Date().toISOString().split('T')[0],
            contract_type: 'permanent',
            is_face_registered: false
          };

          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert([defaultProfile])
            .select()
            .maybeSingle();
          
          if (!insertError && newProfile) {
            setProfile(newProfile);
          }
        }
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    }
  }, [navigate]);

  const fetchSalaryInfo = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('employee_salaries')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Salary fetch error:', error);
      } else if (data) {
        setSalaryInfo(data);
      }
    } catch (error) {
      console.error('Error fetching salary info:', error);
    }
  }, []);

  const fetchWarnings = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('attendance_warnings')
        .select('*')
        .eq('user_id', userId)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setWarnings(data || []);
    } catch (error) {
      console.error('Error fetching warnings:', error);
    }
  }, []);

  const fetchAttendanceData = useCallback(async (userId) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Check if already checked in/out today
      const [todayResult, recentResult] = await Promise.all([
        supabase
          .from('attendance')
          .select('*')
          .eq('user_id', userId)
          .gte('timestamp', `${today}T00:00:00`)
          .lte('timestamp', `${today}T23:59:59`)
          .order('timestamp', { ascending: false }),
        
        supabase
          .from('attendance')
          .select('*')
          .eq('user_id', userId)
          .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('timestamp', { ascending: false })
          .limit(10)
      ]);

      if (todayResult.error) throw todayResult.error;
      if (recentResult.error) throw recentResult.error;

      setTodayAttendance(todayResult.data || []);
      setRecentAttendance(recentResult.data || []);

      // Calculate stats
      calculateStats(recentResult.data || [], todayResult.data || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  }, []);

  const calculateStats = useCallback((attendanceData, todayData) => {
    const thisMonth = new Date();
    thisMonth.setDate(1);
    
    const monthlyData = attendanceData.filter(record => 
      new Date(record.timestamp) >= thisMonth && record.status === 'berhasil'
    );

    const onTimeData = monthlyData.filter(record => 
      record.type === 'masuk' && !record.is_late
    );

    const lateData = monthlyData.filter(record => 
      record.type === 'masuk' && record.is_late
    );

    const workDays = monthlyData.filter(r => r.type === 'masuk').length;
    
    // Calculate expected salary
    let expectedSalary = 0;
    if (salaryInfo) {
      expectedSalary = salaryInfo.daily_salary * 22;
    } else if (profile?.salary) {
      expectedSalary = profile.salary;
    }

    // Calculate current month salary based on attendance
    const currentMonthSalary = profile?.salary ? (profile.salary / 22 * workDays) : 0;
    
    // Calculate today's earned salary
    const todayEarned = todayData
      .filter(r => r.type === 'masuk' && r.status === 'berhasil')
      .reduce((sum, r) => sum + (r.daily_salary_earned || 0), 0);

    setStats({
      thisMonth: workDays,
      onTime: onTimeData.length,
      late: lateData.length,
      totalHours: Math.round(monthlyData.length * 8 / 2),
      expectedSalary,
      currentMonthSalary,
      dailySalaryEarned: todayEarned
    });
  }, [salaryInfo, profile?.salary]);

  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  }, [navigate]);

  const handleAttendanceSubmitted = useCallback((newRecord) => {
    setTodayAttendance(prev => [newRecord, ...prev]);
    setShowAttendanceForm(false);
    if (user) {
      fetchAttendanceData(user.id);
    }
  }, [user, fetchAttendanceData]);

  const fetchCameraSettings = useCallback(async () => {
    try {
      const settings = await getCameraVerificationSettings();
      setCameraVerificationEnabled(settings.enabled);
    } catch (error) {
      console.error('Error fetching camera settings:', error);
      // Default to enabled if there's an error
      setCameraVerificationEnabled(true);
    }
  }, []);

  const fetchMonthlyAttendance = useCallback(async (userId, date) => {
    try {
      const startDate = startOfMonth(date);
      const endDate = endOfMonth(date);
      
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'berhasil')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;
      
      // Process data for calendar
      const attendanceMap = {};
      data?.forEach(record => {
        const date = record.timestamp.split('T')[0];
        if (!attendanceMap[date]) {
          attendanceMap[date] = [];
        }
        attendanceMap[date].push(record);
      });
      
      setCalendarAttendance(attendanceMap);
    } catch (error) {
      console.error('Error fetching monthly attendance:', error);
    }
  }, []);

  // When month changes in calendar
  const handleMonthChange = useCallback((date) => {
    setCurrentMonth(date);
    if (user) {
      fetchMonthlyAttendance(user.id, date);
    }
  }, [user, fetchMonthlyAttendance]);

  const handleAttendanceClick = useCallback(() => {
    if (cameraVerificationEnabled && !profile?.is_face_registered) {
      // Automatically open the editor if face is not registered
      setShowProfileEditor(true);
      return;
    }

    // Check if already checked in/out today
    const hasCheckedIn = todayAttendance.some(r => r.type === 'masuk' && r.status === 'berhasil');
    const hasCheckedOut = todayAttendance.some(r => r.type === 'keluar' && r.status === 'berhasil');

    if (hasCheckedIn && hasCheckedOut) {
      alert('Anda sudah melakukan absensi masuk dan keluar hari ini.');
      return;
    }

    setShowAttendanceForm(true);
  }, [profile?.is_face_registered, todayAttendance, cameraVerificationEnabled]);

  // Calendar tile content - show attendance status
  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    const dateStr = format(date, 'yyyy-MM-dd');
    const records = calendarAttendance[dateStr] || [];
    const hasCheckIn = records.some(r => r.type === 'masuk');
    const hasCheckOut = records.some(r => r.type === 'keluar');
    if (isWeekend(date)) {
      return (
        <div className="text-xs text-gray-400 mt-1">
          Akhir pekan
        </div>
      );
    }
    if (hasCheckIn && hasCheckOut) {
      return (
        <div className="text-xs text-green-600 mt-1">
          <CheckCircle className="h-3 w-3 inline mr-1" />
          Lengkap
        </div>
      );
    } else if (hasCheckIn) {
      return (
        <div className="text-xs text-orange-500 mt-1">
          <AlertTriangle className="h-3 w-3 inline mr-1" />
          Hanya masuk
        </div>
      );
    } else if (hasCheckOut) {
      // Only check-out, no check-in
      return (
        <div className="text-xs text-blue-500 mt-1">
          <AlertTriangle className="h-3 w-3 inline mr-1" />
          Hanya keluar
        </div>
      );
    } else if (date < new Date() && !isToday(date)) {
      // No attendance at all
      return (
        <div className="text-xs text-red-500 mt-1">
          <XCircle className="h-3 w-3 inline mr-1" />
          Absen
        </div>
      );
    }
    return null;
  };

  // Calendar tile class - style based on attendance
  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return '';
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const records = calendarAttendance[dateStr] || [];
    
    const hasCheckIn = records.some(r => r.type === 'masuk');
    const hasCheckOut = records.some(r => r.type === 'keluar');
    
    if (isWeekend(date)) {
      return 'bg-gray-50';
    }
    
    if (hasCheckIn && hasCheckOut) {
      return 'bg-green-50 border border-green-200';
    } else if (hasCheckIn) {
      return 'bg-orange-50 border border-orange-200';
    } else if (date < new Date() && !isToday(date)) {
      return 'bg-red-50 border border-red-200';
    }
    
    return '';
  };

  // Memoize utility functions
  const getStatusColor = useCallback((status) => {
    switch (status) {
      case 'berhasil':
        return 'text-green-600 bg-green-100';
      case 'wajah_tidak_valid':
        return 'text-red-600 bg-red-100';
      case 'lokasi_tidak_valid':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  }, []);

  const getStatusIcon = useCallback((status) => {
    switch (status) {
      case 'berhasil':
        return <CheckCircle className="h-4 w-4" />;
      case 'wajah_tidak_valid':
      case 'lokasi_tidak_valid':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  }, []);

  const getRoleDisplayName = useCallback((role) => {
    switch (role) {
      case 'karyawan':
        return 'Karyawan';
      case 'admin':
        return 'Administrator';
      default:
        return 'Karyawan';
    }
  }, []);

  const getRoleColor = useCallback((role) => {
    switch (role) {
      case 'admin':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  }, []);

  const getWarningColor = useCallback((level) => {
    switch (level) {
      case 1:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 2:
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 3:
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }, []);

  const formatTime = useCallback((timestamp) => {
    return new Date(timestamp).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const formatDate = useCallback((timestamp) => {
    return new Date(timestamp).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }, []);

  // Check attendance status for today
  const hasCheckedIn = todayAttendance.some(r => r.type === 'masuk' && r.status === 'berhasil');
  const hasCheckedOut = todayAttendance.some(r => r.type === 'keluar' && r.status === 'berhasil');
  const canAttend = !hasCheckedIn || (hasCheckedIn && !hasCheckedOut);

  // Show loading spinner with better UX
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex space-x-1 text-blue-600">
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-gray-600 mt-4">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ...profile card above navbar removed as requested... */}
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="h-6 w-6 text-white" />
              </div>
              <div className="overflow-hidden">
                <h1 className="text-base md:text-xl font-semibold text-gray-900 truncate">
                  {profile?.full_name || profile?.name || 'Karyawan'}
                </h1>
                <div className="hidden md:flex items-center space-x-2 text-xs text-gray-500">
                  <span>{getRoleDisplayName(profile?.role)}</span>
                  {profile?.positions?.name_id && (
                    <span>• {profile.positions.name_id}</span>
                  )}
                  {profile?.employee_id && (
                    <span>• ID: {profile.employee_id}</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <NotificationSystem userId={user?.id} userRole={profile?.role} />
              
              <button
                onClick={() => setShowProfileEditor(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                title="Edit Profil"
              >
                <Edit className="h-5 w-5" />
              </button>
              <button
                onClick={() => setShowAttendanceHistory(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                title="Riwayat Absensi"
              >
                <BarChart3 className="h-5 w-5" />
              </button>
      {/* Attendance History Modal/Section */}
      {showAttendanceHistory && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-5xl mt-24 relative animate-fade-in">
            <button
              onClick={() => setShowAttendanceHistory(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
              title="Tutup Riwayat"
            >
              <XCircle className="h-6 w-6" />
            </button>
            <AttendanceHistory />
          </div>
        </div>
      )}
              <button
                onClick={handleLogout}
                className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-colors"
                title="Keluar"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 overflow-y-auto">
        {/* Profile Warning */}
        {!profile?.is_face_registered && (
          <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200 animate-pulse">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-yellow-800 font-medium">Profil Belum Lengkap</p>
                <p className="text-yellow-700 text-sm mt-1">
                  Anda perlu menambahkan foto wajah untuk dapat melakukan absensi dengan verifikasi wajah.
                </p>
                <button
                  onClick={() => navigate('/profile-setup')}
                  className="mt-2 text-sm text-yellow-800 underline hover:text-yellow-900"
                >
                  Lengkapi Profil Sekarang
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Warnings Alert */}
        {warnings.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200 animate-pulse">
            <div className="flex items-start space-x-3">
              <Bell className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-800 font-medium">Peringatan Aktif ({warnings.length})</p>
                <div className="mt-2 space-y-1">
                  {warnings.slice(0, 2).map((warning) => (
                    <div key={warning.id} className={`text-sm p-2 rounded border ${getWarningColor(warning.warning_level)}`}>
                      <span className="font-medium">SP {warning.warning_level}:</span> {warning.description}
                      {warning.sp_number && <span className="ml-2 text-xs">({warning.sp_number})</span>}
                    </div>
                  ))}
                </div>
                {warnings.length > 2 && (
                  <p className="text-red-600 text-sm mt-1">
                    +{warnings.length - 2} peringatan lainnya
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCardMini icon={Calendar} title="Hadir" value={`${stats.thisMonth} hari`} color="blue" />
          <StatCardMini icon={CheckCircle} title="Tepat Waktu" value={stats.onTime} color="green" />
          <StatCardMini icon={AlertTriangle} title="Terlambat" value={stats.late} color="orange" />
          <StatCardMini icon={DollarSign} title="Jam Kerja" value={`${stats.totalHours} jam`} color="purple" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Today's Attendance and Calendar Toggle */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-medium text-gray-900">Absensi Hari Ini</h2>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {(() => {
                  // Ambil hanya satu absensi masuk dan satu keluar (terbaru) untuk hari ini
                  const masuk = todayAttendance.find(r => r.type === 'masuk' && r.status === 'berhasil');
                  const keluar = todayAttendance.find(r => r.type === 'keluar' && r.status === 'berhasil');
                  if (!masuk && !keluar) {
                    return (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Clock className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500">Belum ada absensi hari ini</p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-4">
                      {masuk && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(masuk.status)}`}> 
                              {getStatusIcon(masuk.status)}
                              <span className="capitalize">Masuk</span>
                            </div>
                            <div>
                              <span className="text-sm text-gray-600">{formatTime(masuk.timestamp)}</span>
                              {masuk.is_late && (
                                <span className="ml-2 text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                                  Terlambat {masuk.late_minutes} menit
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      {keluar && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(keluar.status)}`}> 
                              {getStatusIcon(keluar.status)}
                              <span className="capitalize">Keluar</span>
                            </div>
                            <div>
                              <span className="text-sm text-gray-600">{formatTime(keluar.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Attendance Status */}
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <div className="text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span>Status Absensi:</span>
                            <span className={hasCheckedIn ? 'text-green-600' : 'text-gray-600'}>
                              {hasCheckedIn ? '✓ Sudah Masuk' : '○ Belum Masuk'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span></span>
                            <span className={hasCheckedOut ? 'text-green-600' : 'text-gray-600'}>
                              {hasCheckedOut ? '✓ Sudah Keluar' : '○ Belum Keluar'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {canAttend && (
                  <button
                    onClick={handleAttendanceClick}
                    className="w-full mt-6 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    {!hasCheckedIn ? 'Absen Masuk' : 'Absen Keluar'}
                  </button>
                )}

                {!canAttend && (
                  <div className="w-full mt-6 bg-gray-100 text-gray-500 py-3 px-4 rounded-lg font-medium text-center">
                    Absensi hari ini sudah selesai
                  </div>
                )}
              </div>
            </div>
            
            {/* Calendar View */}
            {showCalendar && (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center space-x-2">
                    <CalendarDays className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-medium text-gray-900">Kalender Absensi</h2>
                  </div>
                </div>
                <div className="p-4">
                  <ReactCalendar
                    onChange={handleMonthChange}
                    value={currentMonth}
                    tileContent={tileContent}
                    tileClassName={tileClassName}
                    locale={id}
                    className="w-full border-0"
                    prevLabel={<ChevronLeft className="h-5 w-5" />}
                    nextLabel={<ChevronRight className="h-5 w-5" />}
                    navigationLabel={({ date }) => (
                      <span className="text-lg font-medium">
                        {format(date, 'MMMM yyyy', { locale: id })}
                      </span>
                    )}
                  />
                  
                  {/* Legend */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2">Keterangan:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-green-50 border border-green-200 mr-2"></div>
                        <span>Absensi Lengkap</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-orange-50 border border-orange-200 mr-2"></div>
                        <span>Hanya Masuk</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-red-50 border border-red-200 mr-2"></div>
                        <span>Tidak Hadir</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-gray-50 mr-2"></div>
                        <span>Akhir Pekan</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-medium text-gray-900">Aktivitas Terbaru</h2>
                </div>
              </div>
              <div className="p-6">
                {recentAttendance.length > 0 ? (
                  <div className="space-y-4">
                    {recentAttendance.map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(record.status)}`}>
                            {getStatusIcon(record.status)}
                            <span className="capitalize">
                              {record.type === 'masuk' ? 'Masuk' : 'Keluar'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {formatTime(record.timestamp)}
                            </p>
                            <p className="text-sm text-gray-600">
                              {formatDate(record.timestamp)}
                            </p>
                            {record.is_late && (
                              <p className="text-xs text-red-600">
                                Terlambat {record.late_minutes} menit
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span>Kantor</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <BarChart3 className="h-8 w-8 text-gray-400" /> 
                    </div>
                    <p className="text-gray-500">Belum ada aktivitas</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showProfileEditor && (
        <ProfileEditor
          user={user}
          profile={profile}
          onClose={() => {
            setShowProfileEditor(false);
            fetchUserProfile(user.id); // Refresh profile data
          }}
        />
      )}

      {/* Attendance Form Modal */}
      {showAttendanceForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="relative">
              <button
                onClick={() => setShowAttendanceForm(false)}
                className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-50"
              >
                <XCircle className="h-6 w-6 text-gray-600" />
              </button>
              <AttendanceForm
                user={{ id: user.id, avatar_url: profile?.avatar_url }}
                onAttendanceSubmitted={handleAttendanceSubmitted}
                todayAttendance={todayAttendance}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

// Reusable Mini Stat Card Component for Mobile
const StatCardMini = ({ icon: Icon, title, value, color }) => {
  const colors = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
  };
  const selectedColor = colors[color] || colors.blue;

  return (
    <div className="bg-white rounded-lg shadow-md p-3 hover:shadow-lg transition-shadow">
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 ${selectedColor.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Icon className={`h-5 w-5 ${selectedColor.text}`} />
        </div>
        <div className="overflow-hidden">
          <p className="text-xs font-medium text-gray-600 truncate">{title}</p>
          <p className="text-base font-bold text-gray-900 truncate">{value}</p>
        </div>
      </div>
    </div>
  );
};
const ProfileEditor = ({ user, profile, onClose }) => {
  const [activeTab, setActiveTab] = useState('face'); // 'face', 'profile', 'bank', 'password'
  const [facePhoto, setFacePhoto] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [banks, setBanks] = useState([]);

  // Form data states
  const [profileData, setProfileData] = useState({
    name: profile?.name || '',
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    location: profile?.location || '',
    bio: profile?.bio || ''
  });
  const [bankData, setBankData] = useState({
    bank_id: profile?.bank_id || '',
    bank_account_number: profile?.bank_account_number || '',
    bank_account_name: profile?.bank_account_name || profile?.full_name || ''
  });
  const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const { data, error } = await supabase.from('bank_info').select('*').eq('is_active', true).order('bank_name');
        if (error) throw error;
        setBanks(data || []);
      } catch (error) {
        console.error('Error fetching banks:', error);
      }
    };
    fetchBanks();
  }, []);

  const handleFaceCapture = (photoBlob) => {
    setFacePhoto(photoBlob);
    setError(null);
  };

  const handleSaveFace = async () => {
    if (!facePhoto) {
      setError('Silakan ambil foto wajah terlebih dahulu');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const fileName = `${user.id}-face-${Date.now()}.jpg`;
      await uploadFile(facePhoto, 'face-photos', fileName);
      const photoUrl = getFileUrl('face-photos', fileName);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: photoUrl, is_face_registered: true, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (updateError) throw updateError;
      setSuccess('Foto wajah berhasil disimpan!');
      setTimeout(onClose, 2000);
    } catch (err) {
      setError(err.message || 'Gagal menyimpan foto wajah.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handler untuk simpan data profil
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      if (updateError) throw updateError;
      await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Profil berhasil diperbarui!' });
      onClose();
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Gagal memperbarui profil.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler untuk simpan data bank
  const handleSaveBank = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          bank_id: bankData.bank_id,
          bank_account_number: bankData.bank_account_number,
          bank_account_name: bankData.bank_account_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      if (updateError) throw updateError;
      await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data bank berhasil diperbarui!' });
      onClose();
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Gagal memperbarui data bank.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler untuk ubah password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Password dan konfirmasi tidak sama.');
      setIsSubmitting(false);
      return;
    }
    try {
      const { error: pwError } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (pwError) throw pwError;
      await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Password berhasil diubah!' });
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Gagal mengubah password.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">Kelola Profil</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <XCircle className="h-6 w-6 text-gray-500" />
          </button>
        </div>
        <div className="flex-grow overflow-y-auto">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              className={`px-4 py-2 text-sm font-medium focus:outline-none ${activeTab === 'profile' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500'}`}
              onClick={() => setActiveTab('profile')}
            >
              Data Profil
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium focus:outline-none ${activeTab === 'bank' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500'}`}
              onClick={() => setActiveTab('bank')}
            >
              Bank
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium focus:outline-none ${activeTab === 'password' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500'}`}
              onClick={() => setActiveTab('password')}
            >
              Ubah Password
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium focus:outline-none ${activeTab === 'face' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500'}`}
              onClick={() => setActiveTab('face')}
            >
              Foto Wajah
            </button>
          </div>
          {/* Tab Content */}
          {activeTab === 'profile' && (
            <form className="p-6 space-y-4 animate-fade-in" onSubmit={handleSaveProfile}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" value={profileData.full_name} onChange={e => setProfileData({ ...profileData, full_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" value={profile?.email || ''} disabled />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" value={profileData.phone} onChange={e => setProfileData({ ...profileData, phone: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">Batal</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          )}
          {activeTab === 'bank' && (
            <form className="p-6 space-y-4 animate-fade-in" onSubmit={handleSaveBank}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Bank</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" value={bankData.bank_id} onChange={e => setBankData({ ...bankData, bank_id: e.target.value })}>
                  <option value="">Pilih Bank</option>
                  {banks.map(bank => (
                    <option key={bank.id} value={bank.id}>{bank.bank_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Rekening</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" value={bankData.bank_account_number} onChange={e => setBankData({ ...bankData, bank_account_number: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pemilik Rekening</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" value={bankData.bank_account_name} onChange={e => setBankData({ ...bankData, bank_account_name: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">Batal</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          )}
          {activeTab === 'password' && (
            <form className="p-6 space-y-4 animate-fade-in" onSubmit={handleChangePassword}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" value={passwordData.newPassword} onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password</label>
                <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" value={passwordData.confirmPassword} onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">Batal</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan'}</button>
          {/* Notifikasi diganti Swal.fire, tidak perlu render di sini */}
              </div>
            </form>
          )}
          {activeTab === 'face' && (
            <div className="p-6 text-gray-500 text-center">Fitur edit foto wajah belum diimplementasikan di modal ini.</div>
          )}
        </div>
      </div>
    </div>
  );
};
