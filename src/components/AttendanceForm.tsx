import React, { useState, useEffect, useCallback, useRef } from 'react';
import Swal from 'sweetalert2';
import {
  Clock,
  MapPin,
  Camera,
  CheckCircle,
  AlertCircle,
  User,
  Edit,
  XCircle,
  Info,
  ChevronLeft,
} from 'lucide-react';
import {
  supabase,
  getOfficeLocation,
  getCameraVerificationSettings,
} from '../utils/supabaseClient';
import {
  processImageUrl,
  compareFaceFingerprints,
} from '../utils/customFaceRecognition';
import CustomFaceCapture from './CustomFaceCapture';
import LocationValidator from './LocationValidator';
import { useDebounce } from './useDebounce';

// Interface untuk Face Fingerprint (disesuaikan dengan asumsi umum)
interface FaceFingerprint {
  descriptors: number[];
  imageData?: string;
}

// Interface untuk data
interface User {
  id: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  salary?: number;
  role?: 'admin' | 'karyawan';
}

interface AttendanceRecord {
  type: 'masuk' | 'keluar';
  status: string;
  timestamp: string;
  check_in_time?: string;
  check_out_time?: string;
  latitude?: number;
  longitude?: number;
  is_late?: boolean;
  late_minutes?: number;
  work_hours?: number;
  overtime_hours?: number;
  daily_salary_earned?: number;
  notes?: string;
}

interface WorkHoursSettings {
  startTime: string;
  endTime: string;
  lateThreshold: number;
  earlyLeaveThreshold: number;
  breakDuration: number;
}

