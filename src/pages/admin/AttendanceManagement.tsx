import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Filter,
  RefreshCw,
  FileText,
  MapPin,
  ChevronDown,
  ChevronUp,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useAttendanceData } from '../../hooks/useAttendanceData';
import { supabase } from '../../utils/supabaseClient';
import { WorkHoursSettings, Profile } from '../../types';

const AttendanceManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const recordsPerPage = 10;

  // Initial work hours settings, can be fetched from a global state or settings table
  const [workHoursSettings, setWorkHoursSettings] = useState<WorkHoursSettings>({
    startTime: '08:00',
    endTime: '17:00',
    lateThreshold: 15,
    earlyLeaveThreshold: 15,
    breakDuration: 60,
  });

  const {
    attendanceData,
    employees,
    loading: contentLoading,
    error,
    fetchAttendanceByDate,
    deleteAllAttendanceByDate,
  } = useAttendanceData(selectedDate, workHoursSettings);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      setSelectedDate(new Date(val));
    }
    setCurrentPage(1);
  };

  const filteredAttendance = useMemo(() => {
    return attendanceData.filter(record => {
      const profile = record.profiles as Profile;
      const name = profile?.name ?? '';
      const email = profile?.email ?? '';
      const employeeId = profile?.employee_id ?? '';

      const matchesSearch =
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employeeId.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDepartment = !filterDepartment || profile?.department === filterDepartment;
      const matchesStatus = !filterStatus || record.status === filterStatus;
      const matchesType = !filterType || record.type === filterType;

      return matchesSearch && matchesDepartment && matchesStatus && matchesType;
    });
  }, [attendanceData, searchTerm, filterDepartment, filterStatus, filterType]);

  const paginatedAttendance = useMemo(() => {
    return filteredAttendance.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);
  }, [filteredAttendance, currentPage, recordsPerPage]);

  const totalPages = Math.ceil(filteredAttendance.length / recordsPerPage);

    const getDepartments = (): string[] => {
    return [...new Set(employees.map(emp => emp.department).filter(Boolean) as string[])];
  };

  // UI Helper Functions
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'berhasil': return 'text-green-600 bg-green-100';
      case 'wajah_tidak_valid': return 'text-red-600 bg-red-100';
      case 'lokasi_tidak_valid': return 'text-yellow-600 bg-yellow-100';
      case 'tidak_hadir': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string): JSX.Element => {
    switch (status) {
      case 'berhasil': return <CheckCircle className="h-4 w-4" />;
      case 'wajah_tidak_valid':
      case 'lokasi_tidak_valid':
      case 'tidak_hadir': return <XCircle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'berhasil': return 'Berhasil';
      case 'wajah_tidak_valid': return 'Wajah Invalid';
      case 'lokasi_tidak_valid': return 'Lokasi Invalid';
      case 'tidak_hadir': return 'Tidak Hadir';
      default: return 'Gagal';
    }
  };

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Export to CSV
  const exportToCsv = () => {
    if (filteredAttendance.length === 0) {
      Swal.fire('Tidak Ada Data', 'Tidak ada data untuk diekspor.', 'warning');
      return;
    }
    // CSV logic...
  };

  return (
    <div className="flex-1 transition-all duration-300">
      <div className="bg-white shadow-md border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 truncate">Manajemen Absensi</h1>
              <p className="text-sm text-gray-600 mt-1">Lihat dan kelola absensi karyawan berdasarkan tanggal.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => fetchAttendanceByDate(selectedDate)}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <RefreshCw className="h-5 w-5" />
                <span>Refresh</span>
              </button>
              <button
                onClick={exportToCsv}
                disabled={filteredAttendance.length === 0}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="h-5 w-5" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => deleteAllAttendanceByDate(selectedDate)}
                disabled={filteredAttendance.length === 0}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Trash2 className="h-5 w-5" />
                <span>Hapus Semua</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg flex items-center space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </div>
        )}
        <div className="bg-white rounded-xl shadow-md mb-6 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Clock className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Pilih Tanggal</h2>
            </div>
            <input
              type="date"
              value={selectedDate.toISOString().split('T')[0]}
              onChange={handleDateChange}
              className="w-full sm:w-48 px-4 py-3 border border-gray-200 rounded-lg"
            />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari nama, email, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-between w-full px-4 py-3 text-sm text-gray-700 bg-gray-100 rounded-lg"
              >
                <div className="flex items-center space-x-2">
                  <Filter className="h-5 w-5" />
                  <span>Filter Data</span>
                </div>
                {showFilters ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                  <select
                    value={filterDepartment}
                    onChange={(e) => setFilterDepartment(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg"
                  >
                    <option value="">Semua Departemen</option>
                    {getDepartments().map(dept => <option key={dept} value={dept}>{dept}</option>)}
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg"
                  >
                    <option value="">Semua Status</option>
                    <option value="berhasil">Berhasil</option>
                    <option value="wajah_tidak_valid">Wajah Invalid</option>
                    <option value="lokasi_tidak_valid">Lokasi Invalid</option>
                    <option value="tidak_hadir">Tidak Hadir</option>
                  </select>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg"
                  >
                    <option value="">Semua Jenis</option>
                    <option value="masuk">Masuk</option>
                    <option value="keluar">Keluar</option>
                    <option value="absent">Tidak Hadir</option>
                  </select>
                </div>
              )}
            </div>
          </div>
          {contentLoading ? (
            <div className="text-center py-16">Memuat...</div>
          ) : paginatedAttendance.length > 0 ? (
            <>
              <div className="hidden lg:block">
                <table className="min-w-full divide-y divide-gray-200">
                  {/* Table Head */}
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Karyawan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Waktu</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jenis</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Keterlambatan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lokasi</th>
                    </tr>
                  </thead>
                  {/* Table Body */}
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedAttendance.map(record => (
                      <tr key={record.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{(record.profiles as Profile)?.name}</div>
                              <div className="text-sm text-gray-500">{(record.profiles as Profile)?.employee_id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{formatTime(record.timestamp)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{record.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(record.status)}`}>
                            {getStatusText(record.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{record.is_late ? `${record.late_minutes} menit` : '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {record.latitude ? `${record.latitude.toFixed(4)}, ${record.longitude?.toFixed(4)}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile View */}
              <div className="lg:hidden p-4 space-y-4">
                {paginatedAttendance.map(record => (
                  <div key={record.id} className="bg-gray-50 p-4 rounded-lg">
                    {/* Mobile card content */}
                  </div>
                ))}
              </div>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center p-4">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Sebelumnya
                  </button>
                  <span>Halaman {currentPage} dari {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Berikutnya
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Tidak ada data</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default AttendanceManagement