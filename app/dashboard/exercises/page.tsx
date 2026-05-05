import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ExerciseLibrary } from "@/components/dashboard/exercises/exercise-library";

export default async function ExercisesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-gray-800">Danh sách bài tập</h1>
        <p className="text-sm text-gray-400 mt-0.5">Quản lý chuyển động và bài tập theo từng giai đoạn</p>
      </div>
      <ExerciseLibrary />
    </div>
  );
}
