import { getAuth } from "@/lib/get-auth";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function LeadsPage() {
  const { userId } = await getAuth();
  if (!userId) redirect("/sign-in");

  return <DashboardClient />;
}
