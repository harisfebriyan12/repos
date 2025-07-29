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
  Users,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Swal from 'sweetalert2';
import { supabase } from '../../utils/supabaseClient';
import AdminSidebar from '../../components/AdminSidebar';

// Type definitions
interface Department {
  id: string;
  name: string;
  description: string | null;
  head_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  description: string;
  head_name: string;
  is_active: boolean;
}

const DepartmentManagement: React.FC = () => {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [contentLoading, setContentLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const departmentsPerPage = 10;

  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    head_name: '',
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
      await fetchDepartments();
    } catch (error) {
      console.error('Error checking access:', error);
      setError('Gagal memeriksa akses pengguna');
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    setContentLoading(true);
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setError('Gagal memuat data departemen');
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
      name: '',
      description: '',
      head_name: '',
      is_active: true
    });
    setEditingDepartment(null);
    setShowModal(false);
    setModalMode('add');
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Nama departemen harus diisi');
      return;
    }

    setContentLoading(true);
    try {
      const departmentData: Partial<Department> = {
        name: formData.name,
        description: formData.description || null,
        head_name: formData.head_name || null,
        is_active: formData.is_active,
        updated_at: new Date().toISOString()
      };

      if (modalMode === 'edit' && editingDepartment) {
        const { error } = await supabase
          .from('departments')
          .update(departmentData)
          .eq('id', editingDepartment.id);

        if (error) throw error;
        Swal.fire({
          icon: 'success',
          title: 'Berhasil',
          text: `Departemen "${formData.name}" berhasil diperbarui!`
        });
      } else {
        departmentData.created_at = new Date().toISOString();
        const { error } = await supabase
          .from('departments')
          .insert([departmentData]);

        if (error) throw error;
        Swal.fire({
          icon: 'success',
          title: 'Berhasil',
          text: `Departemen "${formData.name}" berhasil ditambahkan!`
        });
      }

      resetForm();
      await fetchDepartments();
    } catch (error) {
      console.error('Error saving department:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal',
        text: `Gagal menyimpan departemen: ${error.message}`
      });
    } finally {
      setContentLoading(false);
    }
  };

  const handleEdit = (department: Department) => {
    setFormData({
      name: department.name,
      description: department.description || '',
      head_name: department.head_name || '',
      is_active: department.is_active
    });
    setEditingDepartment(department);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleDelete = async (departmentId: string, departmentName: string) => {
    const result = await Swal.fire({
      title: 'Hapus Departemen?',
      text: `Apakah Anda yakin ingin menghapus "${departmentName}"? Tindakan ini tidak dapat dibatalkan.`,
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
      const { data: positions, error: checkError } = await supabase
        .from('positions')
        .select('id')
        .eq('department', departments.find(d => d.id === departmentId)?.name)
        .limit(1);

      if (checkError) throw checkError;
      if (positions && positions.length > 0) {
        Swal.fire({
          icon: 'error',
          title: 'Gagal',
          text: 'Departemen tidak dapat dihapus karena masih digunakan oleh jabatan'
        });
        return;
      }

      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', departmentId);

      if (error) throw error;
      await fetchDepartments();
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: `Departemen "${departmentName}" berhasil dihapus`
      });
    } catch (error) {
      console.error('Error deleting department:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal',
        text: `Gagal menghapus departemen: ${error.message}`
      });
    } finally {
      setContentLoading(false);
    }
  };

  const filteredDepartments = departments.filter(department => 
    department.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (department.description && department.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (department.head_name && department.head_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const paginatedDepartments = filteredDepartments.slice((currentPage - 1) * departmentsPerPage, currentPage * departmentsPerPage);
  const totalPages = Math.ceil(filteredDepartments.length / departmentsPerPage);

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
                <h1 className="text-2xl font-bold text-gray-900">Manajemen Departemen</h1>
                <p className="text-sm text-gray-600 mt-1">Kelola departemen perusahaan dengan mudah</p>
              </div>
              <button
                onClick={() => { setModalMode('add'); setShowModal(true); }}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors sm:w-auto w-12 h-12"
              >
                <Plus className="h-5 w-5 sm:mr-2" />
                <span className="sm:inline hidden">Tambah Departemen</span>
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
                  <p className="text-sm font-medium text-gray-600">Total Departemen</p>
                  <p className="text-2xl font-bold text-gray-900">{departments.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Departemen Aktif</p>
                  <p className="text-2xl font-bold text-gray-900">{departments.filter(d => d.is_active).length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Dengan Kepala</p>
                  <p className="text-2xl font-bold text-gray-900">{departments.filter(d => d.head_name).length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md mb-6 p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Cari departemen..."
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
                  Daftar Departemen ({filteredDepartments.length})
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
            ) : paginatedDepartments.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-600 text-lg font-medium mb-2">Tidak ada departemen ditemukan</p>
                <p className="text-gray-500">Sesuaikan pencarian atau tambah departemen baru</p>
              </div>
            ) : (
              <>
                <div className="hidden lg:block">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nama Departemen
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Deskripsi
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Kepala Departemen
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
                      {paginatedDepartments.map((department) => (
                        <tr key={department.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <Building className="h-5 w-5 text-blue-600" />
                              </div>
                              <div className="text-sm font-medium text-gray-900">{department.name}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                            {department.description || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <Users className="h-5 w-5 text-gray-500" />
                              <span className="text-sm text-gray-900">
                                {department.head_name || 'Belum diatur'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              department.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {department.is_active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-3">
                              <button
                                onClick={() => handleEdit(department)}
                                className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition-colors"
                                title="Edit Departemen"
                              >
                                <Edit className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleDelete(department.id, department.name)}
                                className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50 transition-colors"
                                title="Hapus Departemen"
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
                  {paginatedDepartments.map((department) => (
                    <div key={department.id} className="bg-white rounded-xl shadow-md p-6 border border-gray-100 transition-transform hover:scale-[1.01]">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <Building className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-base font-semibold text-gray-900">{department.name}</p>
                            {department.description && (
                              <p className="text-sm text-gray-600 line-clamp-2">{department.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-3">
                          <button
                            onClick={() => handleEdit(department)}
                            className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50"
                          >
                            <Edit className="h-6 w-6" />
                          </button>
                          <button
                            onClick={() => handleDelete(department.id, department.name)}
                            className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50"
                          >
                            <Trash2 className="h-6 w-6" />
                          </button>
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 space-y-3">
                        <p><span className="font-medium">Kepala:</span> {department.head_name || 'Belum diatur'}</p>
                        <p>
                          <span className="font-medium">Status:</span>{' '}
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            department.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {department.is_active ? 'Aktif' : 'Nonaktif'}
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
                  {modalMode === 'edit' ? 'Edit Departemen' : 'Tambah Departemen Baru'}
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
                  <h3 className="font-medium text-blue-900 mb-4">Informasi Departemen</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nama Departemen *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Contoh: IT, HR, Finance"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Deskripsi
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Deskripsi singkat tentang departemen..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Kepala Departemen
                      </label>
                      <input
                        type="text"
                        name="head_name"
                        value={formData.head_name}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Nama kepala departemen"
                      />
                    </div>
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
                    Departemen aktif
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
                          <span>{modalMode === 'edit' ? 'Perbarui Departemen' : 'Simpan Departemen'}</span>
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

export default DepartmentManagement;