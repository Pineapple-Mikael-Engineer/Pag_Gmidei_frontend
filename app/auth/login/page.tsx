'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import Link from 'next/link';

const loginSchema = z.object({
  email: z.string().email('Email inválido').endsWith('@uni.pe', 'Solo correos @uni.pe'),
  password: z.string().min(1, 'Contraseña requerida'),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setError('');
    try {
      const res = await authApi.login(data);
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al iniciar sesión.');
    }
  };

  return (
    <div className="min-h-screen auth-shell flex items-center justify-center p-4">
      <div className="auth-card w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 auth-logo mx-auto mb-4 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">U</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Plataforma UNI</h1>
          <p className="text-slate-500 mt-1">Inicia sesión con tu correo institucional</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Correo institucional</label>
            <input {...register('email')} type="email" placeholder="tu.nombre@uni.pe" className="input" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
            <input {...register('password')} type="password" placeholder="••••••••" className="input" />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full btn-primary disabled:opacity-50">
            {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          ¿No tienes cuenta?{' '}
          <Link href="/auth/register" className="text-blue-600 hover:underline font-medium">
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  );
}
