import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/src/generated/prisma/enums";

export interface WattPaySessionUser {
  id: string;
  role: UserRole;
  fullName: string;
}

declare module "next-auth" {
  interface User {
    id: string;
    role: UserRole;
    fullName: string;
  }

  interface Session extends Omit<DefaultSession, "user"> {
    user: WattPaySessionUser;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    fullName?: string;
  }
}

