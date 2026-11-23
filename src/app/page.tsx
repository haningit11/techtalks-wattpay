import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRoleHomePage } from "@/server/auth/routes";

async function HomeRedirect() {
  await connection();
  const session = await auth();
  if (!session?.user?.role) redirect("/login");
  return redirect(getRoleHomePage(session.user.role));
}

export default function Home() {
  return <Suspense fallback={null}><HomeRedirect /></Suspense>;
}
