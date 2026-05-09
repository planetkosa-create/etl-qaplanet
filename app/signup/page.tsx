import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/etl/LoginForm";

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-md">
        <Link href="/login" className="text-sm font-semibold text-slate-700 hover:text-blue-600">
          ← Back to login
        </Link>
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
          <h1 className="text-2xl font-bold tracking-tight">Create Account</h1>
          <p className="mt-3 text-sm text-slate-600">Create an ETL QAplanet account with Supabase Auth.</p>
          <Suspense fallback={<p className="mt-6 text-sm text-slate-600">Loading signup form...</p>}>
            <LoginForm mode="signup" />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
