import { getAuth } from "@/lib/get-auth";
import { redirect } from "next/navigation";
import { GoalsClient } from "@/components/goals/GoalsClient";

export default async function GoalsPage() {
  const { userId } = await getAuth();
  if (!userId) redirect("/sign-in");

  return <GoalsClient />;
}
