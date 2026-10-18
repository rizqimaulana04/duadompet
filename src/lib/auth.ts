import { type NextAuthOptions, getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { passwordInput } from './validation';
import { db } from "./db";
import { limit } from "./security";
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Email",
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const p = z
          .object({
            email: z.email().transform((x) => x.toLowerCase()),
            password: passwordInput,
          })
          .safeParse(raw);
        if (!p.success) return null;
        await limit("login:" + p.data.email);
        const user = await db.user.findUnique({
          where: { email: p.data.email },
        });
        const ok = await compare(
          p.data.password,
          user?.password ??
            "$2b$12$C6UzMDM.H6dfI/f/IKcEe.8DunQG4mkSGCCzQXzFYI4P36ODQJJIe",
        );
        return user && ok
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              version: user.sessionVersion,
            }
          : null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.version = (user as unknown as { version: number }).version;
      }
      return token;
    },
    async session({ session, token }) {
      const user = await db.user.findUnique({
        where: { id: String(token.uid) },
      });
      if (!user || user.sessionVersion !== token.version)
        return { ...session, user: undefined };
      return { ...session, user: { ...session.user, id: user.id } };
    },
  },
};
export async function currentUser() {
  const s = await getServerSession(authOptions);
  const id = (s?.user as { id?: string } | undefined)?.id;
  if (!id) throw new Error("Silakan masuk kembali");
  return db.user.findUniqueOrThrow({ where: { id } });
}
