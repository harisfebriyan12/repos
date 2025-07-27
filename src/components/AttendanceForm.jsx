import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
  Clock, MapPin, Camera, CheckCircle, AlertCircle,
  User, Edit, XCircle, Info, ChevronLeft
} from 'lucide-react';
import {
  supabase, getOfficeLocation, getCameraVerificationSettings
} from '../utils/supabaseClient';
import {
  processImageUrl, compareFaceFingerprints
} from '../utils/customFaceRecognition';
import CustomFaceCapture from './CustomFaceCapture';
import LocationValidator from './LocationValidator';

// Responsive, modern, attractive Attendance Form
const AttendanceForm = ({
  user,
  onAttendanceSubmitted,
  todayAttendance = [],
  onClose // <-- optional: parent can pass a close handler
}) => {
  // --- State ---
  const [attendanceType, setAttendanceType] = useState('masuk');
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validLocation, setValidLocation] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [capturedFace, setCapturedFace] = useState(null);
  const [faceFingerprint, setFaceFingerprint] = useState(null);
  const [storedFingerprint, setStoredFingerprint] = useState(null);
  const [error, setError] = useState(null);
  const [lastAttendance, setLastAttendance] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [cameraVerificationEnabled, setCameraVerificationEnabled] = useState(true);
  const [officeLocation, setOfficeLocation] = useState(null);
  const [distanceFromOffice, setDistanceFromOffice] = useState(null);
  const [workHoursSettings, setWorkHoursSettings] = useState({
    startTime: '08:00',
    endTime: '17:00',
    lateThreshold: 15,
    earlyLeaveThreshold: 15,
    breakDuration: 60
  });

  // Responsive: detect mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 480);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 480);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Fetch Data ---
  useEffect(() => {
    fetchUserProfile();
    fetchLastAttendance();
    determineAttendanceType();
    fetchCameraSettings();
    fetchOfficeLocation();
    fetchWorkHoursSettings();
    // eslint-disable-next-line
  }, [user, todayAttendance]);

  // --- Fetchers ---
  const fetchOfficeLocation = async () => {
    try {
      const location = await getOfficeLocation();
      setOfficeLocation(location);
    } catch {}
  };
  const fetchWorkHoursSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'work_hours')
        .single();
      if (data?.setting_value) {
        setWorkHoursSettings(prev => ({ ...prev, ...data.setting_value }));
      }
    } catch {}
  };
  const fetchCameraSettings = async () => {
    try {
      const settings = await getCameraVerificationSettings();
      setCameraVerificationEnabled(settings.enabled);
    } catch {
      setCameraVerificationEnabled(true);
    }
  };
  const determineAttendanceType = () => {
    const masuk = todayAttendance.some(r => r.type === 'masuk' && r.status === 'berhasil');
    const keluar = todayAttendance.some(r => r.type === 'keluar' && r.status === 'berhasil');
    setAttendanceType(!masuk ? 'masuk' : (!keluar ? 'keluar' : 'masuk'));
  };
  const fetchUserProfile = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setUserProfile(data);
      if (data.avatar_url && cameraVerificationEnabled) {
        try {
          const result = await processImageUrl(data.avatar_url);
          setStoredFingerprint(result.fingerprint);
        } catch {
          setError('Gagal memuat data wajah. Hubungi admin.');
        }
      } else if (cameraVerificationEnabled) {
        setError('Foto profil belum tersedia. Lengkapi profil Anda.');
      }
    } catch {
      setError('Gagal memuat profil pengguna.');
    }
  };
  const fetchLastAttendance = async () => {
    try {
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'berhasil')
        .order('timestamp', { ascending: false })
        .limit(1);
      setLastAttendance(data && data.length > 0 ? data[0] : null);
    } catch {}
  };

  // --- Logic ---
  const showLocationErrorAlert = (distance) => {
    let msg = distance > 1000
      ? `Anda berada ${(distance / 1000).toFixed(1)} km dari kantor.`
      : '';
    msg += '<br/><br/>Datang ke kantor untuk absensi.';
    Swal.fire({
      icon: 'error',
      title: 'Anda di luar lokasi kantor',
      html: msg,
      confirmButtonText: 'OK',
      confirmButtonColor: '#3085d6',
    });
  };
  const handleLocationValidated = (isValid, location, distance) => {
    setDistanceFromOffice(distance);
    if (!isValid) {
      showLocationErrorAlert(distance);
      setValidLocation(false);
      return;
    }
    setValidLocation(true);
    setUserLocation(location);
    Swal.fire({
      icon: 'success',
      title: 'Lokasi Valid',
      text: 'Anda berada di lokasi kantor',
      timer: 1200,
      showConfirmButton: false
    });
    setStep(cameraVerificationEnabled ? 2 : 3);
  };
  const handleFaceCapture = (photoBlob, fingerprint) => {
    setCapturedFace(photoBlob);
    setFaceFingerprint(fingerprint);
    Swal.fire({
      icon: 'success',
      title: 'Wajah Terverifikasi',
      text: 'Wajah Anda berhasil dikenali',
      timer: 1200,
      showConfirmButton: false
    });
    setStep(3);
  };
  const verifyFace = async () => {
    if (!cameraVerificationEnabled) return true;
    if (!faceFingerprint || !storedFingerprint) throw new Error('Data wajah tidak tersedia');
    const isMatch = compareFaceFingerprints(faceFingerprint, storedFingerprint, 0.7);
    if (!isMatch) throw new Error('Wajah tidak cocok. Pastikan pencahayaan baik.');
    return true;
  };
  const calculateWorkDetails = () => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const { startTime, endTime, lateThreshold = 15, breakDuration = 60 } = workHoursSettings;
    let isLate = false, lateMinutes = 0, workHours = 0, overtimeHours = 0;
    if (attendanceType === 'masuk') {
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const thresholdTime = new Date();
      thresholdTime.setHours(startHour, startMinute + lateThreshold, 0, 0);
      const thresholdTimeString = thresholdTime.toTimeString().slice(0, 5);
      isLate = currentTime > thresholdTimeString;
      if (isLate) {
        const startTimeDate = new Date(`1970-01-01T${startTime}:00`);
        const currentDateTime = new Date(`1970-01-01T${currentTime}:00`);
        lateMinutes = Math.floor((currentDateTime - startTimeDate) / 60000);
      }
    } else if (attendanceType === 'keluar' && lastAttendance && lastAttendance.type === 'masuk') {
      const checkInTime = new Date(lastAttendance.timestamp);
      const checkOutTime = now;
      const totalMinutes = Math.floor((checkOutTime - checkInTime) / 60000);
      const workMinutes = Math.max(0, totalMinutes - breakDuration);
      workHours = Math.max(0, workMinutes / 60);
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      const standardWorkMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute) - breakDuration;
      const standardWorkHours = standardWorkMinutes / 60;
      if (workHours > standardWorkHours) {
        overtimeHours = workHours - standardWorkHours;
        workHours = standardWorkHours;
      }
    }
    return { isLate, lateMinutes, workHours, overtimeHours };
  };
  const isWithinWorkingHours = () => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const { startTime, endTime } = workHoursSettings;
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const earlyStart = new Date();
    earlyStart.setHours(startHour, startMinute - 30, 0, 0);
    const earlyStartStr = earlyStart.toTimeString().slice(0, 5);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const lateEnd = new Date();
    lateEnd.setHours(endHour, endMinute + 30, 0, 0);
    const lateEndStr = lateEnd.toTimeString().slice(0, 5);
    if (attendanceType === 'masuk')
      return currentTime >= earlyStartStr && currentTime <= lateEndStr;
    if (attendanceType === 'keluar')
      return currentTime >= startTime && currentTime <= lateEndStr;
    return true;
  };
  const submitAttendance = async () => {
    if (!validLocation || !userLocation) {
      setError('Silakan selesaikan verifikasi lokasi');
      return;
    }
    if (cameraVerificationEnabled && !faceFingerprint) {
      setError('Silakan selesaikan verifikasi wajah');
      return;
    }
    if (!isWithinWorkingHours()) {
      const { startTime, endTime } = workHoursSettings;
      Swal.fire({
        icon: 'warning',
        title: 'Di Luar Jam Kerja',
        html: `
        <div class="text-left">
          <p class="mb-2">Absensi ${attendanceType} hanya dapat dilakukan pada jam kerja:</p>
          <p class="mb-2"><strong>Jam Kerja:</strong> ${startTime} - ${endTime}</p>
          <p class="text-sm text-gray-600">Jika Anda perlu absensi di luar jam kerja, hubungi HRD.</p>
        </div>`,
        confirmButtonText: 'OK',
        confirmButtonColor: '#3085d6'
      });
      return;
    }
    const hasAlreadySubmitted = todayAttendance.some(r => r.type === attendanceType && r.status === 'berhasil');
    if (hasAlreadySubmitted) {
      Swal.fire({
        icon: 'warning',
        title: 'Absensi Sudah Dilakukan',
        text: `Anda sudah melakukan absensi ${attendanceType} hari ini.`,
        confirmButtonText: 'OK'
      });
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      if (cameraVerificationEnabled) await verifyFace();
      const now = new Date();
      const { isLate, lateMinutes, workHours, overtimeHours } = calculateWorkDetails();
      const dailySalary = userProfile?.salary ? userProfile.salary / 22 : 0;
      let dailySalaryEarned = 0;
      if (attendanceType === 'masuk') {
        if (isLate && lateMinutes > 15) {
          const deductionRate = Math.min(lateMinutes / 60 * 0.1, 0.5);
          dailySalaryEarned = dailySalary * (1 - deductionRate);
        } else {
          dailySalaryEarned = dailySalary;
        }
      }
      const attendanceData = {
        user_id: user.id,
        type: attendanceType,
        timestamp: now.toISOString(),
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        status: 'berhasil',
        is_late: isLate,
        late_minutes: lateMinutes,
        work_hours: workHours,
        overtime_hours: overtimeHours,
        daily_salary_earned: dailySalaryEarned,
        notes: `Absensi ${attendanceType} berhasil dengan verifikasi ${cameraVerificationEnabled ? 'wajah & ' : ''}lokasi. ${isLate ? `Terlambat ${lateMinutes} menit.` : 'Tepat waktu.'}`
      };
      if (attendanceType === 'masuk') attendanceData.check_in_time = now.toISOString();
      else attendanceData.check_out_time = now.toISOString();
      const { data, error } = await supabase
        .from('attendance')
        .insert([attendanceData])
        .select();
      if (error) throw error;
      await supabase.from('activity_logs').insert([{
        user_id: user.id,
        action_type: `attendance_${attendanceType}`,
        action_details: attendanceData,
        user_agent: navigator.userAgent
      }]);
      await Swal.fire({
        icon: 'success',
        title: `Absensi ${attendanceType === 'masuk' ? 'Masuk' : 'Keluar'} Berhasil`,
        html: `
        <div class="text-left">
          <p class="mb-2"><strong>Status:</strong> ${isLate ? `Terlambat ${lateMinutes} menit` : 'Tepat Waktu'}</p>
          ${workHours > 0 ? `<p class="mb-2"><strong>Jam Kerja:</strong> ${workHours.toFixed(1)} jam</p>` : ''}
          ${overtimeHours > 0 ? `<p class="mb-2"><strong>Lembur:</strong> ${overtimeHours.toFixed(1)} jam</p>` : ''}
          ${dailySalaryEarned > 0 ? `<p class="mb-2"><strong>Gaji Harian:</strong> ${formatCurrency(dailySalaryEarned)}</p>` : ''}
          <p class="text-sm text-gray-500 mt-3">${now.toLocaleString('id-ID')}</p>
        </div>`,
        confirmButtonText: 'Selesai',
        confirmButtonColor: '#10b981',
        timer: 3500,
        timerProgressBar: true,
        willClose: () => {
          if (onAttendanceSubmitted) onAttendanceSubmitted(data[0]);
          resetForm();
        }
      });
    } catch (err) {
      let errorStatus = 'gagal';
      if (err.message.includes('wajah')) errorStatus = cameraVerificationEnabled ? 'wajah_tidak_valid' : 'gagal';
      else if (err.message.includes('lokasi')) errorStatus = 'lokasi_tidak_valid';
      await supabase.from('attendance').insert([{
        user_id: user.id,
        type: attendanceType,
        timestamp: new Date().toISOString(),
        latitude: userLocation?.latitude || null,
        longitude: userLocation?.longitude || null,
        status: errorStatus,
        notes: `Absensi gagal: ${err.message}`
      }]);
      await Swal.fire({
        icon: 'error',
        title: `Absensi ${attendanceType === 'masuk' ? 'Masuk' : 'Keluar'} Gagal`,
        text: err.message || 'Terjadi kesalahan saat absensi',
        confirmButtonText: 'OK',
        confirmButtonColor: '#3085d6'
      });
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  const resetForm = () => {
    setStep(1);
    setValidLocation(false);
    setUserLocation(null);
    setCapturedFace(null);
    setFaceFingerprint(null);
    setError(null);
    fetchLastAttendance();
  };
  const getCurrentTime = () =>
    new Date().toLocaleString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  const formatCurrency = (amount) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', minimumFractionDigits: 0
    }).format(amount);

  // --- Quick status helpers
  const hasCheckedIn = todayAttendance.some(r => r.type === 'masuk' && r.status === 'berhasil');
  const hasCheckedOut = todayAttendance.some(r => r.type === 'keluar' && r.status === 'berhasil');
  const canCheckIn = !hasCheckedIn;
  const canCheckOut = hasCheckedIn && !hasCheckedOut;

  // --- Loading/Profile Setup Block
  if (cameraVerificationEnabled && !storedFingerprint) {
    if (error && error.includes('Foto profil')) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-2 py-2 overflow-auto">
          <div className="w-full max-w-xs bg-white rounded-2xl shadow-xl mx-auto p-4 relative">
            <button
              className="absolute top-2 right-2 rounded-full p-1 hover:bg-gray-100 transition"
              aria-label="Close"
              onClick={onClose || (() => window.location.reload())}
            >
              <XCircle className="h-5 w-5 text-gray-500" />
            </button>
            <h2 className="text-lg font-bold text-center text-blue-700 mb-2">Absensi Karyawan</h2>
            <div className="bg-red-100 p-3 rounded-full flex items-center justify-center mb-4 mx-auto w-12 h-12">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-2 text-center">Verifikasi Wajah Diperlukan</h3>
            <p className="text-gray-600 mb-4 text-center text-xs">
              Untuk keamanan sistem absensi, Anda perlu menambahkan foto wajah ke profil terlebih dahulu.
            </p>
            <button
              onClick={() => window.location.href = '/profile'}
              className="w-full bg-blue-600 text-white py-2 px-3 rounded-lg font-medium hover:bg-blue-700 transition-colors mb-2 flex items-center justify-center text-xs"
            >
              <Edit className="h-4 w-4 mr-2" />
              Lengkapi Profil
            </button>
            <button
              onClick={() => setCameraVerificationEnabled(false)}
              className="w-full bg-gray-200 text-gray-800 py-2 px-3 rounded-lg font-medium hover:bg-gray-300 transition-colors text-xs flex items-center justify-center"
            >
              Mode Tanpa Verifikasi Wajah
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-2 py-2 overflow-auto">
        <div className="w-full max-w-xs bg-white rounded-2xl shadow-xl mx-auto p-4 text-center relative">
          <button
            className="absolute top-2 right-2 rounded-full p-1 hover:bg-gray-100 transition"
            aria-label="Close"
            onClick={onClose || (() => window.location.reload())}
          >
            <XCircle className="h-5 w-5 text-gray-500" />
          </button>
          <h2 className="text-lg font-bold text-blue-700 mb-2">Absensi Karyawan</h2>
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-xs">Menyiapkan sistem verifikasi...</p>
        </div>
      </div>
    );
  }

  // --- Main Card Container Responsive ---
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-2 py-2 overflow-auto">
      <div
        className={`relative w-full ${isMobile ? "max-w-xs" : "max-w-3xl"} bg-white rounded-2xl shadow-2xl mx-auto flex flex-col md:flex-row transition-all`}
        style={{
          minHeight: isMobile ? 'auto' : 420,
          fontSize: isMobile ? '13px' : '15px'
        }}
      >
        {/* CLOSE BUTTON */}
        <button
          className="absolute top-2 right-2 z-10 rounded-full p-1 hover:bg-gray-100 transition"
          aria-label="Close"
          onClick={onClose || (() => window.location.reload())}
        >
          <XCircle className="h-5 w-5 text-gray-500" />
        </button>
        {/* LEFT PANEL (Info & Progress) */}
        <div className="md:w-2/5 w-full bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none px-4 py-4 flex flex-col justify-between min-h-0">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <User className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold truncate">Absensi</h2>
                <p className="text-2xs opacity-80 truncate">{userProfile?.name || 'Pengguna'}</p>
              </div>
            </div>
            <p className="text-2xs opacity-90">{getCurrentTime()}</p>
            {lastAttendance && (
              <div className="mt-2 p-2 bg-white/10 rounded-lg">
                <p className="text-2xs truncate">
                  Terakhir: <span className="font-semibold">
                    {lastAttendance.type === 'masuk' ? 'Masuk' : 'Keluar'}
                  </span> {new Date(lastAttendance.timestamp).toLocaleString('id-ID', {
                    hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>
            )}
            <div className="mt-2 p-2 bg-white/10 rounded-lg">
              <div className="grid grid-cols-2 gap-1 text-2xs">
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${hasCheckedIn ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                  <span>Masuk:</span>
                  <span className="font-medium">{hasCheckedIn ? '✓' : '○'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${hasCheckedOut ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                  <span>Keluar:</span>
                  <span className="font-medium">{hasCheckedOut ? '✓' : '○'}</span>
                </div>
              </div>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="hidden md:block mt-3">
            <div className="flex flex-col gap-3">
              {(() => {
                const allSteps = [
                  { id: 1, name: 'Lokasi', icon: <MapPin className="h-4 w-4" /> },
                  { id: 2, name: 'Wajah', icon: <Camera className="h-4 w-4" /> },
                  { id: 3, name: 'Kirim', icon: <CheckCircle className="h-4 w-4" /> },
                ];
                const steps = cameraVerificationEnabled ? allSteps : [allSteps[0], allSteps[2]];
                return steps.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-medium text-xs transition-all duration-300
                      ${step >= s.id ? 'bg-white text-blue-700' : 'bg-blue-700 text-white border border-white/40'}`}>
                      {s.icon}
                    </div>
                    <span className={`font-medium ${step >= s.id ? 'text-white' : 'text-white/60'} text-xs`}>{s.name}</span>
                    {idx < steps.length - 1 && <span className="flex-1 h-px mx-2 bg-white/30"></span>}
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL (Form) */}
        <div className="flex-1 w-full px-2 py-4 sm:px-4 flex flex-col justify-center min-h-0">
          {/* Progress Bar Mobile */}
          <div className="block md:hidden mb-2">
            <div className="flex items-center w-full gap-1 justify-between">
              {(() => {
                const allSteps = [
                  { id: 1, name: 'Lokasi' },
                  { id: 2, name: 'Wajah' },
                  { id: 3, name: 'Kirim' }
                ];
                const steps = cameraVerificationEnabled ? allSteps : [allSteps[0], allSteps[2]];
                
                return (
                  <div className="flex items-center w-full">
                    {steps.map((s, idx) => (
                      <React.Fragment key={s.id}>
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center font-medium text-2xs
                            ${step >= s.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                            {step > s.id ? <CheckCircle className="h-3 w-3" /> : s.id}
                          </div>
                          <span className={`text-2xs mt-0.5 ${step >= s.id ? 'text-blue-700 font-medium' : 'text-gray-500'}`}>{s.name}</span>
                        </div>
                        {idx < steps.length - 1 && (
                          <div className={`flex-1 h-1 mx-0.5 bg-gray-200`}>
                            <div className={`h-1 ${step > s.id ? 'bg-blue-600' : ''}`} style={{ width: step > s.id ? '100%' : '0%', transition: 'width 0.3s' }}></div>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Back button for mobile */}
          {step > 1 && (
            <button 
              onClick={() => setStep(step - 1)}
              className="md:hidden flex items-center text-blue-600 mb-2"
              style={{fontSize:'12px'}}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              <span>Kembali</span>
            </button>
          )}

          {/* Attendance Type */}
          <div className="mb-3">
            <div className="flex gap-1">
              <button
                onClick={() => setAttendanceType('masuk')}
                disabled={!canCheckIn}
                className={`flex-1 p-1.5 rounded-lg border-2 transition-all flex flex-col items-center ${
                  attendanceType === 'masuk'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : canCheckIn
                      ? 'border-gray-200 hover:border-gray-300'
                      : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                }`}
                style={{fontSize:'12px'}}
              >
                <Clock className="h-4 w-4 mb-0.5" />
                <span className="font-medium">Masuk</span>
                {!canCheckIn && <span className="text-2xs mt-0.5">Sudah</span>}
              </button>
              <button
                onClick={() => setAttendanceType('keluar')}
                disabled={!canCheckOut}
                className={`flex-1 p-1.5 rounded-lg border-2 transition-all flex flex-col items-center ${
                  attendanceType === 'keluar'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : canCheckOut
                      ? 'border-gray-200 hover:border-gray-300'
                      : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                }`}
                style={{fontSize:'12px'}}
              >
                <Clock className="h-4 w-4 mb-0.5" />
                <span className="font-medium">Keluar</span>
                {!canCheckOut && (
                  <span className="text-2xs mt-0.5">
                    {!hasCheckedIn ? 'Belum masuk' : 'Sudah'}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Step Content */}
          <div className="mb-2 flex-1 overflow-auto min-h-[120px]">
            {step === 1 && (
              <div className="h-full flex flex-col">
                <div className="flex items-center gap-1 mb-1">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  <h3 className="text-xs font-semibold">Verifikasi Lokasi</h3>
                </div>
                {officeLocation && (
                  <div className="mb-1 p-1 bg-blue-50 rounded-lg text-2xs">
                    <p className="text-blue-700">
                      <strong>Lokasi Kantor:</strong> {officeLocation.name}<br />
                      <strong>Alamat:</strong> {officeLocation.address}
                    </p>
                  </div>
                )}
                <div className="flex-1">
                  <LocationValidator
                    onLocationValidated={handleLocationValidated}
                    officeLocation={officeLocation}
                    isMobile={isMobile}
                  />
                </div>
                <div className="mt-1 p-1 bg-yellow-50 rounded-lg">
                  <p className="text-2xs text-yellow-700">
                    <strong>Perhatian:</strong> Aktifkan GPS dan pastikan di area kantor.
                  </p>
                </div>
              </div>
            )}
            {step === 2 && cameraVerificationEnabled && (
              <div className="h-full flex flex-col">
                <div className="flex items-center gap-1 mb-1">
                  <Camera className="h-4 w-4 text-blue-600" />
                  <h3 className="text-xs font-semibold">Verifikasi Wajah</h3>
                </div>
                <div className="mb-1 p-1 bg-blue-50 rounded-lg text-2xs">
                  <div className="flex items-start gap-1">
                    <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-blue-700 font-medium">Tips Wajah</p>
                      <ul className="list-disc ml-3 mt-0.5 space-y-0.5">
                        <li>Pencahayaan terang</li>
                        <li>Wajah lurus ke kamera</li>
                        <li>Jangan pakai masker/kaca gelap</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <CustomFaceCapture
                    onFaceCapture={handleFaceCapture}
                    isCapturing={isSubmitting}
                    isMobile={isMobile}
                  />
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="h-full flex flex-col">
                <div className="flex items-center gap-1 mb-1">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <h3 className="text-xs font-semibold">Konfirmasi Absensi</h3>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 mb-2 text-2xs flex-1">
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Lokasi:</span>
                      <span className="flex items-center text-green-600 font-medium">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Terverifikasi
                      </span>
                    </div>
                    {cameraVerificationEnabled && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Wajah:</span>
                        <span className="flex items-center text-green-600 font-medium">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Terverifikasi
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Jenis Absensi:</span>
                      <span className="font-medium">
                        {attendanceType === 'masuk' ? 'Masuk' : 'Keluar'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Waktu:</span>
                      <span className="font-medium">
                        {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {distanceFromOffice && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Jarak dari Kantor:</span>
                        <span className="font-medium">
                          {distanceFromOffice > 1000
                            ? `${(distanceFromOffice / 1000).toFixed(1)} km`
                            : `${Math.round(distanceFromOffice)} m`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-1">
                  <button
                    onClick={resetForm}
                    className="flex-1 px-2 py-1 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-2xs sm:text-xs"
                  >
                    Mulai Ulang
                  </button>
                  <button
                    onClick={submitAttendance}
                    disabled={isSubmitting}
                    className="flex-1 px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-2xs sm:text-xs flex items-center justify-center"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
            {/* Error Display */}
            {error && !error.includes('Foto profil') && (
              <div className="mt-2 p-2 bg-red-50 rounded-lg flex items-start gap-1">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-700 font-medium text-2xs sm:text-xs">Gagal Melakukan Absensi</p>
                  <p className="text-red-600 text-2xs sm:text-xs mt-0.5">{error}</p>
                  <button
                    onClick={resetForm}
                    className="mt-0.5 text-2xs sm:text-xs text-red-700 underline hover:text-red-800"
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

export default AttendanceForm;