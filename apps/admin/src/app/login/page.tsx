import { LoginForm } from './login-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6">
          <div className="text-2xl font-bold">
            near<span className="text-primary">buy</span>
          </div>
          <p className="text-sm text-muted">Admin sign in</p>
        </div>
        {error === 'not_admin' && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-bad">This account is not an admin.</p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
