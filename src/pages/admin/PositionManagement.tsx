import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Save,
  X,
  Building,
  DollarSign,
  Briefcase,
  CheckCircle,
  AlertTriangle,
  XCircle,
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
  is_active: boolean;
}

interface Position {
  id: string;
  name_id: string;
  name_en: string;
  description_id: string | null;
  description_en: string | null;
  base_salary: number;
  min_salary: number;
  max_salary: number;
  department: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name_id: string;
  name_en: string;
  description_id: string;
  description_en: string;
  base_salary: number;
  min_salary: number;
  max_salary: number;
  department: string;
  is_active: boolean;
}

const PositionManagement: React.FC = () => {
  const navigate = useNavigate();
  const [positions, setPositions] = useState<Position[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [contentLoading, setContentLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const positionsPerPage = 10;

  // Form state
  const [formData, setFormData] = useState<FormData>({
    name_id: '',
    name_en: '',
    description_id: '',
    description_en: '',
    base_salary: 0,
    min_salary: 0,
    max_salary: 0,
    department: '',
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
      await Promise.all([fetchPositions(), fetchDepartments()]);
    } catch (error) {
      console.error('Error checking access:', error);
      setError('Gagal memeriksa akses pengguna');
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchPositions = async () => {
    setContentLoading(true);
    try {
      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPositions(data || []);
    } catch (error) {
      console.error('Error fetching positions:', error);
      setError('Gagal memuat data jabatan');
    } finally {
      setContentLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setError('Gagal memuat data departemen');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const resetForm = () => {
    setFormData({
      name_id: '',
      name_en: '',
      description_id: '',
      description_en: '',
      base_salary: 0,
      min_salary: 0,
      max_salary: 0,
      department: '',
      is_active: true
    });
    setEditingPosition(null);
    setShowModal(false);
    setModalMode('add');
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name_id.trim() || !formData.name_en.trim()) {
      setError('Nama jabatan (Indonesia dan Inggris) harus diisi');
      return;
    }

    if (!formData.department) {
      setError('Departemen harus dipilih');
      return;
    }

    if (formData.min_salary > formData.max_salary) {
      setError('Gaji minimum tidak boleh lebih besar dari gaji maksimum');
      return;
    }

    setContentLoading(true);
    try {
      const positionData: Partial<Position> = {
        name_id: formData.name_id,
        name_en: formData.name_en,
        description_id: formData.description_id || null,
        description_en: formData.description_en || null,
        base_salary: parseFloat(formData.base_salary.toString()) || 0,
        min_salary: parseFloat(formData.min_salary.toString()) || 0,
        max_salary: parseFloat(formData.max_salary.toString()) || 0,
        department: formData.department,
        is_active: formData.is_active,
        updated_at: new Date().toISOString()
      };

      if (modalMode === 'edit' && editingPosition) {
        // Update existing position
        const { error } = await supabase
          .from('positions')
          .update(positionData)
          .eq('id', editingPosition.id);

        if (error) throw error;
        Swal.fire({
          icon: 'success',
          title: 'Berhasil',
          text: `Jabatan "${formData.name_id}" berhasil diperbarui!`
        });
      } else {
        // Create new position
        positionData.created_at = new Date().toISOString();
        const { error } = await supabase
          .from('positions')
          .insert([positionData]);

        if (error) throw error;
        Swal.fire({
          icon: 'success',
          title: 'Berhasil',
          text: `Jabatan "${formData.name_id}" berhasil ditambahkan!`
        });
      }

      resetForm();
      await fetchPositions();
    } catch (error) {
      console.error('Error saving position:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal',
        text: `Gagal menyimpan jabatan: ${error.message}`
      });
    } finally {
      setContentLoading(false);
    }
  };

  const handleEdit = (position: Position) => {
    setFormData({
      name_id: position.name_id,
      name_en: position.name_en,
      description_id: position.description_id || '',
      description_en: position.description_en || '',
      base_salary: position.base_salary || 0,
      min_salary: position.min_salary || 0,
      max_salary: position.max_salary || 0,
      department: position.department || '',
      is_active: position.is_active
    });
    setEditingPosition(position);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleDelete = async (positionId: string, positionName: string) => {
    const result = await Swal.fire({
      title: 'Hapus Jabatan?',
      text: `Apakah Anda yakin ingin menghapus "${positionName}"? Tindakan ini tidak dapat dibatalkan.`,
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
      // Check if position is being used by any employee
      const { data: employees, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('position_id', positionId)
        .limit(1);

      if (checkError) throw checkError;

      if (employees && employees.length > 0) {
        Swal.fire({
          icon: 'error',
          title: 'Gagal',
          text: 'Jabatan tidak dapat dihapus karena masih digunakan oleh karyawan'
        });
        return;
      }

      const { error } = await supabase
        .from('positions')
        .delete()
        .eq('id', positionId);

      if (error) throw error;
      await fetchPositions();
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: `Jabatan "${positionName}" berhasil dihapus`
      });
    } catch (error) {
      console.error('Error deleting position:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal',
        text: `Gagal menghapus jabatan: ${error.message}`
      });
    } finally {
      setContentLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const filteredPositions = positions.filter(position => {
    const matchesSearch = position.name_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         position.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (position.department && position.department.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDepartment = filterDepartment === '' || position.department === departments.find(d => d.id === filterDepartment)?.name;
    
    return matchesSearch && matchesDepartment;
  });

  const paginatedPositions = filteredPositions.slice((currentPage - 1) * positionsPerPage, currentPage * positionsPerPage);
  const totalPages = Math.ceil(filteredPositions.length / positionsPerPage);

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
                <h1 className="text-2xl font-bold text-gray-900">Manajemen Jabatan</h1>
                <p className="text-sm text-gray-600 mt-1">Kelola jabatan dan struktur gaji dengan mudah</p>
              </div>
              <button
                onClick={() => { setModalMode('add'); setShowModal(true); }}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors sm:w-auto w-12 h-12"
              >
                <Plus className="h-5 w-5 sm:mr-2" />
                <span className="sm:inline hidden">Tambah Jabatan</span>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Briefcase className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Jabatan</p>
                  <p className="text-2xl font-bold text-gray-900">{positions.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Briefcase className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Jabatan Aktif</p>
                  <p className="text-2xl font-bold text-gray-900">{positions.filter(p => p.is_active).length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Rata-rata Gaji</p>
                  <p className="text-lg font-bold text-gray-900">
                    {positions.length > 0 
                      ? formatCurrency(positions.reduce((sum, p) => sum + (p.base_salary || 0), 0) / positions.length)
                      : formatCurrency(0)
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md mb-6 p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari jabatan atau departemen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                  />
                </div>
              </div>
              <div className="sm:w-48">
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Semua Departemen</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Briefcase className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Daftar Jabatan ({filteredPositions.length})
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
            ) : paginatedPositions.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-600 text-lg font-medium mb-2">Tidak ada jabatan ditemukan</p>
                <p className="text-gray-500">Sesuaikan pencarian atau tambah jabatan baru</p>
              </div>
            ) : (
              <>
                <div className="hidden lg:block">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Jabatan
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Departemen
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Gaji Pokok
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Rentang Gaji
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
                      {paginatedPositions.map((position) => (
                        <tr key={position.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{position.name_id}</div>
                              <div className="text-sm text-gray-500">{position.name_en}</div>
                              {position.description_id && (
                                <div className="text-xs text-gray-400 mt-1">{position.description_id}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <Building className="h-4 w-4 mr-1" />
                              {position.department || 'Tidak ada'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {formatCurrency(position.base_salary || 0)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {formatCurrency(position.min_salary || 0)} - {formatCurrency(position.max_salary || 0)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              position.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {position.is_active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-3">
                              <button
                                onClick={() => handleEdit(position)}
                                className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition-colors"
                                title="Edit Jabatan"
                              >
                                <Edit className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleDelete(position.id, position.name_id)}
                                className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50 transition-colors"
                                title="Hapus Jabatan"
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
                  {paginatedPositions.map((position) => (
                    <div key={position.id} className="bg-white rounded-xl shadow-md p-6 border border-gray-100 transition-transform hover:scale-[1.01]">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <Briefcase className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-base font-semibold text-gray-900">{position.name_id}</p>
                            <p className="text-sm text-gray-600">{position.name_en}</p>
                          </div>
                        </div>
                        <div className="flex space-x-3">
                          <button
                            onClick={() => handleEdit(position)}
                            className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50"
                          >
                            <Edit className="h-6 w-6" />
                          </button>
                          <button
                            onClick={() => handleDelete(position.id, position.name_id)}
                            className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50"
                          >
                            <Trash2 className="h-6 w-6" />
                          </button>
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 space-y-3">
                        <p><span className="font-medium">Departemen:</span> {position.department || 'Tidak ada'}</p>
                        <p><span className="font-medium">Gaji Pokok:</span> {formatCurrency(position.base_salary || 0)}</p>
                        <p><span className="font-medium">Rentang Gaji:</span> {formatCurrency(position.min_salary || 0)} - {formatCurrency(position.max_salary || 0)}</p>
                        {position.description_id && (
                          <p><span className="font-medium">Deskripsi:</span> {position.description_id}</p>
                        )}
                        <p>
                          <span className="font-medium">Status:</span>{' '}
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            position.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {position.is_active ? 'Aktif' : 'Nonaktif'}
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
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {modalMode === 'edit' ? 'Edit Jabatan' : 'Tambah Jabatan Baru'}
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
                  <h3 className="font-medium text-blue-900 mb-4">Informasi Dasar</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nama Jabatan (Indonesia) *
                      </label>
                      <input
                        type="text"
                        name="name_id"
                        value={formData.name_id}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Contoh: Manajer IT"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nama Jabatan (Inggris) *
                      </label>
                      <input
                        type="text"
                        name="name_en"
                        value={formData.name_en}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Contoh: IT Manager"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Departemen *
                    </label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">Pilih Departemen...</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="bg-gray-50 p-5 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-4">Deskripsi Jabatan</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Deskripsi (Indonesia)
                      </label>
                      <textarea
                        name="description_id"
                        value={formData.description_id}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Deskripsi tugas dan tanggung jawab..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Deskripsi (Inggris)
                      </label>
                      <textarea
                        name="description_en"
                        value={formData.description_en}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Job description and responsibilities..."
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 p-5 rounded-lg">
                  <h3 className="font-medium text-green-900 mb-4">Informasi Gaji</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Gaji Pokok (IDR)
                      </label>
                      <input
                        type="number"
                        name="base_salary"
                        value={formData.base_salary}
                        onChange={handleInputChange}
                        min="0"
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="5000000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Gaji Minimum (IDR)
                      </label>
                      <input
                        type="number"
                        name="min_salary"
                        value={formData.min_salary}
                        onChange={handleInputChange}
                        min="0"
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="4000000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Gaji Maksimum (IDR)
                      </label>
                      <input
                        type="number"
                        name="max_salary"
                        value={formData.max_salary}
                        onChange={handleInputChange}
                        min="0"
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="8000000"
                      />
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                    <div className="text-sm text-gray-600">
                      <p><span className="font-medium">Gaji Pokok:</span> {formatCurrency(formData.base_salary || 0)}</p>
                      <p><span className="font-medium">Rentang:</span> {formatCurrency(formData.min_salary || 0)} - {formatCurrency(formData.max_salary || 0)}</p>
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
                    Jabatan aktif (dapat dipilih saat menambah karyawan)
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
                          <span>{modalMode === 'edit' ? 'Perbarui Jabatan' : 'Simpan Jabatan'}</span>
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

export default PositionManagement;