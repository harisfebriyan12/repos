import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient.ts';
import Swal from 'sweetalert2';
import { Attendance, Profile, WorkHoursSettings } from '../types';

export const useAttendanceData = (
  selectedDate: Date,
  workHoursSettings: WorkHoursSettings
) => {
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, employee_id, department, role, status')
        .order('name');
      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      setError('Gagal memuat data karyawan');
    }
  }, []);

  const fetchAttendanceByDate = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      const formattedDate = date.toISOString().split('T')[0];
      const startDateTime = `${formattedDate}T00:00:00`;
      const endDateTime = `${formattedDate}T23:59:59`;

      const { data: attendanceRows, error: attendanceError } = await supabase
        .from('attendance')
        .select('*, profiles:user_id(id, name, email, employee_id, department, role, status)')
        .gte('timestamp', startDateTime)
        .lte('timestamp', endDateTime)
        .order('timestamp', { ascending: false });

      if (attendanceError) throw attendanceError;

      // Logic for marking absent employees
      const { data: activeEmployees, error: empError } = await supabase
        .from('profiles')
        .select('id, name, email, employee_id, department, role, status')
        .eq('status', 'active')
        .neq('role', 'admin');

      if (empError) throw empError;

      const presentEmployeeIds = new Set(attendanceRows.map(r => r.user_id));
      const absentEmployees = activeEmployees.filter(emp => !presentEmployeeIds.has(emp.id));

      if (absentEmployees.length > 0) {
        // Further logic to insert absent records can be added here if needed
      }

      setAttendanceData(attendanceRows || []);
    } catch (error: any) {
      setError('Gagal memuat data absensi');
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAllAttendanceByDate = async (date: Date) => {
    const formattedDate = date.toISOString().split('T')[0];
    const result = await Swal.fire({
      title: 'Hapus Semua Data Absensi?',
      text: `Yakin ingin menghapus semua data untuk tanggal ${formattedDate}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase
          .from('attendance')
          .delete()
          .gte('timestamp', `${formattedDate}T00:00:00`)
          .lte('timestamp', `${formattedDate}T23:59:59`);

        if (error) throw error;

        Swal.fire('Terhapus!', 'Semua data absensi telah dihapus.', 'success');
        fetchAttendanceByDate(date); // Refresh data
      } catch (error: any) {
        Swal.fire('Gagal!', `Gagal menghapus data: ${error.message}`, 'error');
      }
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    if (selectedDate) {
      fetchAttendanceByDate(selectedDate);
    }
  }, [selectedDate, fetchAttendanceByDate]);

  return {
    attendanceData,
    employees,
    loading,
    error,
    fetchAttendanceByDate,
    deleteAllAttendanceByDate,
  };
};
