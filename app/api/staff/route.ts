import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { parseDayInput, todayAsDay } from "@/lib/leave-days";
import { normalizeEmail } from "@/lib/normalize-email";
import { currentWorkBranches, usesWorkBranches, workBranchList } from "@/lib/work-branches";
import { parseGender } from "@/lib/celebrations";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");

  const role = session.user.role;
  const isFM = role === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  let staffWhere: Record<string, unknown> = { deletedAt: null };
  if (isFM) {
    const targetBranchId = (branchId && managedBranchIds.includes(branchId)) ? branchId : null;
    const branchCondition = targetBranchId ?? { in: managedBranchIds };
    staffWhere = {
      deletedAt: null,
      role: { in: ["PT", "FM", "ADMIN"] },
      OR: [
        { branchId: branchCondition },
        // FM, Admin và STAFF làm nhiều cơ sở gắn cơ sở qua FMBranchAssignment.
        { role: { in: ["FM", "ADMIN", "STAFF"] }, managedBranches: { some: { branchId: branchCondition } } },
      ],
    };
  } else if (branchId) {
    staffWhere = {
      deletedAt: null,
      role: { notIn: ["CEO_FITPARTNER", "COO"] },
      OR: [
        { branchId },
        { role: { in: ["FM", "ADMIN", "STAFF"] }, managedBranches: { some: { branchId } } },
        { role: "ADMIN", branchId },
      ],
    };
  }

  const staff = await prisma.user.findMany({
    where: staffWhere,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      branchId: true,
      ptLevelId: true,
      ptLevel: { select: { id: true, name: true, color: true } },
      jobPositionId: true,
      jobPosition: { select: { id: true, name: true, color: true } },
      branch: { select: { id: true, name: true } },
      managedBranches: { include: { branch: { select: { id: true, name: true } } } },
      _count: { select: { clients: true } },
      employmentStartDate: true,
      gender: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(staff);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerRole = session.user.role;
  const isFM = callerRole === "FM";

  if (callerRole !== "ADMIN" && !isFM) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, password, branchId, managedBranchIds, ptLevelId, dateOfBirth, jobPositionId, employmentStartDate, gender } = body;

  const { confirmDuplicateName, mergeIntoId } = body as { confirmDuplicateName?: boolean; mergeIntoId?: string };

  if (!name || !jobPositionId || (!mergeIntoId && (!email || !password))) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }

  // QUYỀN SUY TỪ CHỨC VỤ, không lấy theo giá trị client gửi lên: client sửa gói
  // tin là tự phong quyền cho mình. Chức vụ là danh sách Admin quản, mỗi chức vụ
  // gắn sẵn một quyền trong enum cố định.
  const position = await prisma.jobPosition.findUnique({
    where: { id: String(jobPositionId) },
    select: { id: true, role: true, isActive: true, multiBranch: true },
  });
  if (!position || !position.isActive) {
    return NextResponse.json({ error: "Chức vụ không hợp lệ" }, { status: 400 });
  }
  const role = position.role;

  // FM cannot create ADMIN or FM accounts
  if (isFM && (role === "ADMIN" || role === "FM")) {
    return NextResponse.json({ error: "FM không thể tạo tài khoản Admin hoặc FM" }, { status: 403 });
  }

  // ADMIN can optionally have a branchId (their home branch); CEO/COO/FM have no single branchId
  const noBranchRole = role === "FM" || role === "CEO_FITPARTNER" || role === "COO";
  // Admin, và STAFF có chức vụ làm nhiều cơ sở (Lao công, Marketing…): một
  // người gán nhiều cơ sở — lib/work-branches.
  const multi = usesWorkBranches(role, position.multiBranch);

  // Cơ sở làm việc (người nhiều cơ sở): cơ sở chính đứng đầu danh sách.
  const workBranchIds = multi ? workBranchList(managedBranchIds, branchId) : [];

  if (role === "FM") {
    if (!managedBranchIds || managedBranchIds.length === 0 || managedBranchIds.length > 5) {
      return NextResponse.json({ error: "FM phải có từ 1 đến 5 cơ sở quản lý" }, { status: 400 });
    }
  } else if (multi && role !== "ADMIN" && workBranchIds.length === 0) {
    return NextResponse.json({ error: "Chọn ít nhất 1 cơ sở làm việc" }, { status: 400 });
  } else if (!multi && !noBranchRole && role !== "ADMIN" && !branchId) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }

  // FM chỉ thêm nhân sự vào cơ sở mình quản lý.
  const callerManaged = session.user.managedBranchIds ?? [];
  const chosenBranches = multi ? workBranchIds : (branchId ? [String(branchId)] : []);
  if (isFM && chosenBranches.some((b) => !callerManaged.includes(b))) {
    return NextResponse.json({ error: "FM chỉ thêm nhân sự vào cơ sở mình quản lý" }, { status: 403 });
  }

  const homeBranchId = multi ? (workBranchIds[0] ?? null) : (branchId || null);

  // ── TRÙNG TÊN ────────────────────────────────────────────────────────────
  // Lao công / Marketing làm nhiều cơ sở trước đây bị tạo mỗi cơ sở một tài
  // khoản trùng tên. Nay thấy trùng tên thì báo lại cho người tạo quyết định:
  //   • người cũ có chức vụ làm nhiều cơ sở → hỏi "có phải cùng một người?",
  //     đúng thì gộp (mergeIntoId): chỉ thêm cơ sở mới vào người cũ;
  //   • còn lại → chỉ báo trùng tên, vẫn tạo được nếu là người khác
  //     (confirmDuplicateName).
  const trimmedName = String(name).trim();
  if (mergeIntoId) {
    return mergeIntoExisting({
      targetId: String(mergeIntoId),
      branchIds: chosenBranches,
    });
  }
  if (!confirmDuplicateName) {
    const sameName = await prisma.user.findMany({
      where: { deletedAt: null, name: { equals: trimmedName, mode: "insensitive" } },
      select: {
        id: true, name: true, email: true, role: true, branchId: true,
        jobPosition: { select: { name: true, multiBranch: true } },
        branch: { select: { name: true } },
        managedBranches: { select: { branchId: true, branch: { select: { name: true } } } },
      },
    });
    if (sameName.length > 0) {
      return NextResponse.json({
        code: "DUPLICATE_NAME",
        error: `Đã có nhân sự tên "${trimmedName}".`,
        matches: sameName.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          positionName: u.jobPosition?.name ?? null,
          branchNames: u.managedBranches.length > 0
            ? u.managedBranches.map((m) => m.branch.name)
            : (u.branch ? [u.branch.name] : []),
          // Gộp được khi cả người cũ lẫn chức vụ đang tạo đều làm nhiều cơ sở.
          canMerge: multi && role === "STAFF" && u.role === "STAFF" && !!u.jobPosition?.multiBranch,
        })),
      }, { status: 409 });
    }
  }

  // Hạ chữ thường NGAY tại đây: email là danh tính đăng nhập, và chỗ xác thực
  // cũng hạ y hệt (lib/normalize-email). Lập tài khoản "Hoa@..." rồi không đăng
  // nhập được chính là vì trước đây địa chỉ được cất nguyên chữ hoa.
  const normalizedEmail = normalizeEmail(email);

  // Trùng email kiểu "Hoa@" với "hoa@" vẫn là trùng — dò cả hai lối.
  const existing =
    (await prisma.user.findUnique({ where: { email: normalizedEmail } })) ??
    (await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    }));
  if (existing && !existing.deletedAt) {
    return NextResponse.json({ error: "Email đã tồn tại" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 12);
  const parsedGender = parseGender(gender);

  try {
    const parsedDOB = dateOfBirth ? new Date(dateOfBirth) : undefined;

    // NGÀY BẮT ĐẦU LÀM VIỆC — không khai thì lấy chính hôm nay, vì nhập nhân sự
    // vào app cũng là lúc họ vào làm. Lịch nghỉ khoá mọi ngày trước mốc này.
    const parsedStart = parseDayInput(employmentStartDate) ?? todayAsDay();

    // Use upsert so that a previously soft-deleted account with the same email
    // is reactivated instead of triggering a P2002 unique constraint error.
    const user = await prisma.user.upsert({
      // Khôi phục đúng bản ghi cũ dù nó đang lưu chữ hoa, và ghi đè địa chỉ đã
      // hạ chữ thường để lần sau không còn lệch.
      where: { email: existing?.email ?? normalizedEmail },
      update: {
        name: trimmedName,
        email: normalizedEmail,
        password: hashed,
        branchId: noBranchRole ? null : homeBranchId,
        role,
        deletedAt: null,
        ptLevelId: ptLevelId || null,
        jobPositionId: jobPositionId || null,
        employmentStartDate: parsedStart,
        gender: parsedGender,
        ...(parsedDOB && !isNaN(parsedDOB.getTime()) ? { dateOfBirth: parsedDOB } : {}),
      },
      create: {
        name: trimmedName,
        email: normalizedEmail,
        password: hashed,
        branchId: noBranchRole ? null : homeBranchId,
        role,
        employmentStartDate: parsedStart,
        gender: parsedGender,
        ...(ptLevelId && { ptLevelId }),
        ...(jobPositionId && { jobPositionId }),
        ...(parsedDOB && !isNaN(parsedDOB.getTime()) && { dateOfBirth: parsedDOB }),
      },
      select: {
        id: true, name: true, email: true, role: true, branchId: true,
        ptLevelId: true,
        ptLevel: { select: { id: true, name: true, color: true } },
        jobPositionId: true,
        jobPosition: { select: { id: true, name: true, color: true } },
        branch: { select: { id: true, name: true } },
        managedBranches: { include: { branch: { select: { id: true, name: true } } } },
        _count: { select: { clients: true } },
        employmentStartDate: true,
        gender: true,
      },
    });

    // Sync FM branch assignments — clear stale ones before recreating
    await prisma.fMBranchAssignment.deleteMany({ where: { userId: user.id } });
    const assignIds: string[] = role === "FM" ? (managedBranchIds ?? []) : workBranchIds;
    if (assignIds.length) {
      await prisma.fMBranchAssignment.createMany({
        data: assignIds.map((bid) => ({ userId: user.id, branchId: bid })),
      });
    }

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error("Create staff error:", err);
    return NextResponse.json({ error: "Không thể tạo nhân sự. Vui lòng thử lại." }, { status: 500 });
  }
}

/**
 * "Đúng, là cùng một người" — thêm các cơ sở mới vào nhân sự làm nhiều cơ sở đã
 * có, KHÔNG tạo tài khoản mới. Lương cơ bản ở cơ sở mới cấu hình riêng ở tab
 * Cấu hình lương của cơ sở đó.
 */
async function mergeIntoExisting(args: { targetId: string; branchIds: string[] }) {
  const target = await prisma.user.findFirst({
    where: { id: args.targetId, deletedAt: null },
    select: {
      id: true, role: true, branchId: true,
      jobPosition: { select: { multiBranch: true } },
      managedBranches: { select: { branchId: true } },
    },
  });
  if (!target) return NextResponse.json({ error: "Không tìm thấy nhân sự để gộp" }, { status: 404 });
  if (target.role !== "STAFF" || !target.jobPosition?.multiBranch) {
    return NextResponse.json(
      { error: "Nhân sự này không thuộc chức vụ làm nhiều cơ sở nên không gộp được." },
      { status: 400 },
    );
  }
  if (args.branchIds.length === 0) {
    return NextResponse.json({ error: "Chọn ít nhất 1 cơ sở làm việc" }, { status: 400 });
  }

  const current = currentWorkBranches(target);
  const added = args.branchIds.filter((b) => !current.includes(b));
  const all = workBranchList([...current, ...added], target.branchId);

  await prisma.$transaction([
    prisma.fMBranchAssignment.deleteMany({ where: { userId: target.id } }),
    prisma.fMBranchAssignment.createMany({ data: all.map((b) => ({ userId: target.id, branchId: b })) }),
    prisma.user.update({ where: { id: target.id }, data: { branchId: all[0] } }),
  ]);

  const user = await prisma.user.findUnique({
    where: { id: target.id },
    select: {
      id: true, name: true, email: true, role: true, branchId: true,
      ptLevelId: true,
      ptLevel: { select: { id: true, name: true, color: true } },
      jobPositionId: true,
      jobPosition: { select: { id: true, name: true, color: true } },
      branch: { select: { id: true, name: true } },
      managedBranches: { include: { branch: { select: { id: true, name: true } } } },
      _count: { select: { clients: true } },
      employmentStartDate: true,
      gender: true,
    },
  });
  return NextResponse.json({ ...user, merged: true, addedBranches: added.length }, { status: 200 });
}
