import { redirect } from "next/navigation";
import { auth } from "../auth";
import { HOME_PAGE, type Role } from "../server/auth/permissions";

export default async function Home() {
  // 1. Ask Auth.js who is logged in
  const session = await auth();
  const user = session?.user;

  // 2. Nobody logged in → login page
  if (!user) {
    redirect("/login");
  }

  // 3. Logged in → their own home page (operator → /admin, reader → /reader, ...)
  redirect(HOME_PAGE[user.role as Role]);
}