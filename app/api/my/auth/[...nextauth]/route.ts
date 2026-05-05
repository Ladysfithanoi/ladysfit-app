import NextAuth from "next-auth";
import { clientAuthOptions } from "@/lib/client-auth";

const handler = NextAuth(clientAuthOptions);
export { handler as GET, handler as POST };
