import React, { useState, useEffect } from 'react';
import { X, Mail, Phone, MapPin, Briefcase, Building, DollarSign, Shield, User } from 'lucide-react';

interface Position {
  name_id?: string;
  department?: string;
  base_salary?: number;
}

interface Profile {
  name: string;
  email: string;
  role: 'admin' | 'employee';
  avatar_url?: string;
  phone?: string;
  location?: string;
  department?: string;
  title?: string;
  salary?: number;
  positions?: Position;
}

interface ProfileModalProps {
  profile: Profile | null;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ profile, onClose }) => {
  const [isImageError, setIsImageError] = useState(false);

  if (!profile) return null;

  const getRoleDisplayName = (role: string): string => {
    return role === 'admin' ? 'Administrator' : 'Karyawan';
  };

  const getRoleColor = (role: string): string => {
    return role === 'admin' 
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
      : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  };

  const formatCurrency = (amount: number | undefined): string => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  useEffect(() => {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 transition-opacity duration-300"
      role="dialog"
      aria-labelledby="profile-modal-title"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100">
        <div className="p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <img 
                src={isImageError ? 'https://via.placeholder.com/150' : profile.avatar_url || 'https://via.placeholder.com/150'} 
                alt={profile.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-gray-700 shadow-lg mb-4"
                onError={() => setIsImageError(true)}
              />
              <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/20 to-transparent" />
            </div>
            <h2 id="profile-modal-title" className="text-2xl font-bold text-gray-900 dark:text-white">{profile.name}</h2>
            <p className="text-gray-600 dark:text-gray-300">{profile.positions?.name_id || profile.title || getRoleDisplayName(profile.role)}</p>
            
            <div className={`mt-3 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(profile.role)}`}>
              {profile.role === 'admin' ? <Shield className="h-4 w-4 mr-1.5" /> : <User className="h-4 w-4 mr-1.5" />}
              {getRoleDisplayName(profile.role)}
            </div>
          </div>

          <div className="mt-8 text-sm text-gray-700 dark:text-gray-300 space-y-6">
            <div className="flex items-start">
              <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Email</p>
                <a 
                  href={`mailto:${profile.email}`} 
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                  aria-label={`Email ${profile.name}`}
                >
                  {profile.email}
                </a>
              </div>
            </div>

            {profile.phone && (
              <div className="flex items-start">
                <Phone className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Telepon</p>
                  <p>{profile.phone}</p>
                </div>
              </div>
            )}

            {profile.location && (
              <div className="flex items-start">
                <MapPin className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Lokasi</p>
                  <p>{profile.location}</p>
                </div>
              </div>
            )}

            <div className="flex items-start">
              <Building className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Departemen</p>
                <p>{profile.positions?.department || profile.department || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-start">
              <Briefcase className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Jabatan</p>
                <p>{profile.positions?.name_id || profile.title || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-start">
              <DollarSign className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Gaji Pokok</p>
                <p>{formatCurrency(profile.positions?.base_salary || profile.salary)}</p>
              </div>
            </div>
          </div>
          
          <div className="mt-8">
            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;