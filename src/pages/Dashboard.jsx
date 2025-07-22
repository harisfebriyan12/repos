import Swal from 'sweetalert2';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, Calendar, MapPin, User, LogOut, CheckCircle, XCircle,
  AlertTriangle, Settings, Camera, Edit, DollarSign, 
  Bell, ChevronLeft, ChevronRight, CalendarDays, CreditCard
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import AttendanceForm from '../components/AttendanceForm';
import NotificationSystem from '../components/NotificationSystem';
import { getCameraVerificationSettings } from '../utils/supabaseClient';
import ReactCalendar from 'react-calendar';
import { format, isToday, isWeekend, startOfMonth, endOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import AttendanceHistory from './AttendanceHistory';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState([]);
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
  const [showCalendar, setShowCalendar] = useState(true);
  const [bankInfo, setBankInfo] = useState(null);

  const isAdmin = useMemo(() => profile?.role === 'admin', [profile?.role]);

  const checkUser = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      setUser(user);
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
      await Promise.all([
        fetchUserProfile(user.id),
        fetchAttendanceData(user.id),
        fetchSalaryInfo(user.id),
        fetchWarnings(user.id),
        fetchCameraSettings(),
        fetchBankInfo(user.id)
      ]).then(() => {
        if (user) fetchMonthlyAttendance(user.id, currentMonth);
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
      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setProfile(data);
        if (data.role === 'admin') navigate('/admin');
      } else {
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
          if (!insertError && newProfile) setProfile(newProfile);
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
      if (error && error.code !== 'PGRST116') console.error('Salary fetch error:', error);
      else if (data) setSalaryInfo(data);
    } catch (error) {
      console.error('Error fetching salary info:', error);
    }
  }, []);

  const fetchBankInfo = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          bank_id,
          bank_account_number,
          bank_account_name,
          bank_info(bank_name)
        `)
        .eq('id', userId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      setBankInfo(data);
    } catch (error) {
      console.error('Error fetching bank info:', error);
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
      const { data: todayData, error: todayError } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', `${today}T00:00:00`)
        .lte('timestamp', `${today}T23:59:59`)
        .order('timestamp', { ascending: false });
      if (todayError) throw todayError;
      setTodayAttendance(todayData || []);
      calculateStats(todayData || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  }, []);

  const calculateStats = useCallback((todayData) => {
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const monthlyData = todayData.filter(record => 
      new Date(record.timestamp) >= thisMonth && record.status === 'berhasil'
    );
    const onTimeData = monthlyData.filter(record => 
      record.type === 'masuk' && !record.is_late
    );
    const lateData = monthlyData.filter(record => 
      record.type === 'masuk' && record.is_late
    );
    const workDays = monthlyData.filter(r => r.type === 'masuk').length;
    let expectedSalary = salaryInfo ? salaryInfo.daily_salary * 22 : profile?.salary || 0;
    const currentMonthSalary = profile?.salary ? (profile.salary / 22 * workDays) : 0;
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
    if (user) fetchAttendanceData(user.id);
  }, [user, fetchAttendanceData]);

  const fetchCameraSettings = useCallback(async () => {
    try {
      const settings = await getCameraVerificationSettings();
      setCameraVerificationEnabled(settings.enabled);
    } catch (error) {
      console.error('Error fetching camera settings:', error);
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
      const attendanceMap = {};
      data?.forEach(record => {
        const dateStr = format(new Date(record.timestamp), 'yyyy-MM-dd');
        if (!attendanceMap[dateStr]) attendanceMap[dateStr] = [];
        attendanceMap[dateStr].push(record);
      });
      setCalendarAttendance(attendanceMap);
    } catch (error) {
      console.error('Error fetching monthly attendance:', error);
    }
  }, []);

  const handleMonthChange = useCallback((date) => {
    setCurrentMonth(date);
    if (user) fetchMonthlyAttendance(user.id, date);
  }, [user, fetchMonthlyAttendance]);

  const handleAttendanceClick = useCallback(() => {
    if (cameraVerificationEnabled && !profile?.is_face_registered) {
      setShowProfileEditor(true);
      return;
    }
    const hasCheckedIn = todayAttendance.some(r => r.type === 'masuk' && r.status === 'berhasil');
    const hasCheckedOut = todayAttendance.some(r => r.type === 'keluar' && r.status === 'berhasil');
    if (hasCheckedIn && hasCheckedOut) {
      Swal.fire({
        icon: 'info',
        title: 'Informasi',
        text: 'Anda sudah melakukan absensi masuk dan keluar hari ini.',
      });
      return;
    }
    setShowAttendanceForm(true);
  }, [profile?.is_face_registered, todayAttendance, cameraVerificationEnabled]);

  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    const dateStr = format(date, 'yyyy-MM-dd');
    const records = calendarAttendance[dateStr] || [];
    const hasCheckIn = records.some(r => r.type === 'masuk');
    const hasCheckOut = records.some(r => r.type === 'keluar');
    if (isWeekend(date)) {
      return <div className="text-[0.65rem] text-gray-400 mt-1">Akhir pekan</div>;
    }
    if (hasCheckIn && hasCheckOut) {
      return (
        <div className="text-[0.65rem] text-green-600 mt-1">
          <CheckCircle className="h-2.5 w-2.5 inline mr-0.5" />
          Lengkap
        </div>
      );
    } else if (hasCheckIn) {
      return (
        <div className="text-[0.65rem] text-orange-500 mt-1">
          <AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />
          Hanya masuk
        </div>
      );
    } else if (hasCheckOut) {
      return (
        <div className="text-[0.65rem] text-blue-500 mt-1">
          <AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />
          Hanya keluar
        </div>
      );
    } else if (date < new Date() && !isToday(date)) {
      return (
        <div className="text-[0.65rem] text-red-500 mt-1">
          <XCircle className="h-2.5 w-2.5 inline mr-0.5" />
          Absen
        </div>
      );
    }
    return null;
  };

  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return '';
    const dateStr = format(date, 'yyyy-MM-dd');
    const records = calendarAttendance[dateStr] || [];
    const hasCheckIn = records.some(r => r.type === 'masuk');
    const hasCheckOut = records.some(r => r.type === 'keluar');
    if (isWeekend(date)) return 'bg-gray-50';
    if (hasCheckIn && hasCheckOut) return 'bg-green-50 border border-green-200';
    if (hasCheckIn) return 'bg-orange-50 border border-orange-200';
    if (date < new Date() && !isToday(date)) return 'bg-red-50 border border-red-200';
    return '';
  };

  const getStatusColor = useCallback((status) => {
    switch (status) {
      case 'berhasil': return 'text-green-600 bg-green-100';
      case 'wajah_tidak_valid': return 'text-red-600 bg-red-100';
      case 'lokasi_tidak_valid': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }, []);

  const getStatusIcon = useCallback((status) => {
    switch (status) {
      case 'berhasil': return <CheckCircle className="h-4 w-4" />;
      case 'wajah_tidak_valid':
      case 'lokasi_tidak_valid': return <XCircle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  }, []);

  const getRoleDisplayName = useCallback((role) => {
    switch (role) {
      case 'karyawan': return 'Karyawan';
      case 'admin': return 'Administrator';
      default: return 'Karyawan';
    }
  }, []);

  const getWarningColor = useCallback((level) => {
    switch (level) {
      case 1: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 2: return 'bg-orange-100 text-orange-800 border-orange-200';
      case 3: return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }, []);

  const formatTime = useCallback((timestamp) => {
    return new Date(timestamp).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  }, []);

  const hasCheckedIn = todayAttendance.some(r => r.type === 'masuk' && r.status === 'berhasil');
  const hasCheckedOut = todayAttendance.some(r => r.type === 'keluar' && r.status === 'berhasil');
  const canAttend = !hasCheckedIn || (hasCheckedIn && !hasCheckedOut);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex space-x-1 text-blue-600">
            <div className="w-3 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-gray-600 mt-4 text-sm font-medium">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-200 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-lg border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                <User className="h-6 w-6 text-white" />
              </div>
              <div className="overflow-hidden">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                  {profile?.full_name || profile?.name || 'Karyawan'}
                </h1>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span className="font-medium">{getRoleDisplayName(profile?.role)}</span>
                  {profile?.positions?.name_id && (
                    <span className="hidden sm:inline">• {profile.positions.name_id}</span>
                  )}
                  {profile?.employee_id && (
                    <span className="hidden sm:inline">• ID: {profile.employee_id}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <NotificationSystem userId={user?.id} userRole={profile?.role} />
              <button
                onClick={() => setShowProfileEditor(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors duration-300 hover:shadow-md"
                title="Edit Profil"
              >
                <Edit className="h-5 w-5" />
              </button>
              <button
                onClick={() => setShowAttendanceHistory(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors duration-300 hover:shadow-md"
                title="Riwayat Absensi"
              >
                <CalendarDays className="h-5 w-5" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-colors duration-300 hover:shadow-md"
                title="Keluar"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Profile Warning */}
        {!profile?.is_face_registered && (
          <div className="mb-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200 shadow-lg animate-pulse">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-yellow-800 font-semibold text-sm">Profil Belum Lengkap</p>
                <p className="text-yellow-700 text-sm mt-1">
                  Tambahkan foto wajah untuk absensi dengan verifikasi wajah.
                </p>
                <button
                  onClick={() => setShowProfileEditor(true)}
                  className="mt-2 text-sm text-yellow-800 underline hover:text-yellow-900 font-medium"
                >
                  Lengkapi Profil Sekarang
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Warnings Alert */}
        {warnings.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 rounded-xl border border-red-200 shadow-lg animate-pulse">
            <div className="flex items-start space-x-3">
              <Bell className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-800 font-semibold text-sm">Peringatan Aktif ({warnings.length})</p>
                <div className="mt-2 space-y-2">
                  {warnings.slice(0, 2).map((warning) => (
                    <div key={warning.id} className={`text-xs p-3 rounded-lg border ${getWarningColor(warning.warning_level)} shadow-sm`}>
                      <span className="font-medium">SP {warning.warning_level}:</span> {warning.description}
                      {warning.sp_number && <span className="ml-2 text-[0.65rem]">({warning.sp_number})</span>}
                    </div>
                  ))}
                </div>
                {warnings.length > 2 && (
                  <p className="text-red-600 text-xs mt-2 font-medium">
                    +{warnings.length - 2} peringatan lainnya
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCardMini icon={Calendar} title="Hadir" value={`${stats.thisMonth} hari`} color="blue" />
          <StatCardMini icon={CheckCircle} title="Tepat Waktu" value={stats.onTime} color="green" />
          <StatCardMini icon={AlertTriangle} title="Terlambat" value={stats.late} color="orange" />
          <StatCardMini icon={DollarSign} title="Jam Kerja" value={`${stats.totalHours} jam`} color="purple" />
        </div>

        {/* Bank Info Card */}
        <div className="mb-6 bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-xl shadow-xl p-6 transform hover:scale-[1.01] transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white bg-opacity-20 p-3 rounded-full">
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Informasi Bank</h3>
                <p className="text-sm opacity-80">
                  {bankInfo?.bank_info?.bank_name || 'Belum ada bank terdaftar'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowProfileEditor(true)}
              className="text-white bg-white bg-opacity-20 hover:bg-opacity-30 p-2 rounded-lg transition-colors duration-200"
              title="Edit Bank"
            >
              <Edit className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs opacity-80">Nomor Rekening</p>
              <p className="text-sm font-medium">{bankInfo?.bank_account_number || '-'}</p>
            </div>
            <div>
              <p className="text-xs opacity-80">Nama Pemilik</p>
              <p className="text-sm font-medium">{bankInfo?.bank_account_name || '-'}</p>
            </div>
          </div>
        </div>

        {/* Today's Attendance and Calendar */}
        <div className="bg-white rounded-xl shadow-xl p-6 mb-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Absensi Hari Ini</h2>
            </div>
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {showCalendar ? 'Sembunyikan Kalender' : 'Tampilkan Kalender'}
            </button>
          </div>
          <div className="space-y-4">
            {(() => {
              const masuk = todayAttendance.find(r => r.type === 'masuk' && r.status === 'berhasil');
              const keluar = todayAttendance.find(r => r.type === 'keluar' && r.status === 'berhasil');
              if (!masuk && !keluar) {
                return (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clock className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-sm font-medium">Belum ada absensi hari ini</p>
                  </div>
                );
              }
              return (
                <div className="space-y-3">
                  {masuk && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg shadow-sm hover:bg-gray-100 transition-colors duration-200">
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
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg shadow-sm hover:bg-gray-100 transition-colors duration-200">
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
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg shadow-sm">
                    <div className="text-sm grid grid-cols-2 gap-2">
                      <div className="flex items-center justify-between">
                        <span>Masuk:</span>
                        <span className={hasCheckedIn ? 'text-green-600' : 'text-gray-600'}>
                          {hasCheckedIn ? '✓ Sudah' : '○ Belum'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Keluar:</span>
                        <span className={hasCheckedOut ? 'text-green-600' : 'text-gray-600'}>
                          {hasCheckedOut ? '✓ Sudah' : '○ Belum'}
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
                className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-[1.02] shadow-md"
              >
                {!hasCheckedIn ? 'Absen Masuk' : 'Absen Keluar'}
              </button>
            )}
            {!canAttend && (
              <div className="w-full mt-4 bg-gray-100 text-gray-500 py-3 px-4 rounded-lg font-medium text-center shadow-sm">
                Absensi hari ini sudah selesai
              </div>
            )}
          </div>
        </div>

        {/* Calendar View */}
        {showCalendar && (
          <div className="bg-white rounded-xl shadow-xl p-6 border border-gray-100">
            <div className="flex items-center space-x-2 mb-4">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Kalender Absensi</h2>
            </div>
            <ReactCalendar
              onChange={handleMonthChange}
              value={currentMonth}
              tileContent={tileContent}
              tileClassName={tileClassName}
              locale={id}
              className="w-full border-0 text-sm"
              prevLabel={<ChevronLeft className="h-5 w-5 text-gray-600" />}
              nextLabel={<ChevronRight className="h-5 w-5 text-gray-600" />}
              navigationLabel={({ date }) => (
                <span className="text-base font-semibold">
                  {format(date, 'MMMM yyyy', { locale: id })}
                </span>
              )}
            />
            <div className="mt-4 p-3 bg-gray-50 rounded-lg shadow-sm">
              <p className="text-sm font-medium text-gray-700 mb-2">Keterangan:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-green-50 border border-green-200 rounded mr-2"></div>
                  <span>Absensi Lengkap</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-orange-50 border border-orange-200 rounded mr-2"></div>
                  <span>Hanya Masuk</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-red-50 border border-red-200 rounded mr-2"></div>
                  <span>Tidak Hadir</span>
                </div>
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-gray-50 rounded mr-2"></div>
                  <span>Akhir Pekan</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Profile Editor Modal */}
      {showProfileEditor && (
        <ProfileEditor
          user={user}
          profile={profile}
          onClose={() => {
            setShowProfileEditor(false);
            fetchUserProfile(user.id);
            fetchBankInfo(user.id);
          }}
        />
      )}

      {/* Attendance Form Modal */}
      {showAttendanceForm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
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
      )}

      {/* Attendance History Modal */}
      {showAttendanceHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="max-w-5xl w-full bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
            <button
              onClick={() => setShowAttendanceHistory(false)}
              className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-50"
            >
              <XCircle className="h-6 w-6 text-gray-600" />
            </button>
            <AttendanceHistory />
          </div>
        </div>
      )}
    </div>
  );
};

const StatCardMini = ({ icon: Icon, title, value, color }) => {
  const colors = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', gradient: 'bg-gradient-to-r from-blue-500 to-indigo-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600', gradient: 'bg-gradient-to-r from-green-500 to-emerald-600' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600', gradient: 'bg-gradient-to-r from-orange-500 to-amber-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600', gradient: 'bg-gradient-to-r from-purple-500 to-indigo-600' },
  };
  const selectedColor = colors[color] || colors.blue;

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
      <div className="flex items-center space-x-3">
        <div className={`w-12 h-12 ${selectedColor.gradient} rounded-lg flex items-center justify-center flex-shrink-0 shadow-md`}>
          <Icon className="h-6 w-6 text-white" />
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
  const [activeTab, setActiveTab] = useState('profile');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banks, setBanks] = useState([]);
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

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      if (error) throw error;
      await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Profil berhasil diperbarui!' });
      onClose();
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Gagal memperbarui profil.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveBank = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          bank_id: bankData.bank_id,
          bank_account_number: bankData.bank_account_number,
          bank_account_name: bankData.bank_account_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      if (error) throw error;
      await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data bank berhasil diperbarui!' });
      onClose();
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Gagal memperbarui data bank.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      await Swal.fire({ icon: 'error', title: 'Gagal', text: 'Password dan konfirmasi tidak sama.' });
      setIsSubmitting(false);
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) throw error;
      await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Password berhasil diubah!' });
      setPasswordData({ newPassword: '', confirmPassword: '' });
      onClose();
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Gagal mengubah password.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md sm:max-w-lg max-h-[90vh] flex flex-col animate-fade-in">
        <div className="p-4 sm:p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Kelola Profil</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
            aria-label="Tutup"
          >
            <XCircle className="h-6 w-6 text-gray-500" />
          </button>
        </div>
        <div className="flex border-b border-gray-200 px-4 sm:px-6">
          {['profile', 'bank', 'password'].map(tab => (
            <button
              key={tab}
              className={`flex-1 px-2 sm:px-4 py-3 text-sm font-medium transition-colors duration-200 ${
                activeTab === tab
                  ? 'border-b-2 border-blue-600 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'profile' ? 'Profil' : tab === 'bank' ? 'Bank' : 'Password'}
            </button>
          ))}
        </div>
        <div className="p-4 sm:p-6">
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  value={profileData.full_name}
                  onChange={e => setProfileData({ ...profileData, full_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-500 cursor-not-allowed"
                  value={profile?.email || ''}
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon</label>
                <input
                  type="tel"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  value={profileData.phone}
                  onChange={e => setProfileData({ ...profileData, phone: e.target.value })}
                />
              </div>
            </form>
          )}
          {activeTab === 'bank' && (
            <form onSubmit={handleSaveBank} className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Bank</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  value={bankData.bank_id}
                  onChange={e => setBankData({ ...bankData, bank_id: e.target.value })}
                >
                  <option value="">Pilih Bank</option>
                  {banks.map(bank => (
                    <option key={bank.id} value={bank.id}>{bank.bank_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Rekening</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  value={bankData.bank_account_number}
                  onChange={e => setBankData({ ...bankData, bank_account_number: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pemilik Rekening</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  value={bankData.bank_account_name}
                  onChange={e => setBankData({ ...bankData, bank_account_name: e.target.value })}
                />
              </div>
            </form>
          )}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                <input
                  type="password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  value={passwordData.newPassword}
                  onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password</label>
                <input
                  type="password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  value={passwordData.confirmPassword}
                  onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                />
              </div>
            </form>
          )}
        </div>
        <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 sticky bottom-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors duration-200"
          >
            Batal
          </button>
          {activeTab !== 'password' && (
            <button
              onClick={activeTab === 'profile' ? handleSaveProfile : handleSaveBank}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 transform hover:scale-[1.02]"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          )}
          {activeTab === 'password' && (
            <button
              onClick={handleChangePassword}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 transform hover:scale-[1.02]"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;