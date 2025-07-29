import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useAuth } from '../../App';
import { Calendar, Clock, MapPin, CheckCircle, XCircle, AlertTriangle, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface AttendanceRecord {
  id: string;
  timestamp: string;
  type: 'masuk' | 'keluar';
  status: 'berhasil' | 'wajah_tidak_valid' | 'lokasi_tidak_valid';
  is_late: boolean;
  late_minutes: number;
  work_hours: number;
  overtime_hours: number;
  latitude: number | null;
  longitude: number | null;
}

const AttendanceHistory: React.FC = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (user) {
      fetchAttendanceData(currentMonth);
    }
  }, [user, currentMonth]);

  const fetchAttendanceData = async (date: Date) => {
    setLoading(true);
    setError(null);
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user!.id)
        .gte('timestamp', firstDay.toISOString())
        .lte('timestamp', lastDay.toISOString())
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setAttendance(data || []);
    } catch (err: any) {
      setError('Gagal memuat riwayat absensi.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const changeMonth = (offset: number) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + offset);
      return newDate;
    });
  };

  const getStatusComponent = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'berhasil':
        return <span className="flex items-center text-sm text-green-600"><CheckCircle className="w-4 h-4 mr-1" /> Berhasil</span>;
      case 'wajah_tidak_valid':
        return <span className="flex items-center text-sm text-red-600"><XCircle className="w-4 h-4 mr-1" /> Wajah Tidak Valid</span>;
      case 'lokasi_tidak_valid':
        return <span className="flex items-center text-sm text-yellow-600"><AlertTriangle className="w-4 h-4 mr-1" /> Lokasi Tidak Valid</span>;
      default:
        return null;
    }
  };

  const chartData = {
    labels: ['Tepat Waktu', 'Terlambat', 'Gagal'],
    datasets: [
      {
        label: 'Jumlah Hari',
        data: [
          attendance.filter(a => a.type === 'masuk' && !a.is_late).length,
          attendance.filter(a => a.is_late).length,
          attendance.filter(a => a.status !== 'berhasil').length,
        ],
        backgroundColor: [
          'rgba(75, 192, 192, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(255, 99, 132, 0.6)',
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(255, 99, 132, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Riwayat Absensi</h1>
          <div className="flex items-center bg-white shadow-sm rounded-lg p-1">
            <button onClick={() => changeMonth(-1)} className="p-2 rounded-md hover:bg-gray-100 text-gray-600">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-center w-32 sm:w-40 font-semibold text-gray-700">
              {currentMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => changeMonth(1)} className="p-2 rounded-md hover:bg-gray-100 text-gray-600">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <p>Memuat data...</p>
          </div>
        ) : error ? (
          <div className="text-center py-10 text-red-500">{error}</div>
        ) : (
          <>
            <div className="mb-8 bg-white p-6 rounded-xl shadow-md">
              <h2 className="text-xl font-semibold text-gray-700 mb-4">Ringkasan Bulan Ini</h2>
              <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
            </div>

            {attendance.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-lg shadow-md">
                 <FileText className="mx-auto h-12 w-12 text-gray-400" />
                 <h3 className="mt-2 text-sm font-medium text-gray-900">Tidak ada data</h3>
                 <p className="mt-1 text-sm text-gray-500">Tidak ada catatan absensi untuk bulan ini.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {attendance.map(record => (
                  <div key={record.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                      <div className="flex items-center mb-2 sm:mb-0">
                        <Calendar className="w-5 h-5 text-blue-500 mr-3" />
                        <div>
                          <p className="font-semibold text-gray-800">
                            {new Date(record.timestamp).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                          <p className={`capitalize font-medium ${record.type === 'masuk' ? 'text-green-500' : 'text-red-500'}`}>{record.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="w-4 h-4 mr-2" />
                        {new Date(record.timestamp).toLocaleTimeString('id-ID')}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        {getStatusComponent(record.status)}
                        {record.is_late && <span className="text-sm text-red-500 font-semibold">Terlambat {record.late_minutes} menit</span>}
                        {record.latitude && record.longitude && (
                          <div className="flex items-center text-xs text-gray-500 mt-2 sm:mt-0">
                            <MapPin className="w-3 h-3 mr-1" />
                            {record.latitude.toFixed(4)}, {record.longitude.toFixed(4)}
                          </div>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AttendanceHistory;