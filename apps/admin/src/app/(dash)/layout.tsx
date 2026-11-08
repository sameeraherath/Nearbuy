import Link from 'next/link';
import { formatSriLankanMobile } from '@nearbuy/shared';
import { requireAdmin } from '@/lib/auth';
import { NavLinks } from './nav-links';
import { signOut } from './actions';

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-navy text-white md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0">
        <div className="flex items-center justify-between p-4 md:block">
          <Link href="/orders" className="text-xl font-bold">
            near<span className="text-primary">buy</span>
            <span className="ml-2 text-xs font-normal text-white/60">admin</span>
          </Link>
        </div>
        <NavLinks />
        <div className="hidden border-t border-white/10 p-4 text-xs text-white/70 md:block">
          <div className="font-semibold text-white">{profile.full_name || 'Admin'}</div>
          <div>{formatSriLankanMobile(profile.phone)}</div>
          <form action={signOut} className="mt-2">
            <button className="underline hover:text-white">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
