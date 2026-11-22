import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { UserRole } from "@/generated/prisma/enums";
import {
  authorizeCredentials,
  SESSION_MAX_AGE_SECONDS,
} from "@/server/auth/credentials";

const VALID_ROLES = new Set<string>(Object.values(UserRole));

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && VALID_ROLES.has(value);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        return authorizeCredentials(credentials);
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        return {
          sub: user.id,
          id: user.id,
          role: user.role,
          fullName: user.fullName,
          iat: token.iat,
          exp: token.exp,
          jti: token.jti,
        };
      }
      return token;
    },
    session({ session, token }) {
      if (
        typeof token.id === "string" &&
        isUserRole(token.role) &&
        typeof token.fullName === "string"
      ) {
        return {
          expires: session.expires,
          user: {
            id: token.id,
            role: token.role,
            fullName: token.fullName,
          },
        };
      }
      return session;
    },
  },
});
