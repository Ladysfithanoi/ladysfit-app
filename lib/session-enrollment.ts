// ── Một buổi tập thuộc về LỘ TRÌNH nào ──────────────────────────────────────
//
// Câu hỏi này được hỏi ở hai chỗ và phải trả lời GIỐNG HỆT nhau:
//   • Bảng lương — đơn giá buổi dạy bám theo gói mà buổi đó đã trừ.
//   • Phiếu check-in — mỗi lộ trình in ra đúng những buổi của nó.
// Trước đây mỗi bên tự viết một bản, và hai bản lệch nhau đúng ở chỗ đau nhất:
// cùng một buổi tập, bảng lương tính tiền còn phiếu check-in không thấy.
//
// Mốc đúng nhất là wl."packageEnrollmentId" — gói mà buổi đó đã trừ, ghi lúc
// check-in. Nhưng cột đó KHÔNG phải lúc nào cũng dùng được:
//
//   1. TRỐNG. Buổi ghi từ trước khi có cột này, hoặc buổi mở ra lúc khách không
//      còn gói nào trừ được (countPackageSession trả null).
//
//   2. TRỎ TỚI LỘ TRÌNH ĐÃ BIẾN MẤT. Cột này không có khoá ngoại sang
//      package_enrollments — cố ý, để xoá gói rồi khôi phục từ Thùng rác thì id
//      cũ quay lại và buổi tự gắn về chỗ cũ. Cái giá là trong lúc gói nằm trong
//      thùng rác, buổi tập trỏ vào một id không còn ai. Khi PT xoá gói nhập
//      nhầm rồi tạo gói mới, những buổi đã dạy kẹt lại ở id cũ: phiếu check-in
//      của gói mới không thấy chúng, còn bảng lương thì không tra ra tên gói nên
//      trả theo ĐƠN GIÁ MẶC ĐỊNH thay vì đơn giá thật của gói.
//
// Cả hai trường hợp đều quy về một câu: "không nối được vào lộ trình nào còn
// tồn tại" — tức pe_charged rỗng. Khi đó suy ra gói đang chạy tại ngày tập, hết
// thì lấy gói gần nhất của khách.

/**
 * Hai mối nối để dùng sau `FROM workout_logs wl`.
 *
 * Điều kiện của LATERAL là `pe_charged.id IS NULL` chứ KHÔNG phải
 * `wl."packageEnrollmentId" IS NULL`: viết theo cách sau thì buổi trỏ vào lộ
 * trình đã bị xoá vẫn coi như "đã có gói" và rơi vào khoảng trống — đúng con
 * đường đã làm hỏng phiếu check-in lẫn đơn giá buổi dạy. Nhìn vào kết quả JOIN
 * thì cả hai trường hợp gộp làm một.
 */
export const ENROLLMENT_OF_LOG_JOIN = `
    LEFT JOIN package_enrollments pe_charged
           ON pe_charged.id = wl."packageEnrollmentId"
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
    ) pe_guess ON pe_charged.id IS NULL`;

/** Lộ trình của buổi tập, sau khi đã suy ra. NULL = khách chưa từng có gói nào. */
export const ENROLLMENT_ID = `COALESCE(pe_charged.id, pe_guess.id)`;

/** Tên gói của lộ trình đó — '' khi khách chưa từng có gói nào. */
export const ENROLLMENT_PACKAGE_NAME = `COALESCE(pe_charged."packageName", pe_guess."packageName", '')`;

/** Loại hợp đồng của lộ trình đó. */
export const ENROLLMENT_CONTRACT_TYPE = `COALESCE(pe_charged."contractType"::text, pe_guess."contractType", 'NORMAL')`;

/**
 * Buổi tập ĐƯỢC TÍNH: đã đóng buổi có bằng chứng kèm nhật ký buổi tập.
 *
 * Dùng `wl` làm bí danh. Cùng một định nghĩa cho bảng lương và thanh tiến độ ở
 * hồ sơ khách — xem lib/pt-session-count.ts.
 */
export const TAUGHT_SESSION_WHERE = `
      wl.status = 'COMPLETED'
      AND (
        (wl."checkOutPhotoUrl" IS NOT NULL AND wl."checkOutPhotoUrl" <> '')
        OR (wl."signatureUrl" IS NOT NULL AND wl."signatureUrl" <> '')
      )
      AND EXISTS (SELECT 1 FROM workout_set_logs sl WHERE sl."workoutLogId" = wl.id)`;
