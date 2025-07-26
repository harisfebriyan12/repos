import React, { useState, useEffect, lazy, Suspense, useRef } from 'react';
import Swal from 'sweetalert2';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LogIn, Mail, Lock, AlertCircle, Building2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
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
        confirmButtonColor: '#3b82f6'
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
        confirmButtonColor: '#3b82f6'
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
        confirmButtonColor: '#3b82f6'
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
      confirmButtonColor: '#3b82f6'
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gray-100">
      <div className="w-full max-w-md">

        {/* Login Form */}
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900">Masuk ke Akun Anda</h2>
            <p className="text-gray-500 mt-2">Silakan login menggunakan email dan password</p>
          </div>

          {!isSupabaseConfigured() && (
            <div className="mb-6 p-4 bg-yellow-50 rounded-lg flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-yellow-800 font-medium">Sistem Belum Dikonfigurasi</p>
                <p className="text-yellow-700 text-sm mt-1">
                  Database belum terhubung. Hubungi administrator.
                </p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <p className="text-green-800 font-medium">{successMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-colors"
                  placeholder="Masukkan email Anda"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-colors"
                  placeholder="Masukkan password Anda"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
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
                <div className="h-20 w-full flex items-center justify-center bg-gray-50 rounded-lg">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
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
                  className="mx-auto"
                  onLoad={() => setIsCaptchaLoaded(true)}
                />
              </Suspense>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading || !isSupabaseConfigured()}
              className={`w-full py-3 px-4 rounded-lg font-semibold text-white
                         ${isLoading ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'}
                         ${!isSupabaseConfigured() ? 'opacity-70 cursor-not-allowed' : ''}
                         focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200`}
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
                  <LogIn className="h-5 w-5 mr-2" />
                  Masuk
                </span>
              )}
            </button>
          </form>

      
        </div>
      </div>
    </div>
  );
};

export default Login;