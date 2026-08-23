"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef } from "react";

import { login, signup } from "@/app/actions/auth";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const message = searchParams.get("message");
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Access your 105-Day Learning Journey
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error === "auth_callback_error"
              ? "Authentication link was invalid or already used. Open the email link in the same browser you signed up from, then try again."
              : error}
          </div>
        )}

        {message === "check_email" && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
            Check your email for the confirmation link.
          </div>
        )}

        <form ref={formRef} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-3">
            <button
              formAction={login}
              className="flex-1 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Sign in
            </button>
            <button
              formAction={signup}
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Sign up
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-300">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
