import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import ReaderWorkspace from "@/components/features/readings/ReaderWorkspace";
import { getRoleHomePage } from "@/server/auth/routes";
import { getReaderWorkspaceData } from "@/server/services/reading.service";

async function ReaderWorkspaceLoader() {
  await connection();
  const user = (await auth())?.user;

  if (!user?.role) {
    redirect("/login");
  }

  if (user.role !== "METER_READER") {
    redirect(getRoleHomePage(user.role));
  }

  const initialData = await getReaderWorkspaceData(user);
  const initialBillingMonth = new Date().toISOString().slice(0, 7);

  return (
    <ReaderWorkspace
      initialData={initialData}
      initialBillingMonth={initialBillingMonth}
      readerName={user.fullName}
    />
  );
}

export default function ReaderPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
          Loading meter reader workspace...
        </div>
      }
    >
      <ReaderWorkspaceLoader />
    </Suspense>
  );
}
