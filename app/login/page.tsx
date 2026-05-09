import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/etl/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-md">
        <Link href="https://qaplanet.ca" className="text-sm font-semibold text-slate-700 hover:text-blue-600">
          ← Back to QAplanet
        </Link>
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
          <h1 className="text-2xl font-bold tracking-tight">Login</h1>
          <p className="mt-3 text-sm text-slate-600">Use Supabase Auth to access your ETL QAplanet workspace.</p>
          <Suspense fallback={<p className="mt-6 text-sm text-slate-600">Loading login form...</p>}>
            <LoginForm mode="login" />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
