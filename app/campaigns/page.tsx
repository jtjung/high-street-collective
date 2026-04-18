import { getAuth } from "@/lib/get-auth";
import { redirect } from "next/navigation";
import { CampaignsList } from "@/components/campaigns/CampaignsList";

export default async function CampaignsPage() {
  const { userId } = await getAuth();
  if (!userId) redirect("/sign-in");

  return <CampaignsList />;
}
