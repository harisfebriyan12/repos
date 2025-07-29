import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Save, Edit, Navigation, X, Bell, AlertTriangle, Clock, Camera } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import SimpleLocationPicker from '../../components/SimpleLocationPicker';
import AdminSidebar from '../../components/AdminSidebar';
import Swal from 'sweetalert2';

const SystemSettings = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [officeLocation, setOfficeLocation] = useState(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [radius, setRadius] = useState(100);
  const [isSaving, setIsSaving] = useState(false);
  const [showWorkHoursSettings, setShowWorkHoursSettings] = useState(false);
  const [workHoursSettings, setWorkHoursSettings] = useState({
    startTime: '08:00',
    endTime: '17:00',
    lateThreshold: 15,
    earlyLeaveThreshold: 15,
    breakDuration: 60,
  });
  const [showCameraSettings, setShowCameraSettings] = useState(false);
  const [cameraSettings, setCameraSettings] = useState({
    enabled: false,
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
      await Promise.all([fetchOfficeLocation(), fetchWorkHoursSettings(), fetchCameraSettings()]);
    } catch (error) {
      console.error('Error checking access:', error);
      Swal.fire({
        icon: 'error',
        title: 'Akses Ditolak',
        text: 'Gagal memverifikasi akses. Silakan login kembali.',
        confirmButtonColor: '#2563eb',
      });
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchOfficeLocation = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'office_location')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data?.setting_value) {
        setOfficeLocation(data.setting_value);
        setRadius(data.setting_value.radius || 100);
      } else {
        setOfficeLocation({
          latitude: -6.200000,
          longitude: 106.816666,
          address: 'Jakarta, Indonesia',
          radius: 100,
        });
      }
    } catch (error) {
      console.error('Error fetching office location:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Gagal memuat pengaturan lokasi kantor',
        confirmButtonColor: '#2563eb',
      });
    }
  };

  const fetchWorkHoursSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'work_hours')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data?.setting_value) {
        setWorkHoursSettings(data.setting_value);
      }
    } catch (error) {
      console.error('Error fetching work hours settings:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Gagal memuat pengaturan jam kerja',
        confirmButtonColor: '#2563eb',
      });
    }
  };

  const fetchCameraSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'camera_verification')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data?.setting_value) {
        setCameraSettings(data.setting_value);
      }
    } catch (error) {
      console.error('Error fetching camera settings:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Gagal memuat pengaturan verifikasi kamera',
        confirmButtonColor: '#2563eb',
      });
    }
  };

  const handleLocationSelect = async (newLocation) => {
    setIsSaving(true);
    try {
      const locationData = {
        latitude: newLocation.latitude,
        longitude: newLocation.longitude,
        address: newLocation.address,
        radius: radius,
      };

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'office_location',
          setting_value: locationData,
          description: 'Lokasi kantor utama dan radius absensi',
          is_enabled: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'setting_key',
        });

      if (error) throw error;

      setOfficeLocation(locationData);
      setShowLocationPicker(false);
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Lokasi kantor berhasil diperbarui!',
        confirmButtonColor: '#2563eb',
        timer: 3000,
        timerProgressBar: true,
      }).then(() => {});
    } catch (error) {
      console.error('Error saving office location:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Gagal menyimpan lokasi kantor',
        confirmButtonColor: '#2563eb',
      }).then(() => {});
    } finally {
      setIsSaving(false);
    }
  };

  const handleRadiusChange = async (newRadius) => {
    if (!officeLocation) return;

    setIsSaving(true);
    try {
      const locationData = {
        ...officeLocation,
        radius: parseInt(newRadius),
      };

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'office_location',
          setting_value: locationData,
          description: 'Lokasi kantor utama dan radius absensi',
          is_enabled: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'setting_key',
        });

      if (error) throw error;

      setOfficeLocation(locationData);
      setRadius(parseInt(newRadius));
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Radius absensi berhasil diperbarui!',
        confirmButtonColor: '#2563eb',
        timer: 3000,
        timerProgressBar: true,
      }).then(() => {});
    } catch (error) {
      console.error('Error updating radius:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Gagal memperbarui radius absensi',
        confirmButtonColor: '#2563eb',
      }).then(() => {});
    } finally {
      setIsSaving(false);
    }
  };

  const handleWorkHoursChange = (e) => {
    const { name, value } = e.target;
    setWorkHoursSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveWorkHoursSettings = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'work_hours',
          setting_value: workHoursSettings,
          description: 'Pengaturan jam kerja dan toleransi absensi',
          is_enabled: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'setting_key',
        });

      if (error) throw error;

      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Pengaturan jam kerja berhasil diperbarui!',
        confirmButtonColor: '#2563eb',
        timer: 3000,
        timerProgressBar: true,
      }).then(() => {});
      setShowWorkHoursSettings(false);
    } catch (error) {
      console.error('Error saving work hours settings:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Gagal menyimpan pengaturan jam kerja',
        confirmButtonColor: '#2563eb',
      }).then(() => {});
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCameraSettings = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'camera_verification',
          setting_value: cameraSettings,
          description: 'Pengaturan verifikasi wajah untuk absensi',
          is_enabled: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'setting_key',
        });

      if (error) throw error;

      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Pengaturan verifikasi kamera berhasil diperbarui!',
        confirmButtonColor: '#2563eb',
        timer: 3000,
        timerProgressBar: true,
      }).then(() => {});
      setShowCameraSettings(false);
    } catch (error) {
      console.error('Error saving camera settings:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Gagal menyimpan pengaturan verifikasi kamera',
        confirmButtonColor: '#2563eb',
      }).then(() => {});
    } finally {
      setIsSaving(false);
    }
  };

  const openInGoogleMaps = () => {
    if (officeLocation) {
      const url = `https://www.google.com/maps?q=${officeLocation.latitude},${officeLocation.longitude}`;
      window.open(url, '_blank');
    }
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
          <p className="text-gray-600 mt-4">Memuat pengaturan sistem...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <AdminSidebar user={currentUser} profile={profile} />

      <div className="flex-1 md:ml-64 transition-all duration-300 ease-in-out">
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Pengaturan Sistem</h1>
                <p className="text-sm text-gray-600">
                  Kelola pengaturan lokasi kantor, jam kerja, dan verifikasi absensi
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {showLocationPicker ? (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <SimpleLocationPicker
                initialLocation={officeLocation ? {
                  lat: officeLocation.latitude,
                  lng: officeLocation.longitude,
                  address: officeLocation.address,
                } : null}
                radius={radius}
                onLocationSelect={handleLocationSelect}
                onCancel={() => setShowLocationPicker(false)}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overview Section */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Ringkasan Pengaturan</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button
                    onClick={() => setShowLocationPicker(true)}
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <MapPin className="h-5 w-5" />
                    <span>Atur Lokasi Kantor</span>
                  </button>
                  <button
                    onClick={() => setShowWorkHoursSettings(true)}
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Clock className="h-5 w-5" />
                    <span>Atur Jam Kerja</span>
                  </button>
                  <button
                    onClick={() => setShowCameraSettings(true)}
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Camera className="h-5 w-5" />
                    <span>Atur Verifikasi Wajah</span>
                  </button>
                </div>
              </div>

              {/* Office Location Settings */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Lokasi Kantor</h2>
                  <button
                    onClick={() => setShowLocationPicker(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Edit Lokasi</span>
                  </button>
                </div>

                {officeLocation ? (
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <MapPin className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">Alamat</p>
                        <p className="text-gray-600">{officeLocation.address}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="font-medium text-gray-900 mb-1">Koordinat</p>
                        <p className="text-gray-600">
                          {officeLocation.latitude.toFixed(6)}, {officeLocation.longitude.toFixed(6)}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="font-medium text-gray-900 mb-1">Radius Absensi</p>
                        <p className="text-gray-600">{officeLocation.radius} meter</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Radius Absensi (meter)
                        </label>
                        <div className="flex items-center space-x-4">
                          <input
                            type="range"
                            min="50"
                            max="500"
                            step="10"
                            value={radius}
                            onChange={(e) => setRadius(parseInt(e.target.value))}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min="50"
                              max="500"
                              value={radius}
                              onChange={(e) => setRadius(parseInt(e.target.value))}
                              className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <span className="text-gray-600">m</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 mt-2">
                          Karyawan harus berada dalam radius ini untuk dapat melakukan absensi
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                        <button
                          onClick={openInGoogleMaps}
                          className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Navigation className="h-4 w-4" />
                          <span>Lihat di Google Maps</span>
                        </button>
                        <button
                          onClick={() => handleRadiusChange(radius)}
                          disabled={isSaving || radius === officeLocation.radius}
                          className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Save className="h-4 w-4" />
                          <span>{isSaving ? 'Menyimpan...' : 'Simpan Radius'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <MapPin className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500">Lokasi kantor belum diatur</p>
                    <button
                      onClick={() => setShowLocationPicker(true)}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Atur Lokasi Sekarang
                    </button>
                  </div>
                )}
              </div>

              {/* Work Hours Settings */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Pengaturan Jam Kerja</h2>
                  <button
                    onClick={() => setShowWorkHoursSettings(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Edit Jam Kerja</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium text-gray-900 mb-1">Jam Masuk</p>
                    <p className="text-gray-600">{workHoursSettings.startTime}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium text-gray-900 mb-1">Jam Keluar</p>
                    <p className="text-gray-600">{workHoursSettings.endTime}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium text-gray-900 mb-1">Toleransi Keterlambatan</p>
                    <p className="text-gray-600">{workHoursSettings.lateThreshold} menit</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium text-gray-900 mb-1">Toleransi Pulang Cepat</p>
                    <p className="text-gray-600">{workHoursSettings.earlyLeaveThreshold} menit</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium text-gray-900 mb-1">Durasi Istirahat</p>
                    <p className="text-gray-600">{workHoursSettings.breakDuration} menit</p>
                  </div>
                </div>
              </div>

              {/* Camera Verification Settings */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Verifikasi Wajah</h2>
                  <button
                    onClick={() => setShowCameraSettings(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Edit Verifikasi</span>
                  </button>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-medium text-gray-900 mb-1">Status Verifikasi Wajah</p>
                  <p className="text-gray-600">
                    {cameraSettings.enabled
                      ? 'Karyawan harus melakukan verifikasi wajah saat absensi'
                      : 'Karyawan dapat absensi tanpa verifikasi wajah'}
                  </p>
                </div>
              </div>

              {/* Info Panels */}
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="font-medium text-blue-900 mb-3">✨ Keunggulan Sistem</h3>
                <div className="space-y-2 text-sm text-blue-700">
                  <p>• Tidak memerlukan API key Google Maps yang berbayar</p>
                  <p>• Sistem tetap akurat menggunakan koordinat GPS</p>
                  <p>• Mudah digunakan dengan preset lokasi populer</p>
                  <p>• Dapat menggunakan GPS untuk mendapatkan lokasi saat ini</p>
                  <p>• Koordinat dapat dicari manual dari Google Maps</p>
                  <p>• Sistem validasi radius dan verifikasi wajah berfungsi dengan sempurna</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-medium text-gray-900 mb-3">📋 Cara Menggunakan</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <p><strong>1. Lokasi Kantor:</strong> Atur lokasi menggunakan GPS, preset, atau input manual</p>
                  <p><strong>2. Jam Kerja:</strong> Tentukan jam masuk, keluar, toleransi, dan istirahat</p>
                  <p><strong>3. Verifikasi Wajah:</strong> Aktifkan atau nonaktifkan verifikasi wajah</p>
                  <p><strong>4. Simpan:</strong> Klik simpan untuk menerapkan semua pengaturan</p>
                </div>
              </div>
            </div>
          )}

          {/* Work Hours Settings Modal */}
          {showWorkHoursSettings && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="w-full max-w-md bg-white rounded-xl shadow-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">Pengaturan Jam Kerja</h2>
                    <button
                      onClick={() => setShowWorkHoursSettings(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Jam Masuk</label>
                        <input
                          type="time"
                          name="startTime"
                          value={workHoursSettings.startTime}
                          onChange={handleWorkHoursChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Jam Keluar</label>
                        <input
                          type="time"
                          name="endTime"
                          value={workHoursSettings.endTime}
                          onChange={handleWorkHoursChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Toleransi Keterlambatan (menit)
                      </label>
                      <input
                        type="number"
                        name="lateThreshold"
                        value={workHoursSettings.lateThreshold}
                        onChange={handleWorkHoursChange}
                        min="0"
                        max="60"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Karyawan dianggap terlambat jika masuk setelah jam masuk + toleransi
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Toleransi Pulang Cepat (menit)
                      </label>
                      <input
                        type="number"
                        name="earlyLeaveThreshold"
                        value={workHoursSettings.earlyLeaveThreshold}
                        onChange={handleWorkHoursChange}
                        min="0"
                        max="60"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Karyawan dianggap pulang cepat jika keluar sebelum jam keluar - toleransi
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Durasi Istirahat (menit)
                      </label>
                      <input
                        type="number"
                        name="breakDuration"
                        value={workHoursSettings.breakDuration}
                        onChange={handleWorkHoursChange}
                        min="0"
                        max="120"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <Bell className="h-5 w-5 text-blue-600" />
                        <h3 className="font-medium text-blue-900 text-base">Pengaturan Absensi Otomatis</h3>
                      </div>
                      <p className="text-sm text-blue-700">
                        Sistem akan otomatis menandai karyawan sebagai "Tidak Hadir" jika:
                      </p>
                      <ul className="text-sm text-blue-700 mt-2 space-y-1 pl-5 list-disc">
                        <li>Sudah melewati jam keluar kerja</li>
                        <li>Tidak ada catatan absensi masuk pada hari tersebut</li>
                        <li>Karyawan berstatus aktif (bukan admin)</li>
                      </ul>
                    </div>

                    <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 pt-4">
                      <button
                        onClick={() => setShowWorkHoursSettings(false)}
                        className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                      >
                        Batal
                      </button>
                      <button
                        onClick={saveWorkHoursSettings}
                        disabled={isSaving}
                        className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <Save className="h-5 w-5" />
                          <span>{isSaving ? 'Menyimpan...' : 'Simpan'}</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Camera Settings Modal */}
          {showCameraSettings && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="w-full max-w-md bg-white rounded-xl shadow-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">Pengaturan Verifikasi Wajah</h2>
                    <button
                      onClick={() => setShowCameraSettings(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-medium text-blue-900 mb-3">Verifikasi Wajah</h3>
                      <div className="space-y-4">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="camera-enabled"
                            checked={cameraSettings.enabled}
                            onChange={(e) => setCameraSettings((prev) => ({
                              ...prev,
                              enabled: e.target.checked,
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="camera-enabled" className="ml-2 block text-sm text-gray-900">
                            Aktifkan verifikasi wajah untuk absensi
                          </label>
                        </div>
                        <div className="p-3 bg-white rounded-lg">
                          <p className="text-sm text-gray-600">
                            {cameraSettings.enabled
                              ? 'Karyawan harus melakukan verifikasi wajah saat absensi'
                              : 'Karyawan dapat absensi tanpa verifikasi wajah'}
                          </p>
                        </div>
                        <div className="p-3 bg-yellow-50 rounded-lg">
                          <div className="flex items-start space-x-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-yellow-700">
                              Menonaktifkan verifikasi wajah akan mengurangi keamanan sistem absensi,
                              tetapi dapat berguna jika terjadi masalah dengan kamera atau perangkat.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                      <button
                        onClick={() => setShowCameraSettings(false)}
                        className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleSaveCameraSettings}
                        disabled={isSaving}
                        className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <Save className="h-4 w-4" />
                          <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;