import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

        // Upsert user to get a stable UUID — required for subscription lookups
        let user = await db.query.users.findFirst({
          where: eq(users.email, email.toLowerCase()),
        });
        if (!user) {
          const [inserted] = await db
            .insert(users)
            .values({ email: email.toLowerCase() })
            .onConflictDoNothing()
            .returning();
          user = inserted ?? await db.query.users.findFirst({
            where: eq(users.email, email.toLowerCase()),
          });
        }
        if (!user) return null;

        return { id: user.id, email: user.email, name: user.email.split("@")[0] };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
