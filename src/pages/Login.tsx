import React, { useState, useEffect, lazy, Suspense, useRef } from 'react';
import Swal from 'sweetalert2';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LogIn, Mail, Lock, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient.ts';
import RecaptchaInfo from '../components/RecaptchaInfo';

const ReCAPTCHA = lazy(() => import('react-google-recaptcha'));

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const recaptchaRef = useRef(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [isCaptchaLoaded, setIsCaptchaLoaded] = useState(false);

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      if (location.state?.email) {
        setFormData(prev => ({ ...prev, email: location.state.email }));
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError(null);
  };

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      Swal.fire({ 
        icon: 'warning', 
        title: 'Form Tidak Lengkap', 
        text: 'Silakan isi email dan password',
        confirmButtonColor: '#1e40af'
      });
      return false;
    }

    if (!captchaToken) {
      Swal.fire({ 
        icon: 'warning', 
        title: 'Verifikasi Diperlukan', 
        html: `
          <div class="text-left">
            <p>Silakan verifikasi bahwa Anda bukan robot</p>
            <p class="mt-2 text-sm text-gray-600">Centang reCAPTCHA untuk melanjutkan.</p>
          </div>
        `,
        confirmButtonColor: '#1e40af'
      });
      return false;
    }

    return true;
  };

  const resetFormState = () => {
    setIsLoading(false);
    setError(null);
    setCaptchaToken(null);
    if (recaptchaRef.current) {
      recaptchaRef.current.reset();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Sistem belum dikonfigurasi. Silakan hubungi administrator.');
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (signInError) throw signInError;

      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, name, is_face_registered, status')
          .eq('id', data.user.id)
          .single();

        if (profileError) throw profileError;
        if (profile.status !== 'active') {
          await supabase.auth.signOut();
          throw new Error('Akun Anda tidak aktif. Silakan hubungi administrator.');
        }

        await supabase.from('activity_logs').insert([{
          user_id: data.user.id,
          action_type: 'login',
          action_details: {
            email: data.user.email,
            role: profile?.role || 'unknown',
            timestamp: new Date().toISOString()
          },
          ip_address: 'unknown',
          user_agent: navigator.userAgent
        }]);

        await supabase
          .from('profiles')
          .update({ 
            last_login: new Date().toISOString(),
            device_info: {
              user_agent: navigator.userAgent,
              timestamp: new Date().toISOString()
            }
          })
          .eq('id', data.user.id);

        await Swal.fire({
          icon: 'success',
          title: 'Login Berhasil',
          html: `
            <div class="text-center">
              <h3 class="text-xl font-bold text-gray-800">Selamat datang, ${profile?.name || data.user.email}!</h3>
              <p class="mt-2 text-gray-600">Anda akan diarahkan ke dashboard</p>
            </div>
          `,
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true
        });

        navigate(profile?.role === 'admin' ? '/admin/dashboard' : '/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);
      
      const errorMessages = {
        'Invalid login credentials': 'Email atau password salah',
        'Email not confirmed': 'Email belum dikonfirmasi. Silakan cek email Anda.',
        'Too many requests': 'Terlalu banyak percobaan login. Silakan coba lagi nanti.',
        'Sistem belum dikonfigurasi': err.message,
        'Akun Anda tidak aktif': err.message
      };

      const errorMessage = errorMessages[err.message] || 'Terjadi kesalahan saat login';

      await Swal.fire({
        icon: 'error',
        title: 'Login Gagal',
        html: `
          <div class="text-left">
            <p class="font-medium">${errorMessage}</p>
            ${err.message.includes('credentials') ? (
              '<p class="mt-2 text-sm text-gray-600">Pastikan email dan password yang Anda masukkan benar.</p>'
            ) : ''}
          </div>
        `,
        confirmButtonColor: '#1e40af'
      });

      resetFormState();
    } finally {
      setIsLoading(false);
    }
  };

  const handleCaptchaChange = (token) => {
    setCaptchaToken(token);
    setError(null);
  };

  const handleCaptchaExpired = () => {
    setCaptchaToken(null);
    Swal.fire({
      icon: 'info',
      title: 'Verifikasi Kadaluarsa',
      text: 'Silakan verifikasi ulang bahwa Anda bukan robot',
      timer: 3000,
      showConfirmButton: false
    });
  };

  const handleCaptchaError = () => {
    setCaptchaToken(null);
    Swal.fire({
      icon: 'error',
      title: 'Verifikasi Gagal',
      text: 'Terjadi kesalahan saat memverifikasi reCAPTCHA. Silakan coba lagi.',
      confirmButtonColor: '#1e40af'
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-teal-50 to-emerald-100 dark:from-gray-800 dark:to-gray-900 animate-gradient">
      <div className="w-full max-w-md mx-auto">
        {/* Login Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 transform transition-all duration-300 hover:shadow-3xl">
          <div className="mb-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-teal-100 dark:bg-teal-800 rounded-full">
                <LogIn className="h-8 w-8 text-teal-600 dark:text-teal-300" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 font-poppins">Masuk ke Akun Anda</h2>
          </div>

          {!isSupabaseConfigured() && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900 rounded-lg flex items-start space-x-3 animate-pulse">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <p className="text-yellow-800 dark:text-yellow-200 font-medium">Sistem Belum Dikonfigurasi</p>
                <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                  Database belum terhubung. Hubungi administrator.
                </p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900 rounded-lg flex items-start space-x-3 animate-slide-in">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              <p className="text-green-800 dark:text-green-200 font-medium">{successMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-poppins">
                Alamat Email
              </label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-teal-500 transition-colors" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 transition-all duration-200 hover:border-teal-300 dark:hover:border-teal-500 placeholder-gray-400 dark:placeholder-gray-500 font-poppins"
                  placeholder="Masukkan email Anda"
                  aria-label="Alamat Email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 font-poppins">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-teal-500 transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-12 py-3 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 transition-all duration-200 hover:border-teal-300 dark:hover:border-teal-500 placeholder-gray-400 dark:placeholder-gray-500 font-poppins"
                  placeholder="Masukkan password Anda"
                  aria-label="Password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-teal-500 p-1 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

        

            {/* ReCAPTCHA */}
            <div className="flex justify-center">
              <Suspense fallback={
                <div className="h-20 w-full flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-teal-500"></div>
                </div>
              }>
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"}
                  onChange={handleCaptchaChange}
                  onExpired={handleCaptchaExpired}
                  onErrored={handleCaptchaError}
                  theme="light"
                  size="normal"
                  className="mx-auto transform transition-all duration-300"
                  onLoad={() => setIsCaptchaLoaded(true)}
                />
              </Suspense>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading || !isSupabaseConfigured()}
              className={`w-full py-3 px-4 rounded-lg font-semibold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105 font-poppins
                         ${isLoading ? 'opacity-70 cursor-wait' : ''}
                         ${!isSupabaseConfigured() ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V8H4z"></path>
                  </svg>
                  Memproses...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                
                  Masuk
                </span>
              )}
            </button>
          </form>
        </div>

        
      </div>

      {/* Custom CSS for Animations and Gradient Background */}
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

        .font-poppins {
          font-family: 'Poppins', sans-serif;
        }

        .animate-gradient {
          background: linear-gradient(45deg, #eff6ff, #dbeafe, #e0e7ff, #c7d2fe);
          background-size: 400%;
          animation: gradient 15s ease infinite;
        }

        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .animate-slide-in {
          animation: slideIn 0.5s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .shadow-3xl {
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
      `}</style>
    </div>
  );
};

export default Login;