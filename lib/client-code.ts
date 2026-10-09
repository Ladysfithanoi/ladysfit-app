import { prisma } from "@/lib/prisma";

const PREFIX = "LDF";

// Mã khách tiếp theo = số LDF lớn nhất + 1 (+ offset khi thử lại vì trùng).
// So theo giá trị số, chỉ xét mã LDF: sắp xếp chuỗi sẽ để "TEST-KH" (khách giả lập)
// hay "LDF10000" < "LDF9999" lên đầu và sinh ra mã đã tồn tại.
export async function nextClientCode(offset = 0): Promise<string> {
  const rows = await prisma.client.findMany({
    where: { clientCode: { startsWith: PREFIX } },
    select: { clientCode: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = r.clientCode?.match(/^LDF(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${PREFIX}${String(max + 1 + offset).padStart(4, "0")}`;
}
