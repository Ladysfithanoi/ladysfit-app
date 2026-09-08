import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getActivePromos } from "@/lib/package-promos-server";
import { Step5Sales } from "@/components/consultation/steps/step5-sales";
import type { ConsultationData } from "@/components/consultation/consultation-wizard";

// Trang khách xem lộ trình, mở bằng link tư vấn viên gửi.
//
// Công khai có chủ đích: khách không có tài khoản để đăng nhập. Token là thứ duy
// nhất giữ cửa, nên nó dài 192 bit và chỉ mở đúng MỘT thứ — màn tư vấn lộ trình
// của đúng buổi tư vấn đó. Không có CIF, không có thẩm định, không có chương
// trình tập, không có đường sang dashboard.
//
// Đường dẫn /tu-van/... không nằm trong matcher của middleware.ts nên không bị
// đá về /login. Đổi tên đường dẫn thì nhớ giữ nguyên điều đó.
export const dynamic = "force-dynamic";

// Đừng để link lọt lên Google: ai có link mới được xem, không phải cả internet.
export const metadata: Metadata = {
  title: "Lộ trình tập luyện — Ladysfit",
  robots: { index: false, follow: false },
};

export default async function SharedRoadmapPage({ params }: { params: { token: string } }) {
  const c = await prisma.consultation.findUnique({
    where: { shareToken: params.token },
    include: {
      createdBy: { select: { id: true, name: true, email: true, branchId: true } },
      branch: { select: { id: true, name: true } },
      info: true,
      assessment: true,
      packages: { orderBy: { order: "asc" } },
    },
  });

  if (!c) notFound();

  const activePromos = await getActivePromos(c.branchId);

  // Hai thứ KHÔNG được đi ra ngoài: workoutDesignJson là giáo án nội bộ mà màn
  // lộ trình chẳng dùng tới, còn shareToken thì đã nằm sẵn trên thanh địa chỉ —
  // nhưng đừng nhét thêm nó vào payload gửi xuống trình duyệt. Gỡ ở đây thay vì
  // tin rằng bước 5 sẽ không bao giờ đụng vào chúng.
  const plain = JSON.parse(JSON.stringify(c)) as Record<string, unknown>;
  delete plain.workoutDesignJson;
  delete plain.shareToken;
  const consultation = { ...plain, workoutDesign: null } as ConsultationData;

  const fullName = (c.info?.fullName ?? "").trim();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Image src="/logo.png" alt="Ladysfit" width={40} height={40} className="object-contain" />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-gray-900">
              Lộ trình tập luyện{fullName && ` — ${fullName}`}
            </p>
            <p className="truncate text-xs text-gray-400">
              Ladysfit {c.branch.name}
              {c.createdBy.name && ` · Tư vấn viên ${c.createdBy.name}`}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {/* isGuest khoá mọi đường sửa bên trong bước 5; cũng không truyền
              onDraft/onPrev/onComplete để khách hoàn toàn không có đường ghi. */}
          <Step5Sales
            consultation={consultation}
            isReadOnly
            isGuest
            activePromos={activePromos}
          />
        </div>

        <p className="mt-4 px-1 text-center text-[11px] leading-relaxed text-gray-400">
          Bảng lộ trình này do tư vấn viên Ladysfit lập riêng cho bạn. Giá và thời gian
          có thể thay đổi theo đợt trợ giá — liên hệ tư vấn viên để chốt.
        </p>
      </main>
    </div>
  );
}
