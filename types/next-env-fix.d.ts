// Fix for incorrect Next.js typing of cookies()
declare module 'next/headers' {
  export function cookies(): import('next/dist/server/web/spec-extension/adapters/request-cookies').ReadonlyRequestCookies;
}
