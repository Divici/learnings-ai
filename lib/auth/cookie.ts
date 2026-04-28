export const AUTH_COOKIE_NAME = "learnings_ai_auth";

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365, // 1 year
};
