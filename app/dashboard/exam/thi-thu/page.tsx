import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ExamTakePage } from "@/components/dashboard/exam/exam-take-page";

// Thi thử — chỉ Admin, để tự kiểm đề mình vừa soạn: câu chữ có rõ không, ảnh
// /video có hiện đúng không, chấm điểm có chuẩn không. Bài không được lưu.
export default async function MockExamPage({
  searchParams,
}: {
  searchParams: { levelId?: string; declaredSin?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  // Mỗi cấp một đề riêng — thi thử phải nói rõ soi đề của cấp nào.
  return (
    <ExamTakePage
      mock
      mockLevelId={searchParams.levelId}
      mockDeclaredSin={searchParams.declaredSin}
    />
  );
}