interface OfficeLocation {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface Location {
  latitude: number;
  longitude: number;
}

interface AttendanceFormProps {
  user: User;
  onAttendanceSubmitted?: (data: AttendanceRecord) => void;
  todayAttendance?: AttendanceRecord[];
  onClose?: () => void;
}

interface CameraSettings {
  enabled: boolean;
}

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Optionally log error details here for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center">
          <h2 className="text-lg font-bold text-red-600">Terjadi Kesalahan</h2>
          <p className="text-sm text-gray-600">Silakan coba lagi atau hubungi admin.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Consolidated state
interface AttendanceState {
  step: number;
  attendanceType: 'masuk' | 'keluar';
  isSubmitting: boolean;
  validLocation: boolean;
  userLocation: Location | null;
  distanceFromOffice: number | null;
  capturedFace: Blob | null;
  faceFingerprint: FaceFingerprint | null;
  storedFingerprint: FaceFingerprint | null;
  error: string | null;
  lastAttendance: AttendanceRecord | null;
  userProfile: User | null;
  cameraVerificationEnabled: boolean;
  officeLocation: OfficeLocation | null;
  isMobile: boolean;
  workHoursSettings: WorkHoursSettings;
}

const AttendanceForm: React.FC<AttendanceFormProps> = ({
  user,
  onAttendanceSubmitted,
  todayAttendance = [],
  onClose,
}) => {
  const [attendanceState, setAttendanceState] = useState<AttendanceState>({
    step: 1,
    attendanceType: 'masuk',
    isSubmitting: false,
    validLocation: false,
    userLocation: null,
    distanceFromOffice: null,
    capturedFace: null,
    faceFingerprint: null,
    storedFingerprint: null,
    error: null,
    lastAttendance: null,
    userProfile: null,
    cameraVerificationEnabled: true,
    officeLocation: null,
    isMobile: window.innerWidth < 640,
    workHoursSettings: {
      startTime: '08:00',
      endTime: '17:00',
      lateThreshold: 15,
      earlyLeaveThreshold: 15,
      breakDuration: 60,
    },
  });

  const updateAttendanceState = (updates: Partial<AttendanceState>): void => {
    setAttendanceState((prev) => ({ ...prev, ...updates }));
  };

  const isAlertShowing = useRef<boolean>(false);
  const validationAttempt = useRef<number>(0);

  // Debounce user location
  const debouncedUserLocation = useDebounce<Location | null>(attendanceState.userLocation, 500);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => updateAttendanceState({ isMobile: window.innerWidth < 640 });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Determine attendance type
  const determineAttendanceType = useCallback(() => {
    const masuk = todayAttendance.some((r) => r.type === 'masuk' && r.status === 'berhasil');
    const keluar = todayAttendance.some((r) => r.type === 'keluar' && r.status === 'berhasil');
    updateAttendanceState({ attendanceType: !masuk ? 'masuk' : !keluar ? 'keluar' : 'masuk' });
  }, [todayAttendance]);

  // Fetch initial data with fixed dependencies
  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        const [officeLocationRes, cameraSettingsRes, userProfileRes, lastAttendanceRes, workHoursRes] = await Promise.all([
          getOfficeLocation(),
          getCameraVerificationSettings(),
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase
            .from('attendance')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'berhasil')
            .order('timestamp', { ascending: false })
            .limit(1),
          supabase
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'work_hours')
            .single(),
        ]);

        if (!isMounted) return;

        const updates: Partial<AttendanceState> = {
          officeLocation: officeLocationRes,
          cameraVerificationEnabled: cameraSettingsRes.enabled,
          userProfile: userProfileRes.data as User,
          lastAttendance: lastAttendanceRes.data && lastAttendanceRes.data.length > 0 ? lastAttendanceRes.data[0] : null,
          workHoursSettings: workHoursRes.data?.setting_value
            ? { ...attendanceState.workHoursSettings, ...workHoursRes.data.setting_value }
            : attendanceState.workHoursSettings,
        };

        if (userProfileRes.data?.avatar_url && cameraSettingsRes.enabled) {
          const { fingerprint } = await processImageUrl(userProfileRes.data.avatar_url);
          updates.storedFingerprint = fingerprint;
        } else if (cameraSettingsRes.enabled) {
          updates.error = 'Foto profil belum tersedia. Lengkapi profil Anda.';
        }

        updateAttendanceState(updates);
        determineAttendanceType();
      } catch (err: unknown) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Gagal memuat data awal';
          updateAttendanceState({ error: errorMessage });
        }
      }
    };

    fetchInitialData();
    return () => {
      isMounted = false;
    };
  }, [user.id, determineAttendanceType]);

  // Show location error alert
  const showLocationErrorAlert = useCallback((distance: number) => {
    if (isAlertShowing.current) return;
    isAlertShowing.current = true;

    const distanceText =
      distance > 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`;

    Swal.fire({
      icon: 'error',
      title: 'Lokasi Tidak Valid',
      html: `Anda berada ${distanceText} dari kantor.<br><br>Silakan datang ke lokasi kantor untuk absensi.`,
      confirmButtonText: 'OK',
      confirmButtonColor: '#2563eb',
      customClass: {
        popup: 'swal2-custom',
        title: 'text-lg font-semibold',
        htmlContainer: 'text-sm',
      },
    }).then(() => {
      isAlertShowing.current = false;
      updateAttendanceState({
        validLocation: false,
        userLocation: null,
        distanceFromOffice: null,
        step: 1,
      });
    });
  }, []);

  // Handle location validation
  const handleLocationValidated = useCallback(
    (isValid: boolean, location: Location, distance: number) => {
      if (attendanceState.isSubmitting) return;
      validationAttempt.current += 1;
      const currentAttempt = validationAttempt.current;

      updateAttendanceState({
        distanceFromOffice: distance,
        validLocation: isValid,
        userLocation: location,
      });

      if (!isValid) {
        showLocationErrorAlert(distance);
        return;
      }

      Swal.fire({
        icon: 'success',
        title: 'Lokasi Terverifikasi',
        text: 'Anda berada di lokasi kantor',
        timer: 1500,
        showConfirmButton: false,
        customClass: {
          popup: 'swal2-custom',
          title: 'text-lg font-semibold',
        },
      }).then(() => {
        if (validationAttempt.current === currentAttempt) {
          updateAttendanceState({ step: attendanceState.cameraVerificationEnabled ? 2 : 3 });
        }
      });
    },
    [attendanceState.isSubmitting, attendanceState.cameraVerificationEnabled, showLocationErrorAlert]
  );

  // Handle face capture
  const handleFaceCapture = useCallback((photoBlob: Blob, fingerprint: FaceFingerprint) => {
    updateAttendanceState({ capturedFace: photoBlob, faceFingerprint: fingerprint });
    Swal.fire({
      icon: 'success',
      title: 'Wajah Terverifikasi',
      text: 'Wajah Anda berhasil dikenali',
      timer: 1500,
      showConfirmButton: false,
      customClass: {
        popup: 'swal2-custom',
        title: 'text-lg font-semibold',
      },
    }).then(() => {
      updateAttendanceState({ step: 3 });
    });
  }, []);

  // Verify face
  const verifyFace = async (): Promise<boolean> => {
    if (!attendanceState.cameraVerificationEnabled) return true;
    if (!attendanceState.faceFingerprint || !attendanceState.storedFingerprint) {
      throw new Error('Data wajah tidak lengkap');
    }
    const isMatch = compareFaceFingerprints(attendanceState.faceFingerprint, attendanceState.storedFingerprint, 0.7);
    if (!isMatch) {
      throw new Error('Wajah tidak cocok. Pastikan pencahayaan baik dan wajah terlihat jelas.');
    }
    return true;
  };

  // Calculate work details
  const calculateWorkDetails = useCallback((): { isLate: boolean; lateMinutes: number; workHours: number; overtimeHours: number } => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const { startTime, endTime, lateThreshold = 15, breakDuration = 60 } = attendanceState.workHoursSettings;
    let isLate = false;
    let lateMinutes = 0;
    let workHours = 0;
    let overtimeHours = 0;

    if (attendanceState.attendanceType === 'masuk') {
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const thresholdTime = new Date();
      thresholdTime.setHours(startHour, startMinute + lateThreshold, 0, 0);
      const thresholdTimeString = thresholdTime.toTimeString().slice(0, 5);
      isLate = currentTime > thresholdTimeString;
      if (isLate) {
        const startTimeDate = new Date(`1970-01-01T${startTime}:00`);
        const currentDateTime = new Date(`1970-01-01T${currentTime}:00`);
        lateMinutes = Math.floor((currentDateTime.getTime() - startTimeDate.getTime()) / 60000);
      }
    } else if (
      attendanceState.attendanceType === 'keluar' &&
      attendanceState.lastAttendance &&
      attendanceState.lastAttendance.type === 'masuk'
    ) {
      const checkInTime = new Date(attendanceState.lastAttendance.timestamp);
      const checkOutTime = now;
      const totalMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / 60000);
      const workMinutes = Math.max(0, totalMinutes - breakDuration);
      workHours = Math.max(0, workMinutes / 60);
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      const standardWorkMinutes =
        endHour * 60 + endMinute - (startHour * 60 + startMinute) - breakDuration;
      const standardWorkHours = standardWorkMinutes / 60;
      if (workHours > standardWorkHours) {
        overtimeHours = workHours - standardWorkHours;
        workHours = standardWorkHours;
      }
    }
    return { isLate, lateMinutes, workHours, overtimeHours };
  }, [attendanceState.attendanceType, attendanceState.lastAttendance, attendanceState.workHoursSettings]);

  // Check if within working hours
  const isWithinWorkingHours = useCallback((): boolean => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const { startTime, endTime } = attendanceState.workHoursSettings;
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const earlyStart = new Date();
    earlyStart.setHours(startHour, startMinute - 30, 0, 0);
    const earlyStartStr = earlyStart.toTimeString().slice(0, 5);

    const lateEnd = new Date();
    lateEnd.setHours(endHour, endMinute + 30, 0, 0);
    const lateEndStr = lateEnd.toTimeString().slice(0, 5);

    return attendanceState.attendanceType === 'masuk'
      ? currentTime >= earlyStartStr && currentTime <= lateEndStr
      : currentTime >= startTime && currentTime <= lateEndStr;
  }, [attendanceState.attendanceType, attendanceState.workHoursSettings]);

  // Submit attendance
  const submitAttendance = async (): Promise<void> => {
    if (!attendanceState.validLocation || !attendanceState.userLocation) {
      updateAttendanceState({
        error: 'Silakan selesaikan verifikasi lokasi terlebih dahulu',
        step: 1,
      });
      return;
    }
    if (attendanceState.cameraVerificationEnabled && !attendanceState.faceFingerprint) {
      updateAttendanceState({
        error: 'Silakan selesaikan verifikasi wajah terlebih dahulu',
        step: 2,
      });
      return;
    }
    if (!isWithinWorkingHours()) {
      Swal.fire({
        icon: 'warning',
        title: 'Di Luar Jam Kerja',
        html: `
          <div class="text-left text-sm">
            <p class="mb-2">Absensi ${attendanceState.attendanceType} hanya dapat dilakukan pada jam kerja:</p>
            <p class="mb-2"><strong>Jam Kerja:</strong> ${attendanceState.workHoursSettings.startTime} - ${attendanceState.workHoursSettings.endTime}</p>
            <p class="text-xs text-gray-600">Hubungi HRD untuk absensi di luar jam kerja.</p>
          </div>`,
        confirmButtonText: 'OK',
        confirmButtonColor: '#2563eb',
        customClass: {
          popup: 'swal2-custom',
        },
      });
      return;
    }

    const hasAlreadySubmitted = todayAttendance.some(
      (r) => r.type === attendanceState.attendanceType && r.status === 'berhasil'
    );
    if (hasAlreadySubmitted) {
      Swal.fire({
        icon: 'warning',
        title: 'Absensi Sudah Dilakukan',
        text: `Anda sudah melakukan absensi ${attendanceState.attendanceType} hari ini.`,
        confirmButtonText: 'OK',
        confirmButtonColor: '#2563eb',
        customClass: {
          popup: 'swal2-custom',
        },
      });
      return;
    }

    updateAttendanceState({ isSubmitting: true, error: null });

    try {
      if (attendanceState.cameraVerificationEnabled) await verifyFace();
      const now = new Date();
      const { isLate, lateMinutes, workHours, overtimeHours } = calculateWorkDetails();
      const dailySalary = attendanceState.userProfile?.salary ? attendanceState.userProfile.salary / 22 : 0;
      let dailySalaryEarned = 0;

      if (attendanceState.attendanceType === 'masuk') {
        if (isLate && lateMinutes > 15) {
          const deductionRate = Math.min(lateMinutes / 60 * 0.1, 0.5);
          dailySalaryEarned = dailySalary * (1 - deductionRate);
        } else {
          dailySalaryEarned = dailySalary;
        }
      }

      const attendanceData: AttendanceRecord & { user_id: string } = {
        user_id: user.id,
        type: attendanceState.attendanceType,
        timestamp: now.toISOString(),
        latitude: attendanceState.userLocation.latitude,
        longitude: attendanceState.userLocation.longitude,
        status: 'berhasil',
        is_late: isLate,
        late_minutes: lateMinutes,
        work_hours: workHours,
        overtime_hours: overtimeHours,
        daily_salary_earned: dailySalaryEarned,
        notes: `Absensi ${attendanceState.attendanceType} berhasil dengan verifikasi ${
          attendanceState.cameraVerificationEnabled ? 'wajah & ' : ''
        }lokasi. ${isLate ? `Terlambat ${lateMinutes} menit.` : 'Tepat waktu.'}`,
        ...(attendanceState.attendanceType === 'masuk' ? { check_in_time: now.toISOString() } : { check_out_time: now.toISOString() }),
      };

      const { data, error } = await supabase
        .from('attendance')
        .insert([attendanceData])
        .select()
        .single();

      if (error) throw error;

      await supabase.from('activity_logs').insert([
        {
          user_id: user.id,
          action_type: `attendance_${attendanceState.attendanceType}`,
          action_details: attendanceData,
          user_agent: navigator.userAgent,
        },
      ]);

      await Swal.fire({
        icon: 'success',
        title: `Absensi ${attendanceState.attendanceType === 'masuk' ? 'Masuk' : 'Keluar'} Berhasil`,
        html: `
          <div class="text-left text-sm">
            <p class="mb-2"><strong>Status:</strong> ${isLate ? `Terlambat ${lateMinutes} menit` : 'Tepat Waktu'}</p>
            ${workHours > 0 ? `<p class="mb-2"><strong>Jam Kerja:</strong> ${workHours.toFixed(1)} jam</p>` : ''}
            ${overtimeHours > 0 ? `<p class="mb-2"><strong>Lembur:</strong> ${overtimeHours.toFixed(1)} jam</p>` : ''}
            ${dailySalaryEarned > 0 ? `<p class="mb-2"><strong>Gaji Harian:</strong> ${formatCurrency(dailySalaryEarned)}</p>` : ''}
            <p class="text-xs text-gray-500 mt-3">${now.toLocaleString('id-ID')}</p>
          </div>`,
        confirmButtonText: 'Selesai',
        confirmButtonColor: '#10b981',
        timer: 4000,
        timerProgressBar: true,
        customClass: {
          popup: 'swal2-custom',
        },
        willClose: () => {
          onAttendanceSubmitted?.(data as AttendanceRecord);
          resetForm();
          onClose?.();
        },
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan saat absensi';
      const errorStatus =
        errorMessage.includes('wajah')
          ? attendanceState.cameraVerificationEnabled
            ? 'wajah_tidak_valid'
            : 'gagal'
          : errorMessage.includes('lokasi')
          ? 'lokasi_tidak_valid'
          : 'gagal';

      await supabase.from('attendance').insert([
        {
          user_id: user.id,
          type: attendanceState.attendanceType,
          timestamp: new Date().toISOString(),
          latitude: attendanceState.userLocation?.latitude ?? null,
          longitude: attendanceState.userLocation?.longitude ?? null,
          status: errorStatus,
          notes: `Absensi gagal: ${errorMessage}`,
        },
      ]);

      await Swal.fire({
        icon: 'error',
        title: `Absensi ${attendanceState.attendanceType === 'masuk' ? 'Masuk' : 'Keluar'} Gagal`,
        text: errorMessage,
        confirmButtonText: 'OK',
        confirmButtonColor: '#2563eb',
        customClass: {
          popup: 'swal2-custom',
        },
      });
      updateAttendanceState({ error: errorMessage, step: 1 });
    } finally {
      updateAttendanceState({ isSubmitting: false });
    }
  };

  // Reset form
  const resetForm = useCallback((): void => {
    validationAttempt.current += 1;
    updateAttendanceState({
      step: 1,
      validLocation: false,
      userLocation: null,
      distanceFromOffice: null,
      capturedFace: null,
      faceFingerprint: null,
      error: null,
    });
    determineAttendanceType();
  }, [determineAttendanceType]);

  const getCurrentTime = (): string =>
    new Date().toLocaleString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const formatCurrency = (amount: number): string =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);

  const hasCheckedIn = todayAttendance.some(
    (r) => r.type === 'masuk' && r.status === 'berhasil'
  );
  const hasCheckedOut = todayAttendance.some(
    (r) => r.type === 'keluar' && r.status === 'berhasil'
  );
  const canCheckIn = !hasCheckedIn;
  const canCheckOut = hasCheckedIn && !hasCheckedOut;

  if (attendanceState.cameraVerificationEnabled && !attendanceState.storedFingerprint && attendanceState.error?.includes('Foto profil')) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-auto">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 relative">
          <button
            className="absolute top-4 right-4 rounded-full p-1 hover:bg-gray-100 transition"
            onClick={onClose ?? (() => window.location.reload())}
            aria-label="Close"
          >
            <XCircle className="h-6 w-6 text-gray-500" />
          </button>
          <h2 className="text-xl font-bold text-center text-blue-700 mb-4">
            Absensi Karyawan
          </h2>
          <div className="bg-red-100 p-4 rounded-full flex items-center justify-center mb-4 mx-auto w-16 h-16">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 text-center">
            Verifikasi Wajah Diperlukan
          </h3>
          <p className="text-gray-600 mb-6 text-center text-sm">
            Anda perlu menambahkan foto wajah ke profil untuk keamanan sistem absensi.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.href = '/profile'}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center text-sm"
            >
              <Edit className="h-5 w-5 mr-2" />
              Lengkapi Profil
            </button>
            <button
              onClick={() => updateAttendanceState({ cameraVerificationEnabled: false })}
              className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors text-sm flex items-center justify-center"
            >
              Mode Tanpa Verifikasi Wajah
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (attendanceState.cameraVerificationEnabled && !attendanceState.storedFingerprint) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-auto">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 text-center relative">
          <button
            className="absolute top-4 right-4 rounded-full p-1 hover:bg-gray-100 transition"
            onClick={onClose ?? (() => window.location.reload())}
            aria-label="Close"
          >
            <XCircle className="h-6 w-6 text-gray-500" />
          </button>
          <h2 className="text-xl font-bold text-blue-700 mb-4">Absensi Karyawan</h2>
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Memuat sistem verifikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-auto">
      <div
        className={`relative w-full ${attendanceState.isMobile ? 'max-w-sm' : 'max-w-4xl'} bg-white rounded-2xl shadow-2xl mx-auto flex flex-col md:flex-row transition-all duration-300`}
        style={{ minHeight: attendanceState.isMobile ? 'auto' : '450px' }}
      >
        <button
          className="absolute top-4 right-4 z-10 rounded-full p-1 hover:bg-gray-100 transition"
          onClick={onClose ?? (() => window.location.reload())}
          aria-label="Close"
        >
          <XCircle className="h-6 w-6 text-gray-500" />
        </button>

        {/* Left Panel */}
        <div className="md:w-2/5 w-full bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold truncate">Absensi Karyawan</h2>
                <p className="text-sm opacity-80 truncate">{attendanceState.userProfile?.name ?? 'Pengguna'}</p>
              </div>
            </div>
            <p className="text-sm opacity-90 mb-4">{getCurrentTime()}</p>
            {attendanceState.lastAttendance && (
              <div className="p-3 bg-white/10 rounded-lg mb-4">
                <p className="text-sm truncate">
                  <span className="font-semibold">
                    {attendanceState.lastAttendance.type === 'masuk' ? 'Masuk' : 'Keluar'}:
                  </span>{' '}
                  {new Date(attendanceState.lastAttendance.timestamp).toLocaleString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            )}
            <div className="p-3 bg-white/10 rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${hasCheckedIn ? 'bg-green-400' : 'bg-yellow-400'}`}
                  ></div>
                  <span>Masuk: {hasCheckedIn ? '✓' : '○'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${hasCheckedOut ? 'bg-green-400' : 'bg-yellow-400'}`}
                  ></div>
                  <span>Keluar: {hasCheckedOut ? '✓' : '○'}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="hidden md:block mt-6">
            <div className="flex flex-col gap-4">
              {(() => {
                const allSteps = [
                  { id: 1, name: 'Lokasi', icon: <MapPin className="h-5 w-5" /> },
                  { id: 2, name: 'Wajah', icon: <Camera className="h-5 w-5" /> },
                  { id: 3, name: 'Kirim', icon: <CheckCircle className="h-5 w-5" /> },
                ];
                const steps = attendanceState.cameraVerificationEnabled
                  ? allSteps
                  : [allSteps[0], allSteps[2]];
                return steps.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-300
                      ${attendanceState.step >= s.id ? 'bg-white text-blue-700' : 'bg-blue-700 text-white border border-white/40'}`}
                    >
                      {s.icon}
                    </div>
                    <span
                      className={`text-sm ${attendanceState.step >= s.id ? 'text-white' : 'text-white/60'}`}
                    >
                      {s.name}
                    </span>
                    {idx < steps.length - 1 && (
                      <span className="flex-1 h-px mx-2 bg-white/30"></span>
                    )}
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 p-6 flex flex-col">
          {/* Mobile Progress Bar */}
          <div className="block md:hidden mb-4">
            <div className="flex items-center w-full gap-2">
              {(() => {
                const allSteps = [
                  { id: 1, name: 'Lokasi' },
                  { id: 2, name: 'Wajah' },
                  { id: 3, name: 'Kirim' },
                ];
                const steps = attendanceState.cameraVerificationEnabled
                  ? allSteps
                  : [allSteps[0], allSteps[2]];
                return steps.map((s, idx) => (
                  <React.Fragment key={s.id}>
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs
                        ${attendanceState.step >= s.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}
                      >
                        {attendanceState.step > s.id ? <CheckCircle className="h-4 w-4" /> : s.id}
                      </div>
                      <span
                        className={`text-xs mt-1 ${attendanceState.step >= s.id ? 'text-blue-700 font-medium' : 'text-gray-500'}`}
                      >
                        {s.name}
                      </span>
                    </div>
                    {idx < steps.length - 1 && (
                      <div className="flex-1 h-1 bg-gray-200">
                        <div
                          className={`h-1 ${attendanceState.step > s.id ? 'bg-blue-600' : ''}`}
                          style={{ width: attendanceState.step > s.id ? '100%' : '0%', transition: 'width 0.3s' }}
                        ></div>
                      </div>
                    )}
                  </React.Fragment>
                ));
              })()}
            </div>
          </div>

          {/* Back Button */}
          {attendanceState.step > 1 && (
            <button
              onClick={() => updateAttendanceState({ step: attendanceState.step - 1 })}
              className="md:hidden flex items-center text-blue-600 mb-4 text-sm"
            >
              <ChevronLeft className="h-5 w-5 mr-1" />
              Kembali
            </button>
          )}

          {/* Attendance Type */}
          <div className="mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => updateAttendanceState({ attendanceType: 'masuk' })}
                disabled={!canCheckIn}
                className={`flex-1 p-3 rounded-lg border-2 transition-all flex flex-col items-center text-sm
                  ${attendanceState.attendanceType === 'masuk' ? 'border-blue-600 bg-blue-50 text-blue-700' : canCheckIn ? 'border-gray-200 hover:border-gray-300' : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'}`}
              >
                <Clock className="h-5 w-5 mb-1" />
                <span className="font-medium">Masuk</span>
                {!canCheckIn && <span className="text-xs mt-1">Sudah</span>}
              </button>
              <button
                onClick={() => updateAttendanceState({ attendanceType: 'keluar' })}
                disabled={!canCheckOut}
                className={`flex-1 p-3 rounded-lg border-2 transition-all flex flex-col items-center text-sm
                  ${attendanceState.attendanceType === 'keluar' ? 'border-blue-600 bg-blue-50 text-blue-700' : canCheckOut ? 'border-gray-200 hover:border-gray-300' : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'}`}
              >
                <Clock className="h-5 w-5 mb-1" />
                <span className="font-medium">Keluar</span>
                {!canCheckOut && (
                  <span className="text-xs mt-1">{!hasCheckedIn ? 'Belum masuk' : 'Sudah'}</span>
                )}
              </button>
            </div>
          </div>

          {/* Step Content */}
          <div className="flex-1 overflow-auto">
            {attendanceState.step === 1 && (
              <div className="h-full flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  <h3 className="text-base font-semibold">Verifikasi Lokasi</h3>
                </div>
                {attendanceState.officeLocation && (
                  <div className="mb-3 p-3 bg-blue-50 rounded-lg text-sm">
                    <p className="text-blue-700">
                      <strong>Lokasi Kantor:</strong> {attendanceState.officeLocation.name}
                      <br />
                      <strong>Alamat:</strong> {attendanceState.officeLocation.address}
                    </p>
                  </div>
                )}
                <div className="flex-1">
                  <LocationValidator
                    onLocationValidated={handleLocationValidated}
                    officeLocation={attendanceState.officeLocation}
                    isMobile={attendanceState.isMobile}
                    shouldValidate={!attendanceState.isSubmitting && attendanceState.step === 1}
                    validationAttempt={validationAttempt.current}
                  />
                </div>
                <div className="mt-3 p-3 bg-yellow-50 rounded-lg text-sm">
                  <p className="text-yellow-700">
                    <strong>Perhatian:</strong> Pastikan GPS aktif dan Anda berada di area kantor.
                  </p>
                </div>
              </div>
            )}
            {attendanceState.step === 2 && attendanceState.cameraVerificationEnabled && (
              <div className="h-full flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <Camera className="h-5 w-5 text-blue-600" />
                  <h3 className="text-base font-semibold">Verifikasi Wajah</h3>
                </div>
                <div className="mb-3 p-3 bg-blue-50 rounded-lg text-sm">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <p className="text-blue-700 font-medium">Tips Verifikasi Wajah</p>
                      <ul className="list-disc ml-4 mt-1 space-y-1 text-sm">
                        <li>Pastikan pencahayaan cukup terang</li>
                        <li>Hadap wajah lurus ke kamera</li>
                        <li>Hindari memakai masker atau kacamata gelap</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <CustomFaceCapture
                    onFaceCapture={handleFaceCapture}
                    isCapturing={attendanceState.isSubmitting}
                    isMobile={attendanceState.isMobile}
                  />
                </div>
              </div>
            )}
            {attendanceState.step === 3 && (
              <div className="h-full flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  <h3 className="text-base font-semibold">Konfirmasi Absensi</h3>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm flex-1">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Lokasi:</span>
                      <span className="flex items-center text-green-600 font-medium">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Terverifikasi
                      </span>
                    </div>
                    {attendanceState.cameraVerificationEnabled && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Wajah:</span>
                        <span className="flex items-center text-green-600 font-medium">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Terverifikasi
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Jenis Absensi:</span>
                      <span className="font-medium">
                        {attendanceState.attendanceType === 'masuk' ? 'Masuk' : 'Keluar'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Waktu:</span>
                      <span className="font-medium">
                        {new Date().toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {attendanceState.distanceFromOffice && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Jarak dari Kantor:</span>
                        <span className="font-medium">
                          {attendanceState.distanceFromOffice > 1000
                            ? `${(attendanceState.distanceFromOffice / 1000).toFixed(1)} km`
                            : `${Math.round(attendanceState.distanceFromOffice)} m`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={resetForm}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                    disabled={attendanceState.isSubmitting}
                  >
                    Mulai Ulang
                  </button>
                  <button
                    onClick={submitAttendance}
                    disabled={attendanceState.isSubmitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center justify-center"
                  >
                    {attendanceState.isSubmitting ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Mengirim...
                      </>
                    ) : (
                      'Kirim Absensi'
                    )}
                  </button>
                </div>
              </div>
            )}
            {attendanceState.error && !attendanceState.error.includes('Foto profil') && (
              <div className="mt-3 p-3 bg-red-50 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <p className="text-red-700 font-medium text-sm">Gagal Melakukan Absensi</p>
                  <p className="text-red-600 text-sm mt-1">{attendanceState.error}</p>
                  <button
                    onClick={resetForm}
                    className="mt-1 text-sm text-red-700 underline hover:text-red-800"
                  >
                    Coba Lagi
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function WrappedAttendanceForm(props: AttendanceFormProps) {
  return (
    <ErrorBoundary>
      <AttendanceForm {...props} />
    </ErrorBoundary>
  );
};