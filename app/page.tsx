import { redirect } from 'next/navigation';

// La raíz siempre redirige al dashboard.
// El layout del dashboard se encarga de redirigir a /auth/login si no hay sesión.
export default function RootPage() {
  redirect('/dashboard');
}
