import { getAuth } from "@/lib/get-auth";
import { redirect } from "next/navigation";
import { KanbanBoard } from "@/components/opportunities/KanbanBoard";

export default async function OpportunitiesPage() {
  const { userId } = await getAuth();
  if (!userId) redirect("/sign-in");

  return <KanbanBoard />;
}
