import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../utils/supabaseClient.ts';
import Swal from 'sweetalert2';
import { User, CreditCard, Settings, XCircle, AlertTriangle } from 'lucide-react';

interface Bank {
  id: string;
  bank_name: string;
  is_active: boolean;
}

interface Profile {
  id: string;
  name?: string;
  full_name?: string;
  phone?: string;
  location?: string;
  bio?: string;
  email?: string;
  bank_id?: string;
  bank_account_number?: string;
  bank_account_name?: string;
}

interface User {
  id: string;
}

interface ProfileEditorProps {
  user: User;
  profile: Profile | null;
  onClose: () => void;
}

const ProfileEditor: React.FC<ProfileEditorProps> = ({ user, profile, onClose }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'bank' | 'password'>('profile');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState({
    name: profile?.name || '',
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    location: profile?.location || '',
    bio: profile?.bio || '',
  });
  const [bankData, setBankData] = useState({
    bank_id: profile?.bank_id || '',
    bank_account_number: profile?.bank_account_number || '',
    bank_account_name: profile?.bank_account_name || profile?.full_name || '',
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const { data, error } = await supabase
          .from('bank_info')
          .select('*')
          .eq('is_active', true)
          .order('bank_name');
        if (error) throw error;
        setBanks(data || []);
      } catch (error) {
        console.error('Error fetching banks:', error);
        setError('Gagal memuat data bank.');
      }
    };
    fetchBanks();
  }, []);

  useEffect(() => {
    if (banks.length > 0 && bankData.bank_id) {
      const bank = banks.find(bank => bank.id === bankData.bank_id);
      setSelectedBank(bank || null);
    }
  }, [banks, bankData.bank_id]);

  const validatePhone = (phone: string) => {
    return /^\+?\d{10,13}$/.test(phone);
  };

  const validatePassword = (password: string) => {
    return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
  };

  const handleSaveProfile = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (profileData.phone && !validatePhone(profileData.phone)) {
        await Swal.fire({
          icon: 'error',
          title: 'Gagal',
          text: 'Nomor telepon tidak valid. Harus berupa 10-13 digit angka.',
        });
        return;
      }

      setIsSubmitting(true);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: profileData.full_name,
            phone: profileData.phone,
            location: profileData.location,
            bio: profileData.bio,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
        if (error) throw error;
        await Swal.fire({
          icon: 'success',
          title: 'Berhasil',
          text: 'Profil berhasil diperbarui!',
        });
        onClose();
      } catch (err: any) {
        await Swal.fire({
          icon: 'error',
          title: 'Gagal',
          text: err.message || 'Gagal memperbarui profil.',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [profileData, user.id, onClose]
  );

  const handleSaveBank = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            bank_id: bankData.bank_id,
            bank_account_number: bankData.bank_account_number,
            bank_account_name: bankData.bank_account_name,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
        if (error) throw error;
        await Swal.fire({
          icon: 'success',
          title: 'Berhasil',
          text: 'Data bank berhasil diperbarui!',
        });
        onClose();
      } catch (err: any) {
        await Swal.fire({
          icon: 'error',
          title: 'Gagal',
          text: err.message || 'Gagal memperbarui data bank.',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [bankData, user.id, onClose]
  );

  const handleChangePassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        await Swal.fire({
          icon: 'error',
          title: 'Gagal',
          text: 'Password dan konfirmasi tidak sama.',
        });
        return;
      }
      if (!validatePassword(passwordData.newPassword)) {
        await Swal.fire({
          icon: 'error',
          title: 'Gagal',
          text: 'Password harus minimal 8 karakter, mengandung huruf besar, dan angka.',
        });
        return;
      }

      setIsSubmitting(true);
      try {
        const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
        if (error) throw error;
        await Swal.fire({
          icon: 'success',
          title: 'Berhasil',
          text: 'Password berhasil diubah!',
        });
        setPasswordData({ newPassword: '', confirmPassword: '' });
        onClose();
      } catch (err: any) {
        await Swal.fire({
          icon: 'error',
          title: 'Gagal',
          text: err.message || 'Gagal mengubah password.',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [passwordData, onClose]
  );

  return (
    <div
      className="fixed inset-0 bg-blue-600 bg-opacity-20 flex items-center justify-center p-4 z-50 transition-opacity duration-300"
      role="dialog"
      aria-labelledby="profile-editor-title"
      aria-modal="true"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100">
        <div className="p-4 border-b border-blue-100 flex justify-between items-center bg-blue-50 rounded-t-xl">
          <h2 id="profile-editor-title" className="text-lg font-bold text-blue-800">
            Kelola Profil
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-blue-100 transition-colors duration-200"
            aria-label="Tutup panel pengeditan profil"
          >
            <XCircle className="h-5 w-5 text-blue-600" />
          </button>
        </div>

        <div className="flex border-b border-blue-100">
          {[
            { key: 'profile' as const, label: 'Profil', icon: User },
            { key: 'bank' as const, label: 'Bank', icon: CreditCard },
            { key: 'password' as const, label: 'Password', icon: Settings },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`flex-1 px-3 py-3 text-xs font-medium transition-all duration-200 flex items-center justify-center space-x-1 ${
                activeTab === key
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-blue-700 hover:bg-blue-50'
              }`}
              onClick={() => setActiveTab(key)}
              aria-current={activeTab === key ? 'page' : undefined}
            >
              <Icon className="h-3 w-3" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        <div className="p-4 flex-1 overflow-y-auto">
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4 animate-fade-in">
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-blue-700 mb-2">
                  Nama Lengkap
                </label>
                <input
                  id="full_name"
                  type="text"
                  className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-sm bg-white text-blue-900"
                  value={profileData.full_name}
                  onChange={e => setProfileData({ ...profileData, full_name: e.target.value })}
                  required
                  aria-required="true"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-blue-700 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className="w-full border border-blue-300 rounded-lg px-3 py-2 bg-blue-50 text-blue-500 cursor-not-allowed text-sm"
                  value={profile?.email || ''}
                  disabled
                  aria-disabled="true"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-blue-700 mb-2">
                  No. Telepon
                </label>
                <input
                  id="phone"
                  type="tel"
                  className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-sm bg-white text-blue-900"
                  value={profileData.phone}
                  onChange={e => setProfileData({ ...profileData, phone: e.target.value })}
                  placeholder="Masukkan nomor telepon (contoh: +6281234567890)"
                  aria-describedby="phone-hint"
                />
                <p id="phone-hint" className="text-xs text-blue-600 mt-1">
                  Masukkan nomor telepon (10-13 digit)
                </p>
              </div>
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-blue-700 mb-2">
                  Lokasi
                </label>
                <input
                  id="location"
                  type="text"
                  className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-sm bg-white text-blue-900"
                  value={profileData.location}
                  onChange={e => setProfileData({ ...profileData, location: e.target.value })}
                  placeholder="Masukkan lokasi"
                />
              </div>
              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-blue-700 mb-2">
                  Bio
                </label>
                <textarea
                  id="bio"
                  className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-sm bg-white text-blue-900"
                  value={profileData.bio}
                  onChange={e => setProfileData({ ...profileData, bio: e.target.value })}
                  placeholder="Ceritakan tentang diri Anda"
                  rows={4}
                />
              </div>
            </form>
          )}

          {activeTab === 'bank' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-800">Informasi Bank</h3>
                </div>
                <p className="text-sm text-blue-600">
                  Data bank hanya dapat diubah oleh pihak kantor.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">Bank</label>
                  <div className="w-full border border-blue-300 rounded-lg px-3 py-2 bg-blue-50 text-blue-600 text-sm flex items-center space-x-2">
                    {selectedBank && (
                      <img
                        src={`/default-bank.png`}
                        alt={selectedBank.bank_name}
                        className="w-6 h-6 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <span>{selectedBank?.bank_name || 'Belum ada bank terdaftar'}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">
                    Nomor Rekening
                  </label>
                  <input
                    type="text"
                    className="w-full border border-blue-300 rounded-lg px-3 py-2 bg-blue-50 text-blue-600 cursor-not-allowed text-sm"
                    value={bankData.bank_account_number || '-'}
                    disabled
                    aria-disabled="true"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">
                    Nama Pemilik Rekening
                  </label>
                  <input
                    type="text"
                    className="w-full border border-blue-300 rounded-lg px-3 py-2 bg-blue-50 text-blue-600 cursor-not-allowed text-sm"
                    value={bankData.bank_account_name || '-'}
                    disabled
                    aria-disabled="true"
                  />
                </div>

                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-blue-800 font-medium">Informasi Penting</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Data bank hanya dapat diubah oleh bagian HRD untuk keamanan. Hubungi HRD jika perlu mengubah data bank.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-4 animate-fade-in">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Settings className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-800">Keamanan Akun</h3>
                </div>
                <p className="text-sm text-blue-600">
                  Password harus minimal 8 karakter, mengandung huruf besar, dan angka.
                </p>
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-blue-700 mb-2">
                  Password Baru
                </label>
                <input
                  id="newPassword"
                  type="password"
                  className="w-full border border-blue-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-sm bg-white text-blue-900"
                  value={passwordData.newPassword}
                  onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Masukkan password baru"
                  required
                  aria-required="true"
                  aria-describedby="password-hint"
                />
                <p id="password-hint" className="text-xs text-blue-600 mt-1">
                  Minimal 8 karakter, termasuk huruf besar dan angka
                </p>
              </div>
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-blue-700 mb-2"
                >
                  Konfirmasi Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="w-full border border-blue-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-sm bg-white text-blue-900"
                  value={passwordData.confirmPassword}
                  onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Ulangi password baru"
                  required
                  aria-required="true"
                />
              </div>
            </form>
          )}
        </div>

        <div className="p-4 border-t border-blue-100 bg-blue-50 flex justify-end gap-3 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white text-blue-800 hover:bg-blue-100 transition-colors duration-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={activeTab === 'bank' ? 'Tutup' : 'Batal'}
          >
            {activeTab === 'bank' ? 'Tutup' : 'Batal'}
          </button>
          {activeTab === 'profile' && (
            <button
              onClick={handleSaveProfile}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-300 text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSubmitting}
              aria-label="Simpan perubahan profil"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          )}
          {activeTab === 'password' && (
            <button
              onClick={handleChangePassword}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-300 text-sm font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSubmitting}
              aria-label="Ubah password"
            >
              {isSubmitting ? 'Menyimpan...' : 'Ubah Password'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileEditor;