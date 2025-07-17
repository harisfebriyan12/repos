import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, 
  Search, 
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  CreditCard,
  Calendar,
  Building,
  User,
  Clock,
  Download,
  RefreshCw,
  FileText,
  Send
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import SalaryPaymentForm from '../components/SalaryPaymentForm';
import AdminSidebar from '../components/AdminSidebar';

const SalaryPaymentManagement = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [payments, setPayments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [stats, setStats] = useState({
    totalPaid: 0,
    pendingPayments: 0,
    totalEmployees: 0,
    paidEmployees: 0
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
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        navigate('/dashboard');
        return;
      }

      setCurrentUser(user);
      setProfile(profile);
      await Promise.all([fetchEmployees(), fetchPayments()]);
    } catch (error) {
      console.error('Error checking access:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    setContentLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          employee_salaries(*),
          positions(*),
          bank_info(*)
        `)
        .order('name');

      if (error) throw error;
      setEmployees(data || []);
      
      // Calculate stats
      const totalEmployees = data?.length || 0;
      const paidEmployees = data?.filter(emp => 
        emp.employee_salaries?.[0]?.payment_status === 'paid'
      ).length || 0;
      
      setStats(prev => ({
        ...prev,
        totalEmployees,
        paidEmployees
      }));
    } catch (error) {
      console.error('Error fetching employees:', error);
      setError('Gagal memuat data karyawan');
    } finally {
      setContentLoading(false);
    }
  };

  const fetchPayments = async () => {
    setContentLoading(true);
    try {
      const { data, error } = await supabase
        .from('salary_payments')
        .select(`
          *,
          profiles:user_id(name, email, department, title, employee_id)
        `)
        .order('payment_date', { ascending: false })
        .limit(100);

      if (error) throw error;
      setPayments(data || []);
      
      // Calculate stats
      const totalPaid = data?.reduce((sum, payment) => 
        sum + (payment.payment_amount || 0), 0
      ) || 0;
      
      const pendingPayments = data?.filter(payment => 
        payment.payment_status === 'pending' || payment.payment_status === 'processing'
      ).length || 0;
      
      setStats(prev => ({
        ...prev,
        totalPaid,
        pendingPayments
      }));
    } catch (error) {
      console.error('Error fetching payments:', error);
      setError('Gagal memuat data pembayaran');
    } finally {
      setContentLoading(false);
    }
  };

  const handlePaymentProcessed = async (paymentData) => {
    setSuccess(`Pembayaran gaji untuk ${selectedEmployee.name} berhasil diproses!`);
    setShowPaymentForm(false);
    
    // Refresh data
    await Promise.all([fetchEmployees(), fetchPayments()]);
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      setSuccess(null);
    }, 3000);
  };

  const handleProcessPayment = (employee) => {
    setSelectedEmployee(employee);
    setShowPaymentForm(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'unpaid':
        return 'bg-red-100 text-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusText = (status) => {
    switch (status) {
      case 'paid':
        return 'Dibayar';
      case 'unpaid':
        return 'Belum Dibayar';
      case 'processing':
        return 'Diproses';
      case 'failed':
        return 'Gagal';
      default:
        return 'Tidak Diketahui';
    }
  };

  // Get salary from position or employee_salaries
  const getEmployeeSalary = (employee) => {
    // First try to get from positions
    if (employee.positions?.base_salary) {
      return employee.positions.base_salary;
    }
    
    // Then try from employee_salaries
    if (employee.employee_salaries && employee.employee_salaries.length > 0) {
      const dailySalary = employee.employee_salaries[0].daily_salary || 0;
      return dailySalary * 22; // Convert daily to monthly
    }
    
    // Fallback to profile salary
    return employee.salary || 0;
  };

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = 
      employee.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employee_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = !filterDepartment || employee.department === filterDepartment;
    
    const matchesStatus = !filterStatus || 
      (employee.employee_salaries?.[0]?.payment_status === filterStatus);
    
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const getDepartments = () => {
    const departments = [...new Set(employees.map(emp => emp.department).filter(Boolean))];
    return departments;
  };

  const exportPaymentsToCSV = () => {
    if (payments.length === 0) return;

    const headers = [
      'Tanggal', 'Karyawan', 'Departemen', 'Jumlah', 'Metode', 'Status', 'Referensi', 'Catatan'
    ];

    const csvContent = [
      headers,
      ...payments.map(payment => [
        formatDate(payment.payment_date),
        payment.profiles?.name || 'Unknown',
        payment.profiles?.department || '-',
        payment.payment_amount,
        payment.payment_method === 'bank_transfer' ? 'Transfer Bank' : 
        payment.payment_method === 'cash' ? 'Tunai' : 'Lainnya',
        payment.payment_status,
        payment.payment_reference || '-',
        payment.notes || '-'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `salary_payments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
          <p className="text-gray-600 mt-4">Memuat data pembayaran...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <AdminSidebar user={currentUser} profile={profile} />

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 transition-all duration-300 ease-in-out">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Kelola Pembayaran Gaji</h1>
                <p className="text-sm text-gray-600">
                  Proses pembayaran gaji karyawan dan lihat riwayat transaksi
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setContentLoading(true);
                    Promise.all([fetchEmployees(), fetchPayments()]).finally(() => setContentLoading(false));
                  }}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  title="Refresh Data"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <button
                  onClick={exportPaymentsToCSV}
                  disabled={payments.length === 0}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Notifications */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-green-700">{success}</p>
              <button 
                onClick={() => setSuccess(null)}
                className="ml-auto text-green-500 hover:text-green-700"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700">{error}</p>
              <button 
                onClick={() => setError(null)}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Dibayarkan</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalPaid)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Karyawan Dibayar</p>
                  <p className="text-xl font-bold text-gray-900">{stats.paidEmployees}</p>
                  <p className="text-xs text-blue-600">dari {stats.totalEmployees} karyawan</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pembayaran Tertunda</p>
                  <p className="text-xl font-bold text-gray-900">{stats.pendingPayments}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Belum Dibayar</p>
                  <p className="text-xl font-bold text-gray-900">{stats.totalEmployees - stats.paidEmployees}</p>
                  <p className="text-xs text-red-600">karyawan</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filter dan Pencarian */}
          <div className="bg-white rounded-lg shadow-md mb-6">
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari nama, email, atau ID karyawan..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <select
                    value={filterDepartment}
                    onChange={(e) => setFilterDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Semua Departemen</option>
                    {getDepartments().map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Semua Status</option>
                    <option value="paid">Sudah Dibayar</option>
                    <option value="unpaid">Belum Dibayar</option>
                    <option value="processing">Sedang Diproses</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Employee Salary Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-medium text-gray-900">
                  Daftar Gaji Karyawan ({filteredEmployees.length})
                </h2>
              </div>
            </div>
            
            {contentLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="inline-flex space-x-1 text-blue-600">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            ) : filteredEmployees.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Karyawan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Jabatan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rekening Bank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status Pembayaran
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEmployees.map((employee) => {
                      const salary = employee.employee_salaries?.[0];
                      const monthlySalary = getEmployeeSalary(employee);
                      
                      return (
                        <tr key={employee.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 font-medium">
                                  {employee.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {employee.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {employee.email}
                                </div>
                                {employee.employee_id && (
                                  <div className="text-xs text-gray-400">
                                    ID: {employee.employee_id}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {employee.positions?.name_id || employee.title || 'Karyawan'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {employee.department || 'Belum diatur'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {employee.bank_info ? (
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {employee.bank_info.bank_name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {employee.bank_account_number}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                                Belum diatur
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(salary?.payment_status || 'unpaid')}`}>
                              {getPaymentStatusText(salary?.payment_status || 'unpaid')}
                            </span>
                            {salary?.last_payment_date && (
                              <div className="text-xs text-gray-500 mt-1">
                                Terakhir: {formatDate(salary.last_payment_date)}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleProcessPayment(employee)}
                              className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                            >
                              <Send className="h-3.5 w-3.5 mr-1" />
                              <span>Bayar</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-lg mb-2">Tidak ada karyawan ditemukan</p>
                <p className="text-gray-400">Coba sesuaikan pencarian atau filter Anda</p>
              </div>
            )}
          </div>

          {/* Recent Payments */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-medium text-gray-900">
                  Riwayat Pembayaran Terbaru
                </h2>
              </div>
            </div>
            
            {contentLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="inline-flex space-x-1 text-blue-600">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            ) : payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tanggal
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Karyawan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Jumlah
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Metode
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Referensi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payments.slice(0, 10).map((payment) => (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(payment.payment_date)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(payment.created_at).toLocaleTimeString('id-ID')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {payment.profiles?.name || 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {payment.profiles?.department || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(payment.payment_amount)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {payment.payment_method === 'bank_transfer' ? 'Transfer Bank' : 
                             payment.payment_method === 'cash' ? 'Tunai' : 'Lainnya'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            payment.payment_status === 'completed' ? 'bg-green-100 text-green-800' :
                            payment.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            payment.payment_status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {payment.payment_status === 'completed' ? 'Selesai' :
                             payment.payment_status === 'pending' ? 'Tertunda' :
                             payment.payment_status === 'processing' ? 'Diproses' : 'Gagal'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {payment.payment_reference || '-'}
                          </div>
                          {payment.notes && (
                            <div className="text-xs text-gray-500 truncate max-w-xs">
                              {payment.notes}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-lg mb-2">Belum ada riwayat pembayaran</p>
                <p className="text-gray-400">Pembayaran yang diproses akan muncul di sini</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Form Modal */}
      {showPaymentForm && selectedEmployee && (
        <SalaryPaymentForm
          employee={selectedEmployee}
          onClose={() => setShowPaymentForm(false)}
          onPaymentProcessed={handlePaymentProcessed}
        />
      )}
    </div>
  );
};

export default SalaryPaymentManagement;