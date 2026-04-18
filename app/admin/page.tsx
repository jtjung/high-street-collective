import { redirect } from "next/navigation";
import { getAuth } from "@/lib/get-auth";
import { requireAdmin } from "@/lib/admin";
import { AdminPanel } from "@/components/admin/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { userId } = await getAuth();
  if (!userId) redirect("/sign-in");
  const admin = await requireAdmin();
  if (!admin.ok) {
    // Not an admin — bounce to the main dashboard rather than the
    // sign-in screen (user is signed in, just not privileged).
    redirect("/leads");
  }
  return <AdminPanel adminEmail={admin.email} />;
}
