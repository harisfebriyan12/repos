import React, { useState, useEffect, useCallback } from 'react';
import Swal from '../pages/swal';
import { Clock, MapPin, Camera, CheckCircle, AlertCircle, User, Edit, Bell } from 'lucide-react';
import { supabase, getOfficeLocation, getCameraVerificationSettings } from '../utils/supabaseClient';
import { processImageUrl, compareFaceFingerprints } from '../utils/customFaceRecognition';
import CustomFaceCapture from './CustomFaceCapture';
import LocationValidator from './LocationValidator';

const AttendanceForm = ({ user, onAttendanceSubmitted, todayAttendance = [] }) => {
  const [attendanceType, setAttendanceType] = useState('masuk');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validLocation, setValidLocation] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [capturedFace, setCapturedFace] = useState(null);
  const [faceFingerprint, setFaceFingerprint] = useState(null);
  const [storedFingerprint, setStoredFingerprint] = useState(null);
  const [step, setStep] = useState(1); // 1: Location, 2: Face, 3: Submit
  const [error, setError] = useState(null);
  const [lastAttendance, setLastAttendance] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [cameraVerificationEnabled, setCameraVerificationEnabled] = useState(true);

  useEffect(() => {
    fetchUserProfile();
    fetchLastAttendance();
    determineAttendanceType();
    fetchCameraSettings();
  }, [user, todayAttendance]);

  const fetchCameraSettings = async () => {
    try {
      const settings = await getCameraVerificationSettings();
      setCameraVerificationEnabled(settings.enabled);
    } catch (error) {
      console.error('Error fetching camera settings:', error);
      // Default to enabled if there's an error
      setCameraVerificationEnabled(true);
    }
  };

  const determineAttendanceType = () => {
    const hasCheckedIn = todayAttendance.some(r => r.type === 'masuk' && r.status === 'berhasil');
    const hasCheckedOut = todayAttendance.some(r => r.type === 'keluar' && r.status === 'berhasil');
    
    if (!hasCheckedIn) {
      setAttendanceType('masuk');
    } else if (hasCheckedIn && !hasCheckedOut) {
      setAttendanceType('keluar');
    }
  };

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setUserProfile(data);

      // Load stored face fingerprint if avatar exists
      if (data.avatar_url && cameraVerificationEnabled) {
        try {
          const result = await processImageUrl(data.avatar_url);
          setStoredFingerprint(result.fingerprint);
          console.log('✅ Stored face fingerprint loaded');
        } catch (err) {
          console.error('Error loading stored face fingerprint:', err);
          setError('Gagal memuat data wajah tersimpan. Silakan hubungi administrator.');
        }
      } else {
        setError('Foto profil belum tersedia. Silakan lengkapi profil Anda terlebih dahulu.');
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setError('Gagal memuat profil pengguna.');
    }
  };

  const fetchLastAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'berhasil')
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        setLastAttendance(data[0]);
      }
    } catch (err) {
      console.error('Error fetching last attendance:', err);
    }
  };

  const handleLocationValidated = (isValid, location) => {
    setValidLocation(isValid);
    setUserLocation(location);
    if (isValid && cameraVerificationEnabled) {
      setStep(2); // Move to face verification step
    } else if (isValid && !cameraVerificationEnabled) {
      setStep(3); // Skip face verification if disabled
    }
  };

  const handleFaceCapture = (photoBlob, fingerprint) => {
    setCapturedFace(photoBlob);
    setFaceFingerprint(fingerprint);
    setStep(3); // Move to submit step
  };

  const verifyFace = async () => {
    // Skip face verification if disabled
    if (!cameraVerificationEnabled) {
      return true;
    }
    
    if (!faceFingerprint || !storedFingerprint) {
      throw new Error('Data wajah tidak tersedia untuk verifikasi');
    }

    try {
      // Threshold dinaikkan agar lebih toleran, default 0.7 (0.4/0.5/0.6 terlalu ketat untuk real-world)
      const FACE_MATCH_THRESHOLD = 0.7;
      const isMatch = compareFaceFingerprints(faceFingerprint, storedFingerprint, FACE_MATCH_THRESHOLD);
      // Log hasil similarity dan fingerprint untuk debug
      console.log('Face match check:', {
        threshold: FACE_MATCH_THRESHOLD,
        faceFingerprint,
        storedFingerprint
      });
      
      if (!isMatch) {
        console.error(`Face verification failed. Distance exceeded threshold of ${FACE_MATCH_THRESHOLD}`);
        throw new Error('Wajah tidak cocok dengan data yang tersimpan. Pastikan Anda adalah orang yang benar dengan pencahayaan yang baik.');
      }

      console.log(`✅ Face verified with threshold: ${FACE_MATCH_THRESHOLD}`);
      return true;
    } catch (err) {
      console.error('Face verification error:', err);
      // Re-throw the specific error message from the comparison
      throw err;
    }
  };

  const calculateWorkDetails = () => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    const workStartTime = '08:00';
    const workEndTime = '17:00';
    
    let isLate = false;
    let lateMinutes = 0;
    let workHours = 0;
    let overtimeHours = 0;

    if (attendanceType === 'masuk') {
      // Check if late (after 08:15 - 15 minutes tolerance)
      isLate = currentTime > '08:15';
      if (isLate) {
        const startTime = new Date(`1970-01-01T${workStartTime}:00`);
        const currentDateTime = new Date(`1970-01-01T${currentTime}:00`);
        lateMinutes = Math.floor((currentDateTime - startTime) / 60000);
      }
    } else if (attendanceType === 'keluar') {
      // Calculate work hours for check out
      if (lastAttendance && lastAttendance.type === 'masuk') {
        const checkInTime = new Date(lastAttendance.timestamp);
        const checkOutTime = now;
        const totalMinutes = Math.floor((checkOutTime - checkInTime) / 60000);
        workHours = Math.max(0, totalMinutes / 60);
        
        // Calculate overtime (after 9 hours including 1 hour break)
        if (workHours > 9) {
          overtimeHours = workHours - 9;
          workHours = 9; // Cap regular hours at 9
        }
      }
    }

    return { isLate, lateMinutes, workHours, overtimeHours };
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

    // Check if already submitted this type today
    const hasAlreadySubmitted = todayAttendance.some(r => 
      r.type === attendanceType && r.status === 'berhasil'
    );

    if (hasAlreadySubmitted) {
      setError(`Anda sudah melakukan absensi ${attendanceType} hari ini.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Verify face first (if enabled)
      if (cameraVerificationEnabled) {
        await verifyFace();
      }

      const now = new Date();
      const { isLate, lateMinutes, workHours, overtimeHours } = calculateWorkDetails();

      // Calculate daily salary earned
      const dailySalary = userProfile?.salary ? userProfile.salary / 22 : 0;
      let dailySalaryEarned = 0;
      
      if (attendanceType === 'masuk') {
        // For check-in, calculate based on lateness
        if (isLate && lateMinutes > 15) {
          // Deduct salary for excessive lateness
          const deductionRate = Math.min(lateMinutes / 60 * 0.1, 0.5); // Max 50% deduction
          dailySalaryEarned = dailySalary * (1 - deductionRate);
        } else {
          dailySalaryEarned = dailySalary;
        }
      }

      // Submit attendance record with enhanced data
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
        notes: `Absensi ${attendanceType} berhasil dengan verifikasi ${cameraVerificationEnabled ? 'wajah dan ' : ''}lokasi. ${isLate ? `Terlambat ${lateMinutes} menit.` : 'Tepat waktu.'}`
      };

      // Set check-in or check-out time
      if (attendanceType === 'masuk') {
        attendanceData.check_in_time = now.toISOString();
      } else {
        attendanceData.check_out_time = now.toISOString();
      }

      const { data, error } = await supabase
        .from('attendance')
        .insert([attendanceData])
        .select();

      if (error) throw error;

      // Log activity
      try {
        await supabase.from('activity_logs').insert([{
          user_id: user.id,
          action_type: `attendance_${attendanceType}`,
          action_details: {
            type: attendanceType,
            status: 'berhasil',
            is_late: isLate,
            late_minutes: lateMinutes,
            work_hours: workHours,
            overtime_hours: overtimeHours,
            daily_salary_earned: dailySalaryEarned,
            location: {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude
            },
            device_info: {
              user_agent: navigator.userAgent,
              timestamp: now.toISOString()
            }
          },
          user_agent: navigator.userAgent
        }]);
      } catch (logError) {
        console.error('Failed to log activity:', logError);
      }

      // Show SweetAlert2 success popup
      await Swal.fire({
        icon: 'success',
        title: `Absensi ${attendanceType === 'masuk' ? 'Masuk' : 'Keluar'} Berhasil`,
        html: `<div style='text-align:left'>${isLate ? `<b>Status:</b> Terlambat ${lateMinutes} menit<br/>` : '<b>Status:</b> Tepat Waktu<br/>'}${workHours > 0 ? `<b>Jam Kerja:</b> ${workHours.toFixed(1)} jam<br/>` : ''}${overtimeHours > 0 ? `<b>Lembur:</b> ${overtimeHours.toFixed(1)} jam<br/>` : ''}</div>`,
        confirmButtonText: 'OK',
        timer: 3000,
        timerProgressBar: true
      });
      // Success callback
      if (onAttendanceSubmitted) {
        onAttendanceSubmitted(data[0]);
      }
      resetForm();

    } catch (err) {
      console.error('Attendance submission error:', err);
      
      // Determine error status
      let errorStatus = 'gagal';
      if (err.message.includes('wajah') || err.message.includes('Verifikasi wajah')) {
        errorStatus = cameraVerificationEnabled ? 'wajah_tidak_valid' : 'gagal';
      } else if (err.message.includes('lokasi')) {
        errorStatus = 'lokasi_tidak_valid';
      }
      
      // Log failed attempt
      const failedData = {
        user_id: user.id,
        type: attendanceType,
        timestamp: new Date().toISOString(),
        latitude: userLocation?.latitude || null,
        longitude: userLocation?.longitude || null,
        status: errorStatus,
        notes: `Absensi gagal: ${err.message}`
      };

      await supabase.from('attendance').insert([failedData]);
      
      await Swal.fire({
        icon: 'error',
        title: `Absensi ${attendanceType === 'masuk' ? 'Masuk' : 'Keluar'} Gagal`,
        text: err.message || 'Terjadi kesalahan saat absensi',
        confirmButtonText: 'OK'
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
    setShowSuccessMessage(false);
    fetchLastAttendance();
  };

  const getCurrentTime = () => {
    return new Date().toLocaleString('id-ID', {
      dateStyle: 'full',
      timeStyle: 'medium'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Check if can perform this attendance type
  const hasCheckedIn = todayAttendance.some(r => r.type === 'masuk' && r.status === 'berhasil');
  const hasCheckedOut = todayAttendance.some(r => r.type === 'keluar' && r.status === 'berhasil');
  
  const canCheckIn = !hasCheckedIn;
  const canCheckOut = hasCheckedIn && !hasCheckedOut;

  // Success Message Component
  if (showSuccessMessage) {
    const { isLate, lateMinutes, workHours, overtimeHours } = calculateWorkDetails();
    
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-8 text-white">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Absensi Berhasil!</h2>
              <p className="opacity-90">{attendanceType === 'masuk' ? 'Check In' : 'Check Out'} berhasil dicatat</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-green-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-green-900 mb-3">Detail Absensi</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-green-700">Waktu:</span>
                <span className="font-medium text-green-900">
                  {new Date().toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Status:</span>
                <span className={`font-medium ${isLate ? 'text-orange-600' : 'text-green-900'}`}>
                  {isLate ? `Terlambat ${lateMinutes} menit` : 'Tepat Waktu'}
                </span>
              </div>
              {attendanceType === 'keluar' && workHours > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-green-700">Jam Kerja:</span>
                    <span className="font-medium text-green-900">
                      {workHours.toFixed(1)} jam
                    </span>
                  </div>
                  {overtimeHours > 0 && (
                    <div className="flex justify-between">
                      <span className="text-green-700">Lembur:</span>
                      <span className="font-medium text-green-900">
                        {overtimeHours.toFixed(1)} jam
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Salary Information */}
          {userProfile?.salary && attendanceType === 'masuk' && (
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-blue-900 mb-3">Informasi Gaji Hari Ini</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">Gaji Harian:</span>
                  <span className="font-medium text-blue-900">
                    {formatCurrency(userProfile.salary / 22)}
                  </span>
                </div>
                {isLate && (
                  <div className="flex justify-between">
                    <span className="text-blue-700">Potongan Keterlambatan:</span>
                    <span className="font-medium text-orange-600">
                      -{formatCurrency((userProfile.salary / 22) * (lateMinutes / 15 * 0.1))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="text-center">
            <p className="text-gray-600 mb-4">
              Terima kasih! Data absensi Anda telah tersimpan dengan aman.
            </p>
            <button
              onClick={resetForm}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Don't show form if no stored fingerprint and show profile setup option
  if (cameraVerificationEnabled && !storedFingerprint && error && error.includes('Foto profil')) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-white">
          <h2 className="text-2xl font-bold mb-2">Absensi Karyawan</h2>
          <p className="opacity-90">Setup diperlukan untuk melanjutkan</p>
        </div>
        <div className="p-6 text-center">
          <Camera className="h-16 w-16 text-blue-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Foto Profil Diperlukan</h3>
          <p className="text-gray-600 mb-6">
            Untuk dapat melakukan absensi dengan verifikasi wajah, Anda perlu menambahkan foto wajah ke profil terlebih dahulu.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => window.location.href = '/profile-setup'}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <div className="flex items-center justify-center space-x-2">
                <Edit className="h-4 w-4" />
                <span>Setup Foto Wajah Sekarang</span>
              </div>
            </button>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-700">
              <strong>Catatan:</strong> Proses setup hanya perlu dilakukan sekali dan memakan waktu kurang dari 2 menit.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Don't show form if no stored fingerprint
  if (cameraVerificationEnabled && !storedFingerprint && !error) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-white">
          <h2 className="text-2xl font-bold mb-2">Absensi Karyawan</h2>
          <p className="opacity-90">Memuat data verifikasi...</p>
        </div>
        <div className="p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data wajah untuk verifikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-white">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Absensi Karyawan</h2>
            <p className="opacity-90">{userProfile?.name || 'Pengguna'}</p>
          </div>
        </div>
        <p className="opacity-90">{getCurrentTime()}</p>
        
        {lastAttendance && (
          <div className="mt-4 p-3 bg-white/10 rounded-lg">
            <p className="text-sm">
              Absensi terakhir: <span className="font-medium">
                {lastAttendance.type === 'masuk' ? 'Masuk' : 'Keluar'}
              </span> pada {new Date(lastAttendance.timestamp).toLocaleString('id-ID')}
            </p>
          </div>
        )}

        {/* Attendance Status */}
        <div className="mt-4 p-3 bg-white/10 rounded-lg">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>Status Hari Ini:</span>
              <span className={hasCheckedIn ? 'text-green-300' : 'text-yellow-300'}>
                {hasCheckedIn ? '✓ Sudah Masuk' : '○ Belum Masuk'}
              </span>
            </div>
            <div className="flex justify-between">
              <span></span>
              <span className={hasCheckedOut ? 'text-green-300' : 'text-yellow-300'}>
                {hasCheckedOut ? '✓ Sudah Keluar' : '○ Belum Keluar'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3].map((stepNum) => (
            <div key={stepNum} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                step >= stepNum
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {stepNum < step ? <CheckCircle className="h-5 w-5" /> : stepNum}
              </div>
              {stepNum < 3 && (
                <div className={`flex-1 h-1 mx-4 ${
                  step > stepNum ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Attendance Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Jenis Absensi
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setAttendanceType('masuk')}
              disabled={!canCheckIn}
              className={`p-4 rounded-lg border-2 transition-all ${
                attendanceType === 'masuk'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : canCheckIn 
                    ? 'border-gray-200 hover:border-gray-300'
                    : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Clock className="h-6 w-6 mx-auto mb-2" />
              <p className="font-medium">Masuk</p>
              {!canCheckIn && <p className="text-xs mt-1">Sudah absen masuk</p>}
            </button>
            <button
              onClick={() => setAttendanceType('keluar')}
              disabled={!canCheckOut}
              className={`p-4 rounded-lg border-2 transition-all ${
                attendanceType === 'keluar'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : canCheckOut 
                    ? 'border-gray-200 hover:border-gray-300'
                    : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Clock className="h-6 w-6 mx-auto mb-2" />
              <p className="font-medium">Keluar</p>
              {!canCheckOut && <p className="text-xs mt-1">{!hasCheckedIn ? 'Belum absen masuk' : 'Sudah absen keluar'}</p>}
            </button>
          </div>
        </div>

        {/* Step Content */}
        {step === 1 && (
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <MapPin className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Langkah 1: Verifikasi Lokasi</h3>
            </div>
            <LocationValidator onLocationValidated={handleLocationValidated} />
          </div>
        )}

        {step === 2 && cameraVerificationEnabled && (
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Camera className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Langkah 2: Verifikasi Wajah</h3>
            </div>
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Tips untuk verifikasi wajah yang berhasil:</strong><br />
                • Pastikan pencahayaan cukup terang<br />
                • Posisikan wajah tepat di tengah kamera<br />
                • Hindari bayangan pada wajah<br />
                • Jangan gunakan masker atau kacamata gelap
              </p>
            </div>
            <CustomFaceCapture 
              onFaceCapture={handleFaceCapture} 
              isCapturing={isSubmitting}
            />
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <CheckCircle className="h-5 w-5 text-blue-600" /> 
              <h3 className="text-lg font-semibold">Langkah 3: Kirim Absensi</h3>
            </div>
            
            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-gray-900 mb-3">Ringkasan Verifikasi</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Lokasi:</span>
                  <span className="text-green-600 font-medium">✓ Terverifikasi</span> 
                </div>
                {cameraVerificationEnabled && (
                  <div className="flex items-center justify-between">
                    <span>Pengenalan Wajah:</span>
                    <span className="text-green-600 font-medium">✓ Terverifikasi</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Jenis:</span>
                  <span className="font-medium">
                    {attendanceType === 'masuk' ? 'Masuk' : 'Keluar'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Waktu:</span>
                  <span className="font-medium">
                    {new Date().toLocaleTimeString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={resetForm}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Mulai Ulang
              </button>
              <button
                onClick={submitAttendance}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Mengirim...' : 'Kirim Absensi'}
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && !error.includes('Foto profil') && (
          <div className="mt-6 p-4 bg-red-50 rounded-lg flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 font-medium">Absensi Gagal</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
              <button
                onClick={resetForm}
                className="mt-2 text-sm text-red-700 underline hover:text-red-800"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceForm;