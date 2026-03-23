import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

// V1: Simple JWT auth. Email provider requires nodemailer + SMTP server.
// For initial deployment, use credentials placeholder.
// TODO: Wire up email magic link auth with a proper SMTP provider.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        // V1 placeholder: accept any email, create session
        // Replace with proper email verification in production
        const email = credentials?.email as string | undefined;
        if (!email) return null;
        return { id: email, email, name: email.split("@")[0] };
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
