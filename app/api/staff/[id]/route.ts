import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { captureTrash } from "@/lib/trash";
import { firstWorkDayOf, hireDayOf, parseDayInput } from "@/lib/leave-days";
import { normalizeEmail } from "@/lib/normalize-email";
import { revokeTrustedDevices } from "@/lib/login-device";
import { currentWorkBranches, usesWorkBranches, workBranchList } from "@/lib/work-branches";
import { parseGender } from "@/lib/celebrations";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerRole = session.user.role;
  const isFM = callerRole === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  if (callerRole !== "ADMIN" && !isFM) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { clients: true } },
      managedBranches: { select: { branchId: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "Không tìm thấy nhân sự" }, { status: 404 });

  if (user.role === "ADMIN") {
    return NextResponse.json({ error: "Không thể xóa tài khoản Admin" }, { status: 400 });
  }

  // FM cannot delete ADMIN or FM accounts, and can only delete staff in managed branches
  if (isFM) {
    if (user.role === "FM") {
      return NextResponse.json({ error: "FM không thể xóa tài khoản FM khác" }, { status: 403 });
    }
    const works = currentWorkBranches(user);
    if (!works.some((b) => managedBranchIds.includes(b))) {
      return NextResponse.json({ error: "Không có quyền xóa nhân sự này" }, { status: 403 });
    }
    // Người làm nhiều cơ sở (lib/work-branches) còn làm ở cơ sở FM này không
    // quản: chỉ gỡ họ khỏi cơ sở của FM, tài khoản và các cơ sở khác giữ nguyên.
    const remaining = works.filter((b) => !managedBranchIds.includes(b));
    if (user.managedBranches.length > 0 && remaining.length > 0) {
      const home = remaining.includes(user.branchId ?? "") ? user.branchId! : remaining[0];
      await prisma.$transaction([
        prisma.fMBranchAssignment.deleteMany({
          where: { userId: params.id, branchId: { in: managedBranchIds } },
        }),
        prisma.user.update({ where: { id: params.id }, data: { branchId: home } }),
      ]);
      return NextResponse.json({ success: true, removedFromBranches: true });
    }
  }

  if (user._count.clients > 0) {
    return NextResponse.json(
      {
        error: `PT này đang phụ trách ${user._count.clients} khách hàng. Vui lòng chuyển khách hàng sang PT khác trước khi xóa.`,
      },
      { status: 400 }
    );
  }

  // Nhân sự chỉ bị xóa mềm — Thùng rác giữ lại email gốc để khôi phục.
  await captureTrash("STAFF", params.id, session.user);

  try {
    await prisma.user.update({
      where: { id: params.id },
      data: {
        deletedAt: new Date(),
        // Obfuscate email so the address can be reused in future
        email: `deleted_${Date.now()}_${user.email}`,
      },
    });
    // Nghỉ việc → đá khỏi mọi máy đang đăng nhập.
    await revokeTrustedDevices("STAFF", params.id);
  } catch (err) {
    console.error("Delete staff error:", err);
    return NextResponse.json({ error: "Không thể xóa nhân sự. Vui lòng thử lại." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerRole = session.user.role;
  const isFM = callerRole === "FM";
  const managedBranchIds = session.user.managedBranchIds ?? [];

  if (callerRole !== "ADMIN" && !isFM) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, password, branchId, managedBranchIds: newManagedIds, ptLevelId, dateOfBirth, jobPositionId, employmentStartDate, gender } = body;

  // QUYỀN SUY TỪ CHỨC VỤ, không lấy theo giá trị client gửi lên — xem POST
  // /api/staff. Không gửi chức vụ thì giữ nguyên quyền cũ.
  let role: string | undefined;
  let positionMulti: boolean | undefined;
  if (jobPositionId) {
    const position = await prisma.jobPosition.findUnique({
      where: { id: String(jobPositionId) },
      select: { role: true, isActive: true, multiBranch: true },
    });
    if (!position || !position.isActive) {
      return NextResponse.json({ error: "Chức vụ không hợp lệ" }, { status: 400 });
    }
    role = position.role;
    positionMulti = position.multiBranch;
  }

  // Hiện trạng của người được sửa — quyền, chức vụ và các cơ sở đang làm.
  const before = await prisma.user.findUnique({
    where:  { id: params.id },
    select: {
      role: true, branchId: true,
      jobPosition: { select: { multiBranch: true } },
      managedBranches: { select: { branchId: true } },
    },
  });
  if (!before) return NextResponse.json({ error: "Không tìm thấy nhân sự" }, { status: 404 });

  // FM không gán được quyền Admin hoặc FM cho ai
  if (isFM && role && (role === "ADMIN" || role === "FM")) {
    return NextResponse.json({ error: "FM không thể gán quyền Admin hoặc FM" }, { status: 403 });
  }

  // FM can only edit staff in their managed branches
  if (isFM) {
    if (before.role === "FM" || before.role === "ADMIN") {
      return NextResponse.json({ error: "Không có quyền chỉnh sửa tài khoản này" }, { status: 403 });
    }
    // Người làm nhiều cơ sở: FM của BẤT KỲ cơ sở nào họ làm đều sửa được.
    if (!currentWorkBranches(before).some((b) => managedBranchIds.includes(b))) {
      return NextResponse.json({ error: "Không có quyền chỉnh sửa nhân sự này" }, { status: 403 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (name) updateData.name = name;
  if (email) updateData.email = normalizeEmail(email);
  if (password) updateData.password = await bcrypt.hash(password, 12);
  if (ptLevelId !== undefined) updateData.ptLevelId = ptLevelId || null;
  // Đổi chức vụ là đổi luôn quyền — hai thứ đi liền nhau, đúng như ô chọn duy
  // nhất trên giao diện thể hiện.
  if (jobPositionId !== undefined) updateData.jobPositionId = jobPositionId || null;
  if (role) updateData.role = role;
  if (gender !== undefined) updateData.gender = parseGender(gender);
  if (dateOfBirth !== undefined) {
    const d = dateOfBirth ? new Date(dateOfBirth) : null;
    updateData.dateOfBirth = d && !isNaN(d.getTime()) ? d : null;
  }
  // Ngày bắt đầu làm việc — FM/Admin sửa được, vì mốc tự đặt lúc tạo tài khoản
  // hiếm khi trùng ngày người đó thực sự vào làm. Xoá trắng ô thì về null và
  // lịch nghỉ lùi lại mốc tạo tài khoản.
  if (employmentStartDate !== undefined) {
    const nextStart = parseDayInput(employmentStartDate);
    // KHÔNG DỜI NGÀY VÀO LÀM QUA CHỖ ĐÃ ĐI LÀM. Đây là ngày vào CÔNG TY — mọi tháng
    // trước mốc này bị coi là chưa đi làm và mất trắng lương cứng (lib/leave-days
    // unhiredWorkDays), ở MỌI cơ sở. Ca đã xảy ra: chuyển PT Mỹ Đình → Trần Duy
    // Hưng, ô này bị sửa thành ngày 01 của tháng chuyển, bảng lương tháng trước ở
    // Mỹ Đình tụt về 0 công. Chuyển cơ sở thì chỉ đổi ô Cơ sở.
    // Form luôn gửi lại ô này dù không sửa — chỉ kiểm tra khi ngày thật sự đổi,
    // không thì người đang có ngày sai sẵn sẽ không lưu được thay đổi nào khác.
    const current = await prisma.user.findUnique({
      where: { id: params.id }, select: { employmentStartDate: true },
    });
    const currentDay = hireDayOf(current?.employmentStartDate ?? null);
    const changed = (nextStart?.getTime() ?? null) !== (currentDay?.getTime() ?? null);
    if (nextStart && changed) {
      const firstWork = await firstWorkDayOf(params.id);
      if (firstWork && nextStart > firstWork) {
        const shown = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");
        return NextResponse.json({
          error:
            `Nhân sự này đã đi làm từ ${shown(firstWork)} (có buổi dạy / bảng lương / ngày nghỉ từ đó). ` +
            `Ngày bắt đầu làm việc là ngày vào công ty, không được muộn hơn ${shown(firstWork)} — ` +
            `dời ra sau sẽ xoá lương cứng các tháng trước. Chuyển cơ sở thì chỉ cần đổi ô Cơ sở.`,
        }, { status: 400 });
      }
    }
    updateData.employmentStartDate = nextStart;
  }

  // Quyền sau khi lưu — để biết cơ sở gửi lên là của FM, của người làm nhiều
  // cơ sở (Admin, Lao công, Marketing… — lib/work-branches) hay của PT.
  const finalRole = role ?? before.role;
  const finalMulti = usesWorkBranches(finalRole, positionMulti ?? before.jobPosition?.multiBranch);
  let workBranchIds: string[] | null = null;
  if (finalMulti && newManagedIds !== undefined) {
    let list = workBranchList(newManagedIds, branchId);
    // FM chỉ thấy cơ sở mình quản lý trong ô chọn — cơ sở khác người này đang
    // làm phải giữ nguyên, không thì FM lưu một lần là gỡ họ khỏi cơ sở khác.
    if (isFM) {
      const kept = currentWorkBranches(before).filter((b) => !managedBranchIds.includes(b));
      const mine = list.filter((b) => managedBranchIds.includes(b));
      const home = [before.branchId, ...list].find((b) => b && (kept.includes(b) || mine.includes(b))) ?? null;
      list = workBranchList([...kept, ...mine], home);
    }
    if (finalRole === "STAFF" && list.length === 0) {
      return NextResponse.json({ error: "Chọn ít nhất 1 cơ sở làm việc" }, { status: 400 });
    }
    workBranchIds = list;
  }

  if (role === "FM") {
    updateData.role = role;
    updateData.branchId = null;
  } else if (workBranchIds) {
    if (role) updateData.role = role;
    updateData.branchId = workBranchIds[0] ?? null;
  } else {
    if (role) updateData.role = role;
    // Allow explicitly setting or clearing branchId (empty string → null)
    if (branchId !== undefined) updateData.branchId = branchId || null;
  }

  try {
    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
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

    // Handle FM branch assignments update
    // (FM: cơ sở quản lý; người nhiều cơ sở: cơ sở làm việc — lib/work-branches.)
    if (newManagedIds !== undefined && (finalRole === "FM" || workBranchIds)) {
      const ids: string[] = workBranchIds
        ?? (Array.isArray(newManagedIds) ? (newManagedIds as string[]) : []);
      await prisma.fMBranchAssignment.deleteMany({ where: { userId: params.id } });
      if (ids.length > 0) {
        await prisma.fMBranchAssignment.createMany({
          data: ids.map((bid) => ({ userId: params.id, branchId: bid })),
        });
      }
    } else if (role && role !== "FM" && !finalMulti) {
      // Đổi sang chức vụ chỉ làm một cơ sở — bỏ gán cơ sở
      await prisma.fMBranchAssignment.deleteMany({ where: { userId: params.id } });
    }

    // Admin/FM đặt mật khẩu mới → đăng xuất người đó khỏi mọi máy.
    if (password) await revokeTrustedDevices("STAFF", params.id);

    return NextResponse.json(user);
  } catch (error: unknown) {
    const e = error as { message?: string; code?: string };
    console.error("Update staff error:", e.message, e.code);
    return NextResponse.json({ error: e.message ?? "Không thể cập nhật nhân sự.", code: e.code }, { status: 500 });
  }
}
