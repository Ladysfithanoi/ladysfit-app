import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkCanSitExam } from "@/lib/exam-required-fm";
import { ExamTakePage } from "@/components/dashboard/exam/exam-take-page";

export default async function TakeExamPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // HLV luôn được thi; FM chỉ khi Admin chỉ định bắt buộc; ai bị Admin khoá
  // tay thì không vào được — xem lib/exam-required-fm.ts
  const allowed = await checkCanSitExam(session.user.id, session.user.role);
  if (!allowed.ok) redirect("/dashboard");

  return <ExamTakePage />;
}
