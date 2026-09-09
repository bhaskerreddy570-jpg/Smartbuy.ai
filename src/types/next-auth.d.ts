import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    customerSessionId?: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    id: string;
    customerSessionId?: string;
    customerSessionToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    customerSessionId?: string;
    customerSessionTokenHash?: string;
  }
}
