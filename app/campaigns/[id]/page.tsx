import { getAuth } from "@/lib/get-auth";
import { redirect } from "next/navigation";
import { CampaignDetail } from "@/components/campaigns/CampaignDetail";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await getAuth();
  if (!userId) redirect("/sign-in");
  const { id } = await params;
  return <CampaignDetail id={id} />;
}
