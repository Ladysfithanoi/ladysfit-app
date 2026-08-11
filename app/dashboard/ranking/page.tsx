import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { computeBranchRanking, computeRanking, getRankWeights } from "@/lib/ranking";
import { currentPeriod, type RankPeriod, type RankPeriodType } from "@/lib/ranking-config";
import { RankingPage } from "@/components/dashboard/ranking/ranking-page";

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export default async function Page({
  searchParams,
}: {
  searchParams: {
    period?: string;
    year?: string;
    month?: string;
    quarter?: string;
    board?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  if (role === "CEO_FITPARTNER" || role === "COO") redirect("/dashboard");

  const now = currentPeriod();
  const type: RankPeriodType =
    searchParams.period === "month" || searchParams.period === "quarter"
      ? searchParams.period
      : "year";

  const period: RankPeriod = {
    type,
    year: clamp(parseInt(searchParams.year ?? "", 10), 2000, 2100, now.year),
    month: clamp(parseInt(searchParams.month ?? "", 10), 1, 12, now.month),
    quarter: clamp(parseInt(searchParams.quarter ?? "", 10), 1, 4, now.quarter),
  };

  // Bảng đang xem nằm trong URL nên refresh vẫn mở đúng tab. Không có tham số
  // (vào thẳng từ menu) thì để client mở lại bảng đã xem lần trước.
  const initialBoard =
    searchParams.board === "branch" || searchParams.board === "staff" ? searchParams.board : null;

  const weights = await getRankWeights();
  const [rows, branchRows] = await Promise.all([
    computeRanking(period, weights),
    computeBranchRanking(period, weights),
  ]);

  return (
    <RankingPage
      rows={rows}
      branchRows={branchRows}
      period={period}
      myId={session.user.id}
      weights={weights}
      initialBoard={initialBoard}
    />
  );
}
