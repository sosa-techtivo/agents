"use server";

import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";

export type LoginState = { error: string } | null;

function safeEqual(a: string, b: string): boolean {
  const bufA = createHash("sha256").update(a).digest();
  const bufB = createHash("sha256").update(b).digest();
  return timingSafeEqual(bufA, bufB);
}

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const adminEmail = process.env.AGENTS_ADMIN_EMAIL;
  const adminPassword = process.env.AGENTS_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error("Authentication is not configured.");
  }

  const credentialsMatch =
    Boolean(email) &&
    Boolean(password) &&
    safeEqual(email.toLowerCase(), adminEmail.toLowerCase()) &&
    safeEqual(password, adminPassword);

  if (!credentialsMatch) {
    return { error: "Invalid email or password." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(adminEmail), sessionCookieOptions);

  redirect("/agents");
}
