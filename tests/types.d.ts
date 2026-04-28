// Vitest module-cache busting: tests append `?suffix` query strings to module
// specifiers so each dynamic import re-evaluates the target module. TypeScript
// does not understand these query strings, so re-export the underlying modules
// for any `?<suffix>` variant we use in tests.
declare module "@/lib/env?*" {
  export * from "@/lib/env";
}
