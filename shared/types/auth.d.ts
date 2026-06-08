// Shape of the user object stored in the sealed session cookie (nuxt-auth-utils).
declare module '#auth-utils' {
  interface User {
    id: string
    name: string
    email: string
    status: 'guest' | 'member' | 'officer' | 'admin'
    locale: string
  }
}

export {}
