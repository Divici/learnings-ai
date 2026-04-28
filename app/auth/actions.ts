"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS } from "@/lib/auth/cookie";
import { isValidToken } from "@/lib/auth/token";

export async function loginAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "").trim();
  const expected = process.env.LEARNINGS_AI_TOKEN ?? "";
  const from = String(formData.get("from") ?? "/learning");

  if (!isValidToken(token, expected)) {
    const target = `/auth?error=${encodeURIComponent("Invalid token.")}&from=${encodeURIComponent(from)}`;
    redirect(target as Route);
    return;
  }

  const c = await cookies();
  c.set(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);

  redirect(from as Route);
}
