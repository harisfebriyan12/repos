import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Edit, 
  Trash2, 
  ToggleLeft, 
  ToggleRight, 
  Search, 
  Save,
  X,
  Shield,
  Users,
  User,
  Mail,
  Phone,
  Camera,
  CheckCircle,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { supabase, uploadFile, getFileUrl } from '../utils/supabaseClient';
import Swal from 'sweetalert2';
import ProfileModal from '../components/ProfileModal';
import CustomFaceCapture from '../components/CustomFaceCapture';
import AdminSidebar from '../components/AdminSidebar';

const UserManagement = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add', 'edit'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    email: '',
    password: '',
    phone: '',
    location: '',
    title: '',
    bio: '',
    role: 'karyawan',
    position_id: '',
    employee_id: '',
    department: '',
    salary: 0,
    bank_id: '',
    bank_account_number: '',
    bank_account_name: '',
    status: 'active'
  });
  const [facePhoto, setFacePhoto] = useState(null);
  const [faceFingerprint, setFaceFingerprint] = useState(null);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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
      await Promise.all([fetchUsers(), fetchPositions(), fetchBanks()]);
    } catch (error) {
      console.error('Error checking access:', error);
      setError('Gagal memeriksa akses pengguna');
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setContentLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          positions(name_id, department, base_salary),
          bank_info(bank_name, bank_logo)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Gagal memuat data pengguna');
    } finally {
      setContentLoading(false);
    }
  };

  const fetchPositions = async () => {
    try {
      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .eq('is_active', true)
        .order('name_id');

      if (error) throw error;
      setPositions(data || []);
    } catch (error) {
      console.error('Error fetching positions:', error);
      setError('Gagal memuat data jabatan');
    }
  };

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
      setError('Gagal memuat data bank');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'position_id') {
      const selectedPosition = positions.find(p => p.id === value);
      if (selectedPosition) {
        const positionCode = selectedPosition.name_id.substring(0, 3).toUpperCase();
        const timestamp = Date.now().toString().slice(-4);
        const employeeId = modalMode === 'add' ? `${positionCode}${timestamp}` : formData.employee_id;
        
        setFormData(prev => ({
          ...prev,
          position_id: value,
          title: selectedPosition.name_id,
          department: selectedPosition.department || '',
          salary: selectedPosition.base_salary || 0,
          employee_id: employeeId
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          position_id: value,
          title: '',
          department: '',
          salary: 0,
          employee_id: ''
        }));
      }
    } else if (name === 'name' || name === 'full_name') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        bank_account_name: value
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleFaceCapture = (photoBlob, fingerprint) => {
    setFacePhoto(photoBlob);
    setFaceFingerprint(fingerprint);
  };

  const handleCreateUser = async () => {
    if (!formData.name || !formData.email || !formData.position_id) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Semua kolom wajib diisi' });
      return;
    }
    if (modalMode === 'add' && formData.password.length < 8) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Password minimal 8 karakter' });
      return;
    }
    if (formData.role !== 'admin' && !facePhoto) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Foto wajah diperlukan untuk karyawan' });
      return;
    }
    if (formData.role !== 'admin' && !faceFingerprint) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Fingerprint wajah tidak terdeteksi' });
      return;
    }
    setIsSubmitting(true);
    try {
      let userId;
      if (modalMode === 'add') {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
              role: formData.role
            }
          }
        });
        if (authError) throw authError;
        if (!authData.user) throw new Error('Pendaftaran gagal');
        userId = authData.user.id;
      } else {
        userId = formData.id;
      }

      let photoUrl = formData.avatar_url;
      if (formData.role !== 'admin' && facePhoto) {
        const fileName = `${userId}-face-${Date.now()}.jpg`;
        await uploadFile(facePhoto, 'face-photos', fileName);
        photoUrl = getFileUrl('face-photos', fileName);
      }

      const profileData = {
        id: userId,
        name: formData.name,
        full_name: formData.name,
        email: formData.email,
        phone: formData.phone,
        location: formData.location,
        title: formData.title,
        bio: formData.bio || `${getRoleDisplayName(formData.role)} di sistem absensi`,
        avatar_url: photoUrl,
        role: formData.role,
        position_id: formData.position_id,
        employee_id: formData.employee_id,
        department: formData.department,
        salary: formData.salary,
        bank_id: formData.bank_id || null,
        bank_account_number: formData.bank_account_number || null,
        bank_account_name: formData.bank_account_name || formData.name,
        is_face_registered: formData.role === 'admin' ? true : !!photoUrl,
        status: formData.status,
        join_date: new Date().toISOString().split('T')[0],
        contract_start_date: new Date().toISOString().split('T')[0],
        contract_type: 'permanent',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: profileError } = modalMode === 'add'
        ? await supabase.from('profiles').insert([profileData])
        : await supabase.from('profiles').update(profileData).eq('id', userId);

      if (profileError) throw profileError;

      const salaryData = {
        user_id: userId,
        daily_salary: formData.salary / 22,
        overtime_rate: 1.5,
        bonus: 0,
        deduction: 0,
        effective_date: new Date().toISOString().split('T')[0],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: salaryError } = modalMode === 'add'
        ? await supabase.from('employee_salaries').insert([salaryData])
        : await supabase.from('employee_salaries').update(salaryData).eq('user_id', userId).eq('is_active', true);

      if (salaryError && !salaryError.message.includes('0 rows')) throw salaryError;

      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        html: `<b>${formData.name}</b> (${getRoleDisplayName(formData.role)}) berhasil ${modalMode === 'add' ? 'ditambahkan' : 'diperbarui'}!`,
      });
      resetForm();
      await fetchUsers();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err.message || `Terjadi kesalahan saat ${modalMode === 'add' ? 'membuat' : 'memperbarui'} user` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    const result = await Swal.fire({
      title: 'Hapus Pengguna?',
      text: `Apakah Anda yakin ingin menghapus ${userName}? Tindakan ini tidak dapat dibatalkan.`,
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
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) throw profileError;

      await supabase
        .from('employee_salaries')
        .delete()
        .eq('user_id', userId);

      await fetchUsers();
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: `Pengguna ${userName} berhasil dihapus`
      });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal menghapus pengguna' });
    } finally {
      setContentLoading(false);
    }
  };

  const handleToggleStatus = async (userId, currentStatus, userName) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const actionText = newStatus === 'active' ? 'mengaktifkan' : 'menonaktifkan';
    const result = await Swal.fire({
      title: `${newStatus === 'active' ? 'Aktifkan' : 'Nonaktifkan'} Pengguna?`,
      text: `Apakah Anda yakin ingin ${actionText} ${userName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: `Ya, ${actionText}`,
      cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) return;

    setContentLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
      await fetchUsers();
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: `Pengguna ${userName} berhasil ${newStatus === 'active' ? 'diaktifkan' : 'dinonaktifkan'}`
      });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: `Gagal ${actionText} pengguna` });
    } finally {
      setContentLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      email: '',
      password: '',
      phone: '',
      location: '',
      title: '',
      bio: '',
      role: 'karyawan',
      position_id: '',
      employee_id: '',
      department: '',
      salary: 0,
      bank_id: '',
      bank_account_number: '',
      bank_account_name: '',
      status: 'active'
    });
    setFacePhoto(null);
    setFaceFingerprint(null);
    setStep(1);
    setShowModal(false);
    setModalMode('add');
    setError(null);
    setSuccess(null);
  };

  const handleEditUser = (user) => {
    setFormData({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      location: user.location || '',
      title: user.title || user.positions?.name_id || '',
      bio: user.bio || '',
      role: user.role,
      position_id: user.position_id || '',
      employee_id: user.employee_id || '',
      department: user.department || user.positions?.department || '',
      salary: user.salary || user.positions?.base_salary || 0,
      bank_id: user.bank_id || '',
      bank_account_number: user.bank_account_number || '',
      bank_account_name: user.bank_account_name || user.name,
      status: user.status || 'active',
      avatar_url: user.avatar_url || ''
    });
    setFacePhoto(null);
    setFaceFingerprint(null);
    setModalMode('edit');
    setStep(1);
    setShowModal(true);
  };

  const getRoleDisplayName = (role) => {
    return role === 'admin' ? 'Administrator' : 'Karyawan';
  };

  const getRoleIcon = (role) => {
    return role === 'admin' ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />;
  };

  const getRoleColor = (role) => {
    return role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  };

  const getStatusColor = (status) => {
    return status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const canManageUser = (userId) => {
    return currentUser?.id !== userId;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getDepartments = () => {
    return [...new Set(users.map(u => u.department || u.positions?.department).filter(Boolean))];
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.employee_id && user.employee_id.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDepartment = filterDepartment === '' || 
                             user.department === filterDepartment || 
                             user.positions?.department === filterDepartment;
    const matchesRole = filterRole === '' || user.role === filterRole;
    
    return matchesSearch && matchesDepartment && matchesRole;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex space-x-2 text-blue-600">
            <div className="w-3 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
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
                <h1 className="text-2xl font-bold text-gray-900">Manajemen Pengguna</h1>
                <p className="text-sm text-gray-600 mt-1">Kelola data pengguna sistem dengan mudah dan aman</p>
              </div>
              <button
                onClick={() => { setModalMode('add'); setShowModal(true); }}
                className="flex items-center justify-center space-x-2 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>Tambah Pengguna</span>
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

          <div className="bg-white rounded-xl shadow-md mb-6 p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari nama, email, atau ID karyawan..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Semua Departemen</option>
                  {getDepartments().map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Semua Role</option>
                  <option value="karyawan">Karyawan</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Daftar Pengguna ({filteredUsers.length})
                </h2>
              </div>
            </div>

            {contentLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="inline-flex space-x-2 text-blue-600">
                  <div className="w-3 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-3 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-3 h-3 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-600 text-lg font-medium mb-2">Tidak ada pengguna ditemukan</p>
                <p className="text-gray-500">Sesuaikan pencarian atau filter untuk menemukan pengguna</p>
              </div>
            ) : (
              <>
                <table className="min-w-full divide-y divide-gray-200 hidden lg:table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pengguna
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Jabatan & Departemen
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gaji
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kontak
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
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                              {user.avatar_url ? (
                                <img 
                                  src={user.avatar_url} 
                                  alt={user.name}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getRoleColor(user.role)}`}>
                                  {getRoleIcon(user.role)}
                                </div>
                              )}
                            </div>
                            <div>
                              <div 
                                className="text-sm font-medium text-blue-600 cursor-pointer hover:underline"
                                onClick={() => { setProfile(user); setShowProfileModal(true); }}
                              >
                                {user.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {user.employee_id || 'N/A'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {user.positions?.name_id || user.title || getRoleDisplayName(user.role)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.positions?.department || user.department || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(user.positions?.base_salary || user.salary || 0)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 flex items-center">
                            <Mail className="h-4 w-4 mr-2 text-gray-400" />
                            <span 
                              className="cursor-pointer text-blue-600 hover:underline"
                              onClick={() => { setProfile(user); setShowProfileModal(true); }}
                            >
                              {user.email}
                            </span>
                          </div>
                          {user.phone && (
                            <div className="text-sm text-gray-500 flex items-center mt-1">
                              <Phone className="h-4 w-4 mr-2 text-gray-400" />
                              {user.phone}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="space-y-2">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                              {user.role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                              {getRoleDisplayName(user.role)}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                              {user.status === 'active' ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-3">
                            {canManageUser(user.id) ? (
                              <>
                                <button
                                  onClick={() => handleEditUser(user)}
                                  className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition-colors"
                                  title="Edit Pengguna"
                                >
                                  <Edit className="h-5 w-5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.id, user.name)}
                                  className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50 transition-colors"
                                  title="Hapus Pengguna"
                                >
                                  <Trash2 className="h-5 w-5" />
                                </button>
                                <button
                                  onClick={() => handleToggleStatus(user.id, user.status, user.name)}
                                  className="text-purple-600 hover:text-purple-800 p-2 rounded-full hover:bg-purple-50 transition-colors"
                                  title={user.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                                >
                                  {user.status === 'active' ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                                </button>
                              </>
                            ) : (
                              <span className="text-gray-400 text-sm">Akun Anda</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="lg:hidden p-6 space-y-6">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="bg-white rounded-xl shadow-md p-6 border border-gray-100 transition-transform hover:scale-[1.01]">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                            {user.avatar_url ? (
                              <img 
                                src={user.avatar_url} 
                                alt={user.name}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getRoleColor(user.role)}`}>
                                {getRoleIcon(user.role)}
                              </div>
                            )}
                          </div>
                          <div>
                            <p 
                              className="text-base font-semibold text-blue-600 cursor-pointer hover:underline"
                              onClick={() => { setProfile(user); setShowProfileModal(true); }}
                            >
                              {user.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {user.positions?.name_id || user.title || getRoleDisplayName(user.role)}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-3">
                          {canManageUser(user.id) ? (
                            <>
                              <button
                                onClick={() => handleEditUser(user)}
                                className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50"
                              >
                                <Edit className="h-6 w-6" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id, user.name)}
                                className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50"
                              >
                                <Trash2 className="h-6 w-6" />
                              </button>
                              <button
                                onClick={() => handleToggleStatus(user.id, user.status, user.name)}
                                className="text-purple-600 hover:text-purple-800 p-2 rounded-full hover:bg-purple-50"
                              >
                                {user.status === 'active' ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                              </button>
                            </>
                          ) : (
                            <span className="text-gray-400 text-sm">Akun Anda</span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 space-y-3">
                        <p><span className="font-medium">ID:</span> {user.employee_id || 'N/A'}</p>
                        <p><span className="font-medium">Departemen:</span> {user.positions?.department || user.department || 'N/A'}</p>
                        <p><span className="font-medium">Gaji:</span> {formatCurrency(user.positions?.base_salary || user.salary || 0)}</p>
                        <p><span className="font-medium">Email:</span> {user.email}</p>
                        {user.phone && <p><span className="font-medium">Telepon:</span> {user.phone}</p>}
                        <p>
                          <span className="font-medium">Role:</span>{' '}
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                            {user.role === 'admin' && <Shield className="h-4 w-4 mr-1" />}
                            {getRoleDisplayName(user.role)}
                          </span>
                        </p>
                        <p>
                          <span className="font-medium">Status:</span>{' '}
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                            {user.status === 'active' ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </p>
                        {user.bank_info && <p><span className="font-medium">Bank:</span> {user.bank_info.bank_name}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {showProfileModal && (
            <ProfileModal profile={profile} onClose={() => setShowProfileModal(false)} />
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {modalMode === 'add' ? 'Tambah Pengguna Baru' : 'Edit Pengguna'}
                </h2>
                <button
                  onClick={resetForm}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {modalMode !== 'password' && (
                <div className="flex items-center justify-center mb-6">
                  {[1, 2].map((stepNum) => (
                    <div key={stepNum} className="flex items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                        step >= stepNum
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {step > stepNum ? <CheckCircle className="h-6 w-6" /> : stepNum}
                      </div>
                      {stepNum < 2 && (
                        <div className={`w-12 h-1 mx-3 ${
                          step > stepNum ? 'bg-blue-600' : 'bg-gray-200'
                        }`} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {step === 1 ? (
                <form onSubmit={(e) => { e.preventDefault(); formData.role === 'admin' ? handleCreateUser() : setStep(2); }} className="space-y-6">
                  <div className="bg-blue-50 p-5 rounded-lg">
                    <h3 className="font-medium text-blue-900 mb-4">Informasi Jabatan</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Jabatan *
                        </label>
                        <select
                          name="position_id"
                          value={formData.position_id}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="">Pilih Jabatan...</option>
                          {positions.map(position => (
                            <option key={position.id} value={position.id}>
                              {position.name_id} - {position.department} ({formatCurrency(position.base_salary || 0)})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ID Karyawan
                        </label>
                        <input
                          type="text"
                          value={formData.employee_id}
                          readOnly
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-sm"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Gaji Bulanan
                      </label>
                      <input
                        type="text"
                        value={formatCurrency(formData.salary)}
                        readOnly
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nama Lengkap *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Masukkan nama lengkap"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Masukkan email"
                      />
                    </div>
                  </div>

                  {modalMode === 'add' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password *
                        </label>
                        <input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          placeholder="Minimal 8 karakter"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Role
                        </label>
                        <select
                          name="role"
                          value={formData.role}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="karyawan">Karyawan</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        No. Telepon
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="+62-21-1234567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Lokasi
                      </label>
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="Jakarta, Indonesia"
                      />
                    </div>
                  </div>

                  <div className="bg-green-50 p-5 rounded-lg">
                    <h3 className="font-medium text-green-900 mb-4">Informasi Bank</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bank
                        </label>
                        <select
                          name="bank_id"
                          value={formData.bank_id}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="">Pilih Bank...</option>
                          {banks.map(bank => (
                            <option key={bank.id} value={bank.id}>
                              {bank.bank_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nomor Rekening
                        </label>
                        <input
                          type="text"
                          name="bank_account_number"
                          value={formData.bank_account_number}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          placeholder="Nomor rekening"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nama Pemilik Rekening
                      </label>
                      <input
                        type="text"
                        value={formData.bank_account_name}
                        readOnly
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bio
                    </label>
                    <textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="Deskripsi singkat tentang pengguna"
                    />
                  </div>

                  {modalMode === 'edit' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value="active">Aktif</option>
                        <option value="inactive">Nonaktif</option>
                      </select>
                    </div>
                  )}

                  {formData.role === 'admin' && (
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start space-x-3">
                        <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-blue-800 font-medium">Administrator</p>
                          <p className="text-blue-700 text-sm mt-1">
                            Administrator memiliki akses penuh ke sistem tanpa memerlukan verifikasi wajah.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

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
                      disabled={isSubmitting}
                      className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <Save className="h-5 w-5" />
                        <span>{formData.role === 'admin' ? 'Simpan Administrator' : 'Lanjut ke Verifikasi Wajah'}</span>
                      </div>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="text-center">
                    <Camera className="h-12 w-12 text-blue-600 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900">Verifikasi Wajah</h3>
                    <p className="text-gray-600 text-sm mt-2">
                      Ambil foto wajah yang jelas untuk keperluan absensi. Pastikan pencahayaan cukup dan wajah terlihat jelas.
                    </p>
                  </div>

                  <CustomFaceCapture onFaceCapture={handleFaceCapture} isCapturing={isSubmitting} />

                  {facePhoto && faceFingerprint && (
                    <div className="text-center bg-green-50 p-4 rounded-lg">
                      <div className="inline-flex items-center space-x-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span>Foto wajah berhasil diverifikasi!</span>
                      </div>
                    </div>
                  )}
                  {facePhoto && !faceFingerprint && (
                    <div className="text-center bg-yellow-50 p-4 rounded-lg">
                      <div className="inline-flex items-center space-x-2 text-yellow-600">
                        <AlertTriangle className="h-5 w-5" />
                        <span>Fingerprint wajah tidak terdeteksi. Silakan ulangi.</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      Kembali
                    </button>
                    <button
                      onClick={handleCreateUser}
                      disabled={!facePhoto || !faceFingerprint || isSubmitting}
                      className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        {isSubmitting ? (
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
                            <span>{modalMode === 'add' ? 'Buat Pengguna' : 'Perbarui Pengguna'}</span>
                          </>
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;