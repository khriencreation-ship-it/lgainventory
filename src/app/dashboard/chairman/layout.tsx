import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/auth';
import { query } from '@/lib/db';
import ChairmanSidebar from '@/components/ChairmanSidebar';
import ChairmanHeader from '@/components/ChairmanHeader';

export const dynamic = 'force-dynamic';

export default async function ChairmanDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;

  if (!sessionToken) {
    redirect('/');
  }

  const user = await verifyJWT(sessionToken);

  if (!user || (user.role !== 'lg_chairman' && user.role !== 'lg_admin')) {
    redirect('/');
  }

  // Fetch the local government record matching user.lg_id
  const lgQuery = await query(
    'SELECT name, code, logo_url FROM local_governments WHERE id = $1',
    [user.lg_id]
  );

  if (lgQuery.rows.length === 0) {
    redirect('/');
  }

  const lg = lgQuery.rows[0];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col md:flex-row p-0">
      {/* Sidebar Navigation */}
      <ChairmanSidebar user={user} lg={lg} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-64">
        {/* Top Header Bar */}
        <ChairmanHeader user={user} />

        {/* Content Wrapper */}
        <main className="flex-1 overflow-y-auto px-6 md:px-8 pt-4 md:pt-2 pb-12">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
