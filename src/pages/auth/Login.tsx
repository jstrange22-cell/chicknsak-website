import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthContext } from '@/components/auth/AuthProvider';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const { signIn, signInWithGoogle, error, clearError } = useAuthContext();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    clearError();
    try {
      await signIn(data.email, data.password);
      navigate('/');
    } catch {
      // Error is handled by useAuth
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    clearError();
    try {
      await signInWithGoogle();
      navigate('/');
    } catch {
      // Error is handled by useAuth
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <img
          src="/img/logo-light.png"
          alt="ProjectWorks"
          className="mx-auto h-20 w-20 object-contain mb-2"
        />

        {/* Brand name */}
        <h1 className="text-2xl font-bold text-slate-900 text-center mb-8">
          ProjectWorks
        </h1>

        {/* Login form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Email input */}
          <input
            type="email"
            placeholder="Email address"
            autoComplete="email"
            className={`w-full h-12 px-4 bg-slate-100 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 border-none ${
              errors.email ? 'ring-2 ring-red-500' : ''
            }`}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-red-500 px-1">{errors.email.message}</p>
          )}

          {/* Password input */}
          <input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            className={`w-full h-12 px-4 bg-slate-100 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 border-none ${
              errors.password ? 'ring-2 ring-red-500' : ''
            }`}
            {...register('password')}
          />
          {errors.password && (
            <p className="text-xs text-red-500 px-1">{errors.password.message}</p>
          )}

          {/* Remember me checkbox */}
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Remember me
          </label>

          {/* Auth error message */}
          {error && (
            <p className="text-sm text-red-600 px-1">{error}</p>
          )}

          {/* Sign in button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {isLoading && (
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            Sign in
          </button>
        </form>

        {/* Links row */}
        <div className="flex justify-between text-sm mt-4">
          <Link
            to="/auth/signup"
            className="text-blue-600 hover:underline font-medium"
          >
            Sign up
          </Link>
          <Link
            to="/auth/forgot-password"
            className="text-blue-600 hover:underline font-medium"
          >
            Forgot password?
          </Link>
        </div>

        {/* OR divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-sm text-slate-400 font-medium">OR</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* Google sign-in button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
          className="w-full h-12 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg text-sm font-medium text-slate-700 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          {isGoogleLoading ? (
            <svg
              className="h-5 w-5 animate-spin text-slate-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          Continue with Google
        </button>

        {/* Privacy Policy link */}
        <p className="text-center text-xs text-slate-400 mt-8">
          <a href="#" className="hover:underline">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
