"use client";
import { errorMessage } from "../lib/feedback";



import { useState, type FormEvent } from "react";
import Link from "next/link";
import { requiredTextError } from "../lib/formValidation";
import { useRouter } from "next/navigation";
import GuestGuard from "../components/GuestGuard";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export default function RegisterPage() {
  return (
    <GuestGuard>
      <RegisterForm />
    </GuestGuard>
  );
}

function RegisterForm() {
  const router = useRouter();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "candidate",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(
    field: keyof typeof form,
    value: string
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const missing = requiredTextError([["First name", form.firstName], ["Last name", form.lastName]]);
    if (missing) { setError(missing); return; }

    if (form.password.length < 8 || new TextEncoder().encode(form.password).length > 72) {
      setError("Password must contain at least 8 characters and at most 72 UTF-8 bytes.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: form.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed.");
      }

      // Registration does not automatically log the user in.
      // Continue to the existing login page.
      router.push("/login?registered=true");
    } catch (err) {
      setError(
        errorMessage(err, "Unable to create your account. Please try again.")
      );
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

  return (
    <main className="flex min-h-screen bg-slate-50">
      <section className="flex w-full items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-lg">
          <Link
            href="/"
            className="mb-8 inline-block text-2xl font-extrabold tracking-tight text-emerald-700"
          >
            CareerPath
          </Link>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
                Start your journey
              </p>

              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
                Create your account
              </h1>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Join CareerPath to discover opportunities and manage your
                career journey.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="firstName"
                    className="text-sm font-semibold text-slate-700"
                  >
                    First name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    autoComplete="given-name"
                    required
                    maxLength={50}
                    className={inputClass}
                    placeholder="First name"
                    value={form.firstName}
                    onChange={(event) =>
                      updateField("firstName", event.target.value)
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="lastName"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Last name
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    autoComplete="family-name"
                    required
                    maxLength={50}
                    className={inputClass}
                    placeholder="Last name"
                    value={form.lastName}
                    onChange={(event) =>
                      updateField("lastName", event.target.value)
                    }
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="text-sm font-semibold text-slate-700"
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
                  className={inputClass}
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(event) =>
                    updateField("email", event.target.value)
                  }
                />
              </div>

              <div>
                <label
                  htmlFor="role"
                  className="text-sm font-semibold text-slate-700"
                >
                  I want to join as
                </label>
                <select
                  id="role"
                  name="role"
                  className={inputClass}
                  value={form.role}
                  onChange={(event) =>
                    updateField("role", event.target.value)
                  }
                >
                  <option value="candidate">Job Seeker</option>
                  <option value="recruiter">Recruiter</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="text-sm font-semibold text-slate-700"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className={inputClass}
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={(event) =>
                    updateField("password", event.target.value)
                  }
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-semibold text-slate-700"
                >
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className={inputClass}
                  placeholder="Enter your password again"
                  value={form.confirmPassword}
                  onChange={(event) =>
                    updateField("confirmPassword", event.target.value)
                  }
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(event) => setShowPassword(event.target.checked)}
                  className="size-4 accent-emerald-600"
                />
                Show passwords
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-emerald-700 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-bold text-emerald-700 hover:text-emerald-800"
              >
                Sign in
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            By creating an account, you agree to use CareerPath responsibly.
          </p>
        </div>
      </section>
    </main>
  );
}
