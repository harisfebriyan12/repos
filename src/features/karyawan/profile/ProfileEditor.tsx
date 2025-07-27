import React, { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import Swal from 'sweetalert2';
import { User, CreditCard, Settings, XCircle, AlertTriangle } from 'lucide-react';

const ProfileEditor = ({ user, profile, onClose }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banks, setBanks] = useState([]);
  const [profileData, setProfileData] = useState({
    name: profile?.name || '',
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    location: profile?.location || '',
    bio: profile?.bio || ''
  });
  const [bankData, setBankData] = useState({
    bank_id: profile?.bank_id || '',
    bank_account_number: profile?.bank_account_number || '',
    bank_account_name: profile?.bank_account_name || profile?.full_name || ''
  });
  const [selectedBank, setSelectedBank] = useState(null);
  const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const { data, error } = await supabase.from('bank_info').select('*').eq('is_active', true).order('bank_name');
        if (error) throw error;
        setBanks(data || []);
      } catch (error) {
        console.error('Error fetching banks:', error);
      }
    };
    fetchBanks();
  }, []);

  useEffect(() => {
    if (banks.length > 0 && bankData.bank_id) {
      const bank = banks.find(bank => bank.id === bankData.bank_id);
      setSelectedBank(bank);
    }
  }, [banks, bankData.bank_id]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      if (error) throw error;
      await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Profil berhasil diperbarui!' });
      onClose();
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Gagal memperbarui profil.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveBank = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          bank_id: bankData.bank_id,
          bank_account_number: bankData.bank_account_number,
          bank_account_name: bankData.bank_account_name,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      if (error) throw error;
      await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Data bank berhasil diperbarui!' });
      onClose();
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Gagal memperbarui data bank.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      await Swal.fire({ icon: 'error', title: 'Gagal', text: 'Password dan konfirmasi tidak sama.' });
      setIsSubmitting(false);
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) throw error;
      await Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Password berhasil diubah!' });
      setPasswordData({ newPassword: '', confirmPassword: '' });
      onClose();
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || 'Gagal mengubah password.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col animate-fade-in">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
          <h2 className="text-lg font-bold text-gray-800">Kelola Profil</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors duration-200"
            aria-label="Tutup"
          >
            <XCircle className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        <div className="flex border-b border-gray-100">
          {[
            { key: 'profile', label: 'Profil', icon: User },
            { key: 'bank', label: 'Bank', icon: CreditCard },
            { key: 'password', label: 'Password', icon: Settings }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`flex-1 px-3 py-3 text-xs font-medium transition-all duration-200 flex items-center justify-center space-x-1 ${
                activeTab === key
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab(key)}
            >
              <Icon className="h-3 w-3" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama Lengkap</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-sm"
                  value={profileData.full_name}
                  onChange={e => setProfileData({ ...profileData, full_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-500 cursor-not-allowed text-sm"
                  value={profile?.email || ''}
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">No. Telepon</label>
                <input
                  type="tel"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-sm"
                  value={profileData.phone}
                  onChange={e => setProfileData({ ...profileData, phone: e.target.value })}
                  placeholder="Masukkan nomor telepon"
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
                <p className="text-sm text-blue-600">Data bank hanya dapat diubah oleh pihak kantor.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bank</label>
                  <div className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-500 text-sm flex items-center space-x-2">
                    {selectedBank && (
                      <img
                        src={`/default-bank.png`}
                        alt={selectedBank.bank_name}
                        className="w-6 h-6 object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    <span>{selectedBank?.bank_name || 'Belum ada bank terdaftar'}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nomor Rekening</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-500 cursor-not-allowed text-sm"
                    value={bankData.bank_account_number || '-'}
                    disabled
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nama Pemilik Rekening</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-500 cursor-not-allowed text-sm"
                    value={bankData.bank_account_name || '-'}
                    disabled
                  />
                </div>

                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-yellow-800 font-medium">Informasi Penting</p>
                      <p className="text-xs text-yellow-700 mt-1">
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
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Settings className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-600">Keamanan Akun</h3>
                </div>
                <p className="text-sm text-blue-600">Ubah password untuk menjaga keamanan akun Anda</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password Baru</label>
                <input
                  type="password"
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-sm"
                  value={passwordData.newPassword}
                  onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Masukkan password baru"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Konfirmasi Password</label>
                <input
                  type="password"
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-sm"
                  value={passwordData.confirmPassword}
                  onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Ulangi password baru"
                  required
                />
              </div>
            </form>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors duration-200 text-sm font-medium"
          >
            {activeTab === 'bank' ? 'Tutup' : 'Batal'}
          </button>
          {activeTab === 'profile' && (
            <button
              onClick={handleSaveProfile}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 transition-colors duration-300 text-sm font-medium shadow-sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          )}
          {activeTab === 'password' && (
            <button
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 transition-colors duration-300 text-sm font-medium shadow-md"
              disabled={isSubmitting}
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
