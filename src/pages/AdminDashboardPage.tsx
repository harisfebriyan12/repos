import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Settings, 
  MapPin, 
  Clock,
  Shield,
  Database,
  UserPlus,
  FileText,
  Calendar,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Bell,
  Eye,
  Building,
  Camera,
  User,
  Download,
  Save
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import Swal from 'sweetalert2';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import WarningLetterGenerator from '../components/WarningLetterGenerator';
import NotificationSystem from '../components/NotificationSystem';
import StatCard from '../components/ui/StatCard';
import { User, Profile } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAttendance: 0,
    todayAttendance: 0,
    activeUsers: 0,
    totalSalaryPaid: 0,
    avgDailySalary: 0,
    lateEmployees: 0,
    activeWarnings: 0,
    totalPositions: 0,
    activeDepartments: 0,
    absentToday: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [lateEmployees, setLateEmployees] = useState<any[]>([]);
  const [absentEmployees, setAbsentEmployees] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>({});
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [showEmployeeDetail, setShowEmployeeDetail] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [cameraSettings, setCameraSettings] = useState({
    enabled: true,
    required_for_admin: false
  });

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        navigate('/dashboard');
        return;
      }

      setUser(user);
      setProfile(profile);
      await fetchDashboardData();
    } catch (error) {
      console.error('Error checking access:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const [usersResult, attendanceResult, todayResult, positionsResult] = await Promise.all([
        supabase.from('profiles').select('id, role, status', { count: 'exact' }),
        supabase.from('attendance').select('id', { count: 'exact' }),
        supabase.from('attendance').select('*')
          .gte('timestamp', `${today}T00:00:00`)
          .lte('timestamp', `${today}T23:59:59`),
        supabase.from('positions').select('id, department', { count: 'exact' })
      ]);

      const { data: allEmployees } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url, employee_id, department, role, status')
        .eq('role', 'karyawan')
        .eq('status', 'active');

      const { data: todayAttendanceData } = await supabase
        .from('attendance')
        .select(`
          *,
          profiles!inner(id, name, email, avatar_url, employee_id, department, role)
        `)
        .gte('timestamp', `${today}T00:00:00`)
        .lte('timestamp', `${today}T23:59:59`)
        .eq('status', 'berhasil');

      const checkedInToday = todayAttendanceData
        ?.filter(record => record.type === 'masuk')
        .map(record => record.user_id) || [];

      const absentToday = allEmployees?.filter(emp => 
        !checkedInToday.includes(emp.id) && emp.role !== 'admin'
      ) || [];

      if (absentToday.length > 0) {
        const absentRecords = absentToday.map(emp => ({
          user_id: emp.id,
          type: 'absent',
          timestamp: new Date().toISOString(),
          status: 'tidak_hadir',
          notes: 'Tidak hadir - tidak melakukan absensi masuk',
          is_late: false,
          late_minutes: 0,
          work_hours: 0
        }));

        await supabase
          .from('attendance')
          .upsert(absentRecords, { 
            onConflict: 'user_id,timestamp',
            ignoreDuplicates: true 
          });
      }

      const lateToday = todayAttendanceData
        ?.filter(record => record.type === 'masuk' && record.is_late) || [];

      const { data: salaryData } = await supabase
        .from('employee_salaries')
        .select('daily_salary')
        .eq('is_active', true);

      const totalSalaryPaid = salaryData?.reduce((sum, s) => sum + (s.daily_salary * 22), 0) || 0;
      const avgDailySalary = salaryData?.length > 0 
        ? salaryData.reduce((sum, s) => sum + s.daily_salary, 0) / salaryData.length 
        : 0;

      const { data: warningsData } = await supabase
        .from('attendance_warnings')
        .select('id')
        .eq('is_resolved', false);

      const departments = [...new Set(positionsResult.data?.map(p => p.department).filter(Boolean))] || [];

      setStats({
        totalUsers: usersResult.count || 0,
        totalAttendance: attendanceResult.count || 0,
        todayAttendance: checkedInToday.length,
        activeUsers: usersResult.data?.filter(u => u.status === 'active').length || 0,
        totalSalaryPaid,
        avgDailySalary,
        lateEmployees: lateToday.length,
        activeWarnings: warningsData?.length || 0,
        totalPositions: positionsResult.count || 0,
        activeDepartments: departments.length,
        absentToday: absentToday.length
      });

      setLateEmployees(lateToday);
      setAbsentEmployees(absentToday);

      const { data: recentData } = await supabase
        .from('attendance')
        .select(`
          *,
          profiles!inner(name, role, department, avatar_url, employee_id)
        `)
        .order('timestamp', { ascending: false })
        .limit(15);

      setRecentActivity(recentData || []);

      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('*');

      const settingsObj = {};
      settingsData?.forEach(setting => {
        settingsObj[setting.setting_key] = setting.setting_value;
      });
      setSystemSettings(settingsObj);
      
      const cameraVerificationSetting = settingsData?.find(s => s.setting_key === 'camera_verification');
      if (cameraVerificationSetting?.setting_value) {
        setCameraSettings(cameraVerificationSetting.setting_value);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const handleSaveCameraSettings = async () => {
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'camera_verification',
          setting_value: {
            ...cameraSettings,
            updated_by: user.id,
            updated_at: new Date().toISOString()
          },
          description: 'Controls whether face verification is required for attendance',
          is_enabled: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;

      await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Pengaturan verifikasi kamera berhasil disimpan!' });
      setShowSettingsModal(false);
    } catch (error) {
      console.error('Error saving camera settings:', error);
      await Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal menyimpan pengaturan verifikasi kamera' });
    }
  };

  const handleIssueWarning = (employee: any) => {
    setSelectedEmployee(employee);
    setShowWarningModal(true);
  };

  const handleWarningGenerated = async (warningLetter: any) => {
    setShowWarningModal(false);
    await Swal.fire({ icon: 'success', title: 'Surat Peringatan', text: `Surat peringatan ${warningLetter.warning_type} berhasil dibuat dan dikirim ke ${selectedEmployee.name}` });
    fetchDashboardData();
  };

  const handleViewEmployee = async (employee: any) => {
    if (employee) {
      setSelectedEmployee(employee);
      setShowEmployeeDetail(true);
    } else {
      console.error("Attempted to view details for a null/undefined employee.");
      await Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal menampilkan detail: data karyawan tidak ditemukan.' });
    }
  };

  const sendNotificationToEmployee = async (employeeId: string, type: string, title: string, message: string) => {
    try {
      await supabase.from('notifications').insert([{
        user_id: employeeId,
        admin_id: user.id,
        type: type,
        title: title,
        message: message,
        data: {
          timestamp: new Date().toISOString(),
          sent_by: profile.name
        },
        is_read: false
      }]);
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const handleSendLateWarning = async (employee: any) => {
    try {
      await sendNotificationToEmployee(
        employee.user_id || employee.id,
        'late_warning',
        'Peringatan Keterlambatan',
        `Anda terlambat ${employee.late_minutes} menit hari ini. Harap lebih memperhatikan kedisiplinan waktu.`
      );
      await Swal.fire({ icon: 'success', title: 'Notifikasi Dikirim', text: `Notifikasi peringatan telah dikirim ke ${employee.profiles?.name || employee.name}` });
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengirim notifikasi' });
    }
  };

  const handleSendAbsentWarning = async (employee: any) => {
    try {
      await sendNotificationToEmployee(
        employee.id,
        'absence_warning',
        'Peringatan Ketidakhadiran',
        'Anda tidak hadir hari ini tanpa keterangan. Harap segera menghubungi atasan atau HR.'
      );
      await Swal.fire({ icon: 'success', title: 'Notifikasi Dikirim', text: `Notifikasi peringatan telah dikirim ke ${employee.name}` });
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal mengirim notifikasi' });
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'karyawan':
        return 'Karyawan';
      default:
        return 'Karyawan';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'berhasil':
        return 'text-green-600 bg-green-100';
      case 'tidak_hadir':
        return 'text-red-600 bg-red-100';
      case 'wajah_tidak_valid':
        return 'text-red-600 bg-red-100';
      case 'lokasi_tidak_valid':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'berhasil':
        return <CheckCircle className="h-4 w-4" />;
      case 'tidak_hadir':
        return <XCircle className="h-4 w-4" />;
      case 'wajah_tidak_valid':
      case 'lokasi_tidak_valid':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const formatDateTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Chart data
  const attendanceChartData = {
    labels: ['Hadir', 'Terlambat', 'Tidak Hadir'],
    datasets: [{
      label: 'Statistik Absensi Hari Ini',
      data: [stats.todayAttendance, stats.lateEmployees, stats.absentToday],
      backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
      borderColor: ['#059669', '#D97706', '#DC2626'],
      borderWidth: 1
    }]
  };

  const departmentChartData = {
    labels: ['Karyawan Aktif', 'Departemen', 'Posisi'],
    datasets: [{
      data: [stats.activeUsers, stats.activeDepartments, stats.totalPositions],
      backgroundColor: ['#3B82F6', '#8B5CF6', '#EC4899'],
    }]
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex space-x-1 text-blue-600">
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-gray-600 mt-4 font-medium">Memuat dashboard admin...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white shadow-lg border-b fixed top-0 left-0 right-0 lg:relative z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4 lg:py-5">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Dashboard Admin</h1>
              <p className="hidden sm:block text-sm text-gray-600 mt-1">
                Pantau aktivitas dan kelola sistem dengan mudah
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Users}
            title="Total Karyawan"
            value={stats.totalUsers}
            footer={`${stats.activeUsers} aktif`}
            color="blue"
          />
          <StatCard
            icon={CheckCircle}
            title="Hadir Hari Ini"
            value={stats.todayAttendance}
            footer={`${stats.absentToday} absen`}
            color="green"
          />
          <StatCard
            icon={AlertTriangle}
            title="Terlambat"
            value={stats.lateEmployees}
            footer="Hari ini"
            color="orange"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistik Absensi</h2>
            <div className="h-64">
              <Bar
                data={attendanceChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Statistik Absensi Harian' }
                  }
                }}
              />
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Distribusi Organisasi</h2>
            <div className="h-64">
              <Pie
                data={departmentChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Struktur Organisasi' }
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Employee Status */}
        {(lateEmployees.length > 0 || absentEmployees.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {lateEmployees.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 bg-orange-50">
                  <h2 className="text-lg font-semibold text-orange-900">
                    Karyawan Terlambat ({lateEmployees.length})
                  </h2>
                </div>
                <div className="p-6 max-h-96 overflow-y-auto">
                  <div className="space-y-4">
                    {lateEmployees.slice(0, 5).map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{record.profiles?.name}</p>
                            <p className="text-xs text-gray-600">Terlambat {record.late_minutes} menit</p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewEmployee(record.profiles)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"
                            title="Lihat Detail"
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleSendLateWarning(record)}
                            className="p-2 text-orange-600 hover:bg-orange-100 rounded-full"
                            title="Kirim Peringatan"
                          >
                            <Bell className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleIssueWarning(record.profiles)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-full"
                            title="Buat SP"
                          >
                            <FileText className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {absentEmployees.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 bg-red-50">
                  <h2 className="text-lg font-semibold text-red-900">
                    Karyawan Absen ({absentEmployees.length})
                  </h2>
                </div>
                <div className="p-6 max-h-96 overflow-y-auto">
                  <div className="space-y-4">
                    {absentEmployees.slice(0, 5).map((employee) => (
                      <div key={employee.id} className="flex items-center justify-between p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{employee.name}</p>
                            <p className="text-xs text-gray-600">{employee.department || 'Tidak ada departemen'}</p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewEmployee(employee)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"
                            title="Lihat Detail"
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleSendAbsentWarning(employee)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-full"
                            title="Kirim Peringatan"
                          >
                            <Bell className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleIssueWarning(employee)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-full"
                            title="Buat SP"
                          >
                            <FileText className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* System Information */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Database className="h-6 w-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Informasi Sistem</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg">
              <Database className="h-8 w-8 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900 text-sm">Database</p>
                <p className="text-xs text-gray-600">Supabase PostgreSQL</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-4 bg-purple-50 rounded-lg">
              <MapPin className="h-8 w-8 text-purple-600" />
              <div>
                <p className="font-medium text-gray-900 text-sm">Radius Kantor</p>
                <p className="text-xs text-gray-600">{systemSettings.office_location?.radius || 100} meter</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-4 bg-orange-50 rounded-lg">
              <Camera className="h-8 w-8 text-orange-600" />
              <div>
                <p className="font-medium text-gray-900 text-sm">Verifikasi Wajah</p>
                <p className="text-xs text-gray-600">{cameraSettings.enabled ? 'Aktif' : 'Nonaktif'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showWarningModal && selectedEmployee && (
        <WarningLetterGenerator 
          employee={selectedEmployee}
          onClose={() => setShowWarningModal(false)}
          onGenerated={handleWarningGenerated}
          issuedByUserId={user.id}
        />
      )}

      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl transform transition-all">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Export Database</h2>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              <div className="space-y-6">
                <div className="bg-blue-50 p-6 rounded-lg">
                  <div className="flex items-start space-x-4">
                    <Database className="h-8 w-8 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">Export Database Supabase</h3>
                      <p className="text-blue-700 mb-4">
                        Ikuti langkah-langkah berikut untuk mengekspor database:
                      </p>
                      <div className="space-y-4">
                        {[
                          { title: 'Akses Dashboard', desc: 'Login ke <a href="https://app.supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">app.supabase.com</a>' },
                          { title: 'Buka Menu Database', desc: 'Pilih menu "Database" → "Backups" dari sidebar' },
                          { title: 'Generate Backup', desc: 'Klik "Generate backup" untuk membuat backup terbaru' },
                          { title: 'Download Backup', desc: 'Klik "Download" untuk mengunduh file SQL' },
                          { title: 'Export Storage', desc: 'Gunakan menu "Storage" untuk download bucket secara terpisah' }
                        ].map((step, index) => (
                          <div key={index} className="bg-white p-4 rounded-lg border border-blue-200">
                            <h4 className="font-medium text-blue-800 mb-2">{index + 1}. {step.title}</h4>
                            <p className="text-sm text-blue-700" dangerouslySetInnerHTML={{ __html: step.desc }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-yellow-800 font-medium">Catatan Penting</p>
                      <p className="text-yellow-700 text-sm mt-1">
                        Simpan backup dengan aman dan jangan bagikan kepada pihak yang tidak berwenang.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl transform transition-all">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Pengaturan Sistem</h2>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-3">Verifikasi Kamera</h3>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="camera-enabled"
                        checked={cameraSettings.enabled}
                        onChange={(e) => setCameraSettings(prev => ({
                          ...prev,
                          enabled: e.target.checked
                        }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="camera-enabled" className="ml-2 block text-sm text-gray-900">
                        Aktifkan verifikasi wajah
                      </label>
                    </div>
                    <div className="p-3 bg-white rounded-lg">
                      <p className="text-sm text-gray-600">
                        {cameraSettings.enabled 
                          ? 'Karyawan harus verifikasi wajah saat absensi' 
                          : 'Absensi tanpa verifikasi wajah'}
                      </p>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-yellow-700">
                          Nonaktifkan verifikasi wajah hanya jika terjadi masalah perangkat.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveCameraSettings}
                    className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Save className="h-4 w-4" />
                      <span>Simpan</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminDashboardPage;
