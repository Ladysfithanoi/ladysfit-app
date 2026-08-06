import { prisma } from "@/lib/prisma";

/**
 * Đếm "Số buổi PT" — buổi dạy được tính lương cho PT.
 *
 * Một buổi chỉ được tính khi ĐÃ CHECK-OUT có chữ ký của khách kèm nhật ký buổi
 * tập, tức là:
 *   • status = COMPLETED
 *   • signatureUrl (chữ ký check-out) khác rỗng
 *   • có nhật ký buổi tập (workout_set_logs)
 *
 * Chỉ lọc theo status COMPLETED là KHÔNG đủ: WorkoutLog.status mặc định là
 * COMPLETED, nên các log tạo qua luồng cũ (POST /api/clients/[id]/workout-logs,
 * không có chữ ký) cũng lọt vào và làm PHỒNG tiền buổi dạy. Chữ ký check-out là
 * bằng chứng duy nhất cho việc PT đã thực sự dạy xong buổi đó.
 *
 * Buổi được ghi công cho NGƯỜI THỰC SỰ DẠY (wl."createdById" — người ký check-in
 * /check-out), không theo client."assignedPTId", nên buổi dạy hộ ghi công đúng
 * người dạy hộ.
 *
 * ĐƠN GIÁ buổi dạy bám theo GÓI MÀ BUỔI ĐÓ ĐÃ TRỪ (wl."packageEnrollmentId",
 * ghi lúc check-in). Cách cũ lấy gói ACTIVE mới nhất của khách nên sai cả hai
 * chiều: khách đã học xong gói (không còn gói ACTIVE) bị rơi vào nhánh mặc định
 * 100k, còn buổi dạy trên gói L1 cũ mà khách vừa lên gói L3 thì bị trả theo L3.
 * Log cũ chưa có packageEnrollmentId thì suy ra gói đang chạy tại ngày tập.
 */

export type TaughtSessionRow = {
  ptId:         string;
  clientId:     string;
  /** Lộ trình buổi này thuộc về; null nếu khách chưa từng có lộ trình nào. */
  enrollmentId: string | null;
  packageName:  string;
  contractType: "NORMAL" | "KOC" | "KOL";
};

export async function getTaughtSessions(
  ptIds: string[],
  gte:   Date,
  lt:    Date,
): Promise<TaughtSessionRow[]> {
  if (ptIds.length === 0) return [];

  return prisma.$queryRawUnsafe<TaughtSessionRow[]>(
    `
    SELECT
      wl."createdById" AS "ptId",
      wl."clientId"    AS "clientId",
      COALESCE(pe_charged.id, pe_guess.id)                                           AS "enrollmentId",
      COALESCE(pe_charged."packageName", pe_guess."packageName", '')                 AS "packageName",
      COALESCE(pe_charged."contractType"::text, pe_guess."contractType", 'NORMAL')   AS "contractType"
    FROM workout_logs wl
    -- Gói mà buổi này đã trừ (ghi lúc check-in) — nguồn đúng nhất cho đơn giá.
    LEFT JOIN package_enrollments pe_charged
           ON pe_charged.id = wl."packageEnrollmentId"
    -- Log cũ chưa ghi packageEnrollmentId: lấy gói đang chạy tại ngày tập,
    -- không có thì lấy gói gần nhất của khách.
    LEFT JOIN LATERAL (
      SELECT p.id, p."packageName", p."contractType"::text AS "contractType"
      FROM package_enrollments p
      WHERE p."clientId" = wl."clientId"
      ORDER BY
        (p."startDate" IS NOT NULL
         AND p."startDate" <= wl."sessionDate"
         AND (p."endDate" IS NULL OR p."endDate" >= wl."sessionDate")) DESC,
        p."createdAt" DESC
      LIMIT 1
    ) pe_guess ON wl."packageEnrollmentId" IS NULL
    WHERE wl."createdById" = ANY($1::text[])
      AND wl.status = 'COMPLETED'
      AND wl."signatureUrl" IS NOT NULL
      AND wl."signatureUrl" <> ''
      AND wl."sessionDate" >= $2
      AND wl."sessionDate" <  $3
      AND EXISTS (SELECT 1 FROM workout_set_logs sl WHERE sl."workoutLogId" = wl.id)
    `,
    ptIds, gte, lt,
  );
}

/** Số buổi dạy tính lương của một PT trong tháng, gộp theo khách. */
export function countByClient(rows: TaughtSessionRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.clientId, (counts.get(row.clientId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Gộp theo LỘ TRÌNH thay vì theo khách — cần cho bảng chi tiết buổi dạy: một
 * khách có thể có nhiều lộ trình (gói cũ vừa hết + gói mới), gộp theo khách sẽ
 * gán cùng một số buổi cho mọi dòng và cộng trùng "Tổng giá trị".
 */
export function countByEnrollment(rows: TaughtSessionRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.enrollmentId) continue;
    counts.set(row.enrollmentId, (counts.get(row.enrollmentId) ?? 0) + 1);
  }
  return counts;
}
