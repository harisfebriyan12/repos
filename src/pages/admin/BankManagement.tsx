import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Save,
  X,
  CreditCard,
  Code,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Swal from 'sweetalert2';
import { supabase } from '../../utils/supabaseClient';
import AdminSidebar from '../../components/AdminSidebar';

// Type definitions
interface Bank {
  id: string;
  bank_name: string;
  bank_code: string | null;
  bank_logo: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormData {
  bank_name: string;
  bank_code: string;
  bank_logo: string;
  description: string;
  is_active: boolean;
}

const BankManagement: React.FC = () => {
  const navigate = useNavigate();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [contentLoading, setContentLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const banksPerPage = 10;

  // Form state
  const [formData, setFormData] = useState<FormData>({
    bank_name: '',
    bank_code: '',
    bank_logo: '',
    description: '',
    is_active: true
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

      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profileData || profileData.role !== 'admin') {
        navigate('/dashboard');
        return;
      }

      setCurrentUser(user);
      setProfile(profileData);
      await fetchBanks();
    } catch (error) {
      console.error('Error checking access:', error);
      setError('Gagal memeriksa akses pengguna');
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchBanks = async () => {
    setContentLoading(true);
    try {
      const { data, error } = await supabase
        .from('bank_info')
        .select('*')
        .order('bank_name');

      if (error) throw error;
      setBanks(data || []);
    } catch (error) {
      console.error('Error fetching banks:', error);
      setError('Gagal memuat data bank');
    } finally {
      setContentLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const resetForm = () => {
    setFormData({
      bank_name: '',
      bank_code: '',
      bank_logo: '',
      description: '',
      is_active: true
    });
    setEditingBank(null);
    setShowModal(false);
    setModalMode('add');
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.bank_name.trim()) {
      setError('Nama bank harus diisi');
      return;
    }

    setContentLoading(true);
    try {
      const bankData: Partial<Bank> = {
        bank_name: formData.bank_name,
        bank_code: formData.bank_code || null,
        bank_logo: formData.bank_logo || null,
        description: formData.description || null,
        is_active: formData.is_active,
        updated_at: new Date().toISOString()
      };

      if (modalMode === 'edit' && editingBank) {
        const { error } = await supabase
          .from('bank_info')
          .update(bankData)
          .eq('id', editingBank.id);

        if (error) throw error;
        Swal.fire({
          icon: 'success',
          title: 'Berhasil',
          text: `Bank "${formData.bank_name}" berhasil diperbarui!`
        });
      } else {
        bankData.created_at = new Date().toISOString();
        const { error } = await supabase
          .from('bank_info')
          .insert([bankData]);

        if (error) throw error;
        Swal.fire({
          icon: 'success',
          title: 'Berhasil',
          text: `Bank "${formData.bank_name}" berhasil ditambahkan!`
        });
      }

      resetForm();
      await fetchBanks();
    } catch (error) {
      console.error('Error saving bank:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal',
        text: `Gagal menyimpan bank: ${error.message}`
      });
    } finally {
      setContentLoading(false);
    }
  };

  const handleEdit = (bank: Bank) => {
    setFormData({
      bank_name: bank.bank_name,
      bank_code: bank.bank_code || '',
      bank_logo: bank.bank_logo || '',
      description: bank.description || '',
      is_active: bank.is_active
    });
    setEditingBank(bank);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleDelete = async (bankId: string, bankName: string) => {
    const result = await Swal.fire({
      title: 'Hapus Bank?',
      text: `Apakah Anda yakin ingin menghapus "${bankName}"? Tindakan ini tidak dapat dibatalkan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) return;

    setContentLoading(true);
    try {
      const { data: employees, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('bank_id', bankId)
        .limit(1);

      if (checkError) throw checkError;
      if (employees && employees.length > 0) {
        Swal.fire({
          icon: 'error',
          title: 'Gagal',
          text: 'Bank tidak dapat dihapus karena masih digunakan oleh karyawan'
        });
        return;
      }

      const { error } = await supabase
        .from('bank_info')
        .delete()
        .eq('id', bankId);

      if (error) throw error;
      await fetchBanks();
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: `Bank "${bankName}" berhasil dihapus`
      });
    } catch (error) {
      console.error('Error deleting bank:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal',
        text: `Gagal menghapus bank: ${error.message}`
      });
    } finally {
      setContentLoading(false);
    }
  };

  const filteredBanks = banks.filter(bank => 
    bank.bank_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (bank.bank_code && bank.bank_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (bank.description && bank.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const paginatedBanks = filteredBanks.slice((currentPage - 1) * banksPerPage, currentPage * banksPerPage);
  const totalPages = Math.ceil(filteredBanks.length / banksPerPage);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex space-x-1 text-blue-600">
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-gray-600 mt-4 text-lg">Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <AdminSidebar user={currentUser} profile={profile} className="w-64 fixed h-screen hidden lg:block" />

      <div className="flex-1 lg:ml-64 transition-all duration-300">
        <div className="bg-white shadow-md border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Manajemen Bank</h1>
                <p className="text-sm text-gray-600 mt-1">Kelola daftar bank untuk pembayaran gaji</p>
              </div>
              <button
                onClick={() => { setModalMode('add'); setShowModal(true); }}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors sm:w-auto w-12 h-12"
              >
                <Plus className="h-5 w-5 sm:mr-2" />
                <span className="sm:inline hidden">Tambah Bank</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {success && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg flex items-center space-x-3 animate-fade-in">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <p className="text-green-700 flex-1">{success}</p>
              <button 
                onClick={() => setSuccess(null)}
                className="text-green-500 hover:text-green-700"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg flex items-center space-x-3 animate-fade-in">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <p className="text-red-700 flex-1">{error}</p>
              <button 
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Building className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Bank</p>
                  <p className="text-2xl font-bold text-gray-900">{banks.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Bank Aktif</p>
                  <p className="text-2xl font-bold text-gray-900">{banks.filter(b => b.is_active).length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Metode Pembayaran</p>
                  <p className="text-lg font-bold text-gray-900">Transfer Bank</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md mb-6 p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Cari bank..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Building className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Daftar Bank ({filteredBanks.length})
                </h2>
              </div>
            </div>

            {contentLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="inline-flex space-x-1 text-blue-600">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            ) : paginatedBanks.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-600 text-lg font-medium mb-2">Tidak ada bank ditemukan</p>
                <p className="text-gray-500">Sesuaikan pencarian atau tambah bank baru</p>
              </div>
            ) : (
              <>
                <div className="hidden lg:block">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nama Bank
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Kode Bank
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Deskripsi
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedBanks.map((bank) => (
                        <tr key={bank.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                {bank.bank_logo ? (
                                  <img src={bank.bank_logo} alt={bank.bank_name} className="h-8 w-8 object-contain" />
                                ) : (
                                  <Building className="h-5 w-5 text-blue-600" />
                                )}
                              </div>
                              <div className="text-sm font-medium text-gray-900">{bank.bank_name}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <Code className="h-5 w-5 text-gray-500" />
                              <span className="text-sm text-gray-900">{bank.bank_code || '-'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                            {bank.description || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              bank.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {bank.is_active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-3">
                              <button
                                onClick={() => handleEdit(bank)}
                                className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition-colors"
                                title="Edit Bank"
                              >
                                <Edit className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleDelete(bank.id, bank.bank_name)}
                                className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50 transition-colors"
                                title="Hapus Bank"
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="lg:hidden p-6 space-y-6">
                  {paginatedBanks.map((bank) => (
                    <div key={bank.id} className="bg-white rounded-xl shadow-md p-6 border border-gray-100 transition-transform hover:scale-[1.01]">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            {bank.bank_logo ? (
                              <img src={bank.bank_logo} alt={bank.bank_name} className="h-10 w-10 object-contain" />
                            ) : (
                              <Building className="h-6 w-6 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <p className="text-base font-semibold text-gray-900">{bank.bank_name}</p>
                            {bank.description && (
                              <p className="text-sm text-gray-600 line-clamp-2">{bank.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-3">
                          <button
                            onClick={() => handleEdit(bank)}
                            className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50"
                          >
                            <Edit className="h-6 w-6" />
                          </button>
                          <button
                            onClick={() => handleDelete(bank.id, bank.bank_name)}
                            className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50"
                          >
                            <Trash2 className="h-6 w-6" />
                          </button>
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 space-y-3">
                        <p><span className="font-medium">Kode Bank:</span> {bank.bank_code || '-'}</p>
                        <p>
                          <span className="font-medium">Status:</span>{' '}
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            bank.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {bank.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="flex items-center space-x-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                    >
                      <ChevronLeft className="h-5 w-5" />
                      <span>Sebelumnya</span>
                    </button>
                    <span className="text-sm text-gray-600">
                      Halaman {currentPage} dari {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="flex items-center space-x-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                    >
                      <span>Berikutnya</span>
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {modalMode === 'edit' ? 'Edit Bank' : 'Tambah Bank Baru'}
                </h2>
                <button
                  onClick={resetForm}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-blue-50 p-5 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-4">Informasi Bank</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nama Bank *
                      </label>
                      <input
                        type="text"
                        name="bank_name"
                        value={formData.bank_name}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Contoh: BCA, Mandiri, BNI"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Kode Bank
                      </label>
                      <input
                        type="text"
                        name="bank_code"
                        value={formData.bank_code}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Contoh: 014, 008, 009"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL Logo Bank
                    </label>
                    <input
                      type="text"
                      name="bank_logo"
                      value={formData.bank_logo}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="https://example.com/logo.png"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Masukkan URL gambar logo bank (opsional)
                    </p>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deskripsi
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="Deskripsi singkat tentang bank..."
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Bank aktif
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={contentLoading}
                    className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      {contentLoading ? (
                        <>
                          <div className="inline-flex space-x-1">
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-5 w-5" />
                          <span>{modalMode === 'edit' ? 'Perbarui Bank' : 'Simpan Bank'}</span>
                        </>
                      )}
                    </div>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankManagement;