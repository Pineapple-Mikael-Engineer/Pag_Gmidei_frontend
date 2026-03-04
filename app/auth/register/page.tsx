'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import Link from 'next/link';


const registerSchema = z.object({
  fullName: z.string().min(3, 'Mínimo 3 caracteres').max(100),
  email: z.string().email('Email inválido').endsWith('@uni.pe', 'Solo correos @uni.pe'),
  password: z.string().min(8, 'Mínimo 8 caracteres').regex(/[A-Z]/, 'Debe tener al menos una mayúscula').regex(/[0-9]/, 'Debe tener al menos un número'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, { message: 'Las contraseñas no coinciden', path: ['confirmPassword'] });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore(s => s.setAuth);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async ({ confirmPassword, ...data }: RegisterForm) => {
    setError('');
    try {
      const res = await authApi.register(data);
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al registrarse.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center"><span className="text-white text-2xl font-bold">U</span></div>
          <h1 className="text-2xl font-bold text-gray-900">Crear cuenta</h1>
          <p className="text-gray-500 mt-1 text-sm">Estado inicial: Miembro (asignado automáticamente)</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label><input {...register('fullName')} placeholder="Juan Pérez" className="w-full border border-gray-300 rounded-lg px-4 py-2.5" />{errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}</div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Correo institucional</label><input {...register('email')} type="email" placeholder="tu.nombre@uni.pe" className="w-full border border-gray-300 rounded-lg px-4 py-2.5" />{errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}</div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label><input {...register('password')} type="password" className="w-full border border-gray-300 rounded-lg px-4 py-2.5" />{errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}</div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label><input {...register('confirmPassword')} type="password" className="w-full border border-gray-300 rounded-lg px-4 py-2.5" />{errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}</div>
          <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg">{isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}</button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">¿Ya tienes cuenta? <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">Inicia sesión</Link></p>
      </div>
    </div>
  );
}
