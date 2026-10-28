
"use client";

import Link from "next/link";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GuestGuard from "../components/GuestGuard";

import { API_URL, loginDestination, saveSession } from "../lib/auth";

export default function LoginPage() {
  return (
    <GuestGuard>
      <LoginForm />
    </GuestGuard>
  );
}

function RegistrationSuccess() {
  const params = useSearchParams();
  return params.get("registered") === "true" ? <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Account created successfully. Sign in to continue.</p> : null;
}

function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to sign in. Please try again.");
        return;
      }

      saveSession(data.token, data.user);
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(loginDestination(data.user.role, next));
    } catch {
      setError(
        "Unable to sign in right now. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col bg-white text-slate-900">
      <section className="relative flex flex-1 items-center justify-center overflow-hidden bg-emerald-50 px-5 py-12 sm:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full border-[40px] border-emerald-100/70"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-24 size-80 rounded-full border-[40px] border-emerald-100/70"
        />

        <div className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-emerald-900/5 md:grid-cols-2">
          <div className="flex flex-col justify-between bg-emerald-900 p-8 text-white sm:p-10 lg:p-12">
            <Link href="/" className="flex w-fit items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-xl bg-white text-xl font-extrabold text-emerald-800">
                C
              </span>
              <span className="text-xl font-extrabold tracking-tight">
                Career<span className="text-emerald-300">Path</span>
              </span>
            </Link>

            <div className="py-10 md:py-16">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-700 bg-emerald-800/60 px-3 py-2 text-xs font-bold tracking-widest text-emerald-100">
                <span className="size-2 rounded-full bg-emerald-300" />
                YOUR NEXT CHAPTER
              </span>

              <h1 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                Every new opportunity begins with a step.
              </h1>

              <p className="mt-4 text-sm leading-7 text-emerald-100">
                Sign in to explore opportunities, keep your applications
                organized, and move closer to your career goals.
              </p>
            </div>

            <p className="text-xs text-emerald-200">
              Helping you find opportunities and manage your career journey.
            </p>
          </div>

          <div className="p-7 sm:p-10 lg:p-12">
            <Link
              href="/"
              className="text-sm font-semibold text-emerald-800 hover:text-emerald-950"
            >
              ← Back to home
            </Link>

            <div className="mt-8">
              <p className="text-xs font-bold tracking-widest text-emerald-700">
                WELCOME BACK
              </p>

              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
                Sign in to CareerPath
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Enter your account details to continue your journey.
              </p>
            </div>

            <Suspense fallback={null}><RegistrationSuccess /></Suspense>
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Email address
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Password
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={72}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50"
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-emerald-700 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in to your account"}{" "}
                {!loading && <span aria-hidden="true">→</span>}
              </button>
            </form>

            <div className="my-7 border-t border-slate-200" />

            <p className="text-center text-sm text-slate-600">
              New to CareerPath?{" "}
              <Link
                href="/register"
                className="font-bold text-emerald-700 hover:text-emerald-900"
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
