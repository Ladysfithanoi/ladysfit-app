import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ExamTakePage } from "@/components/dashboard/exam/exam-take-page";

export default async function TakeExamPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  if (role !== "RESTRICTED" && role !== "FREE") redirect("/dashboard");

  return <ExamTakePage />;
}
