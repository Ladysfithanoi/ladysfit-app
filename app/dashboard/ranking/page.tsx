import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { computeRanking } from "@/lib/ranking";
import { RankingPage } from "@/components/dashboard/ranking/ranking-page";

export default async function Page({
  searchParams,
}: {
  searchParams: { year?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  if (role === "CEO_FITPARTNER" || role === "COO") redirect("/dashboard");

  const currentYear = new Date().getFullYear();
  const parsed = parseInt(searchParams.year ?? "", 10);
  const year = Number.isFinite(parsed) ? parsed : currentYear;

  const rows = await computeRanking(year);

  return <RankingPage rows={rows} year={year} myId={session.user.id} />;
}
