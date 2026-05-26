import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

const isHttps = process.env.NEXTAUTH_URL?.startsWith('https://')

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages:   { signIn: '/login' },

  // Explicitly secure cookies in production (HTTPS only).
  // NextAuth infers this from NEXTAUTH_URL automatically, but being explicit
  // prevents accidental insecure cookies on staging environments.
  useSecureCookies: isHttps,
  cookies: isHttps ? {
    sessionToken: {
      name:    '__Secure-next-auth.session-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true },
    },
    callbackUrl: {
      name:    '__Secure-next-auth.callback-url',
      options: { httpOnly: false, sameSite: 'lax', path: '/', secure: true },
    },
    csrfToken: {
      name:    '__Host-next-auth.csrf-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true },
    },
  } : undefined,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user) return null

        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

        // Record last login (fire-and-forget)
        void prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {})

        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      return token
    },
    session({ session, token }) {
      if (session.user) {
        ;(session.user as { id?: string }).id = token.sub!
      }
      return session
    },
  },
}
