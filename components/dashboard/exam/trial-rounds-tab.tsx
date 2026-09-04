"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Swords, ChevronDown, ChevronUp, Save, Check, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SORT_ZONES, SORT_ZONE_LABEL, SINS, SIN_LABEL, SIN_DOMAIN, ROUND_TYPE_LABEL,
  type SortZone, type Sin,
  SIN_SEPHIRAH, SEPHIROT,
} from "@/lib/exam-trial";
import { KabbalahTree, KabbalahLegend, type SephirahStatus } from "./kabbalah-tree";

/**
 * Soạn đề thử thách nhiều vòng — chỉ hiện với cấp đã đặt dạng đề TRIAL.
 *
 * Mỗi vòng lưu bằng một nút riêng và gửi lên TRỌN BỘ nội dung của vòng đó; máy
 * chủ xoá cũ ghi mới (xem app/api/exam/rounds/[id]). Bài đã thi không bị ảnh
 * hưởng vì điểm từng vòng đã chép lại lúc chấm.
 */

type MealBrief = {
  id?: string;
  clientProfile: string;
  targetCalories: number | null;
  targetProtein: number | null;
  targetFat: number | null;
  targetCarbs: number | null;
  tolerancePercent: number;
  bannedFoods: string[];
  explanation: string | null;
};

type SortCard = {
  id?: string;
  text: string;
  correctZone: SortZone;
  explanation: string | null;
};

type Round = {
  id: string;
  /** Lối chơi — cơ chế, không phải tên tội. */
  type: "MEAL" | "SORT";
  /** Đại tội của vòng, tách hẳn khỏi lối chơi và khỏi tên hiển thị. */
  sin: Sin | null;
  name: string;
  intro: string | null;
  order: number;
  maxPoints: number;
  passPercent: number;
  failPenalty: number;
  isActive: boolean;
  mealBriefs: MealBrief[];
  sortCards: SortCard[];
};

type LevelOption = { id: string; name: string; color: string; format: "FLAT" | "TRIAL" };

const inputCls =
  "w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30";
/** Ô văn bản dài (luật chơi, hồ sơ khách): giãn dòng cho dễ đọc, cho kéo cao. */
const proseCls =
  "w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm leading-relaxed bg-white focus:outline-none focus:ring-2 focus:ring-[#f15b5c]/30 resize-y";

/**
 * Hàng nút trên màn hẹp: TRƯỢT NGANG thay vì xuống dòng.
 * Xuống dòng làm nhãn vỡ đôi giữa chữ và hàng so le, rất khó đọc trên điện thoại.
 */
const SLIDER =
  "w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full";

const emptyBrief: MealBrief = {
  clientProfile: "",
  targetCalories: null,
  targetProtein: null,
  targetFat: null,
  targetCarbs: null,
  tolerancePercent: 10,
  bannedFoods: [],
  explanation: null,
};

const emptyCard: SortCard = { text: "", correctZone: "CAUTION", explanation: null };

/**
 * Chuẩn hoá dữ liệu vòng nhận từ máy chủ.
 *
 * bannedFoods phải LUÔN là mảng ở phía này. Đã có lần máy chủ trả nguyên chuỗi
 * JSON, ô nhập gọi .join() lên một chuỗi và ném lỗi ngay lúc dựng khung, sập cả
 * trang soạn đề. Máy chủ đã sửa; đây là lớp chặn thứ hai — một ô nhập không
 * đáng để đánh sập cả trang.
 */
function normalizeRounds(raw: unknown): Round[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const r = item as Round;
    return {
      ...r,
      mealBriefs: (Array.isArray(r.mealBriefs) ? r.mealBriefs : []).map((b) => ({
        ...b,
        bannedFoods: Array.isArray(b.bannedFoods)
          ? b.bannedFoods
          : typeof b.bannedFoods === "string"
            ? safeParseList(b.bannedFoods)
            : [],
      })),
      sortCards: Array.isArray(r.sortCards) ? r.sortCards : [],
    };
  });
}

/** "3 hồ sơ" / "13 thẻ" — nói rõ vừa lưu được cái gì, không chỉ nói "đã lưu". */
function countOf(r: Round): string {
  return r.type === "MEAL" ? `${r.mealBriefs.length} hồ sơ` : `${r.sortCards.length} thẻ`;
}

function safeParseList(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// ── Bản đồ cây của đề đang soạn ──────────────────────────────────────────────

/**
 * Đề này phủ được bao nhiêu của cây, và ô nào còn trống.
 *
 * Không phải trang trí: người soạn đề cần nhìn thấy mình đang đo những mảng
 * năng lực nào và bỏ trống mảng nào, vì bảy đại tội cố ý trải đều ba trụ —
 * một đề chỉ toàn tội ở trụ trái sẽ đo mỗi mặt nghiêm khắc của con người.
 */
function TreeMap({ rounds }: { rounds: Round[] }) {
  const covered = rounds.filter((r) => r.sin);
  const lit = covered.filter((r) => r.isActive).map((r) => SIN_SEPHIRAH[r.sin as Sin]);

  const status: Record<number, SephirahStatus> = {};
  for (const s of SEPHIROT) {
    if (!s.sin) {
      status[s.id] = { text: "Ngoài phạm vi bài thi — xét khi thăng cấp", tone: "off" };
      continue;
    }
    const round = covered.find((r) => r.sin === s.sin);
    if (!round) {
      status[s.id] = { text: "Chưa có vòng trong đề", tone: "off" };
    } else if (!round.isActive) {
      status[s.id] = { text: `${round.name} · ${countOf(round)} · đang tắt`, tone: "warn" };
    } else {
      status[s.id] = {
        text: `${round.name} · ${countOf(round)} · đạt ${round.passPercent}% · phạt ${round.failPenalty}`,
        tone: "ok",
      };
    }
  }

  const activeSins = new Set(lit);
  const byPillar = SEPHIROT.filter((s) => s.sin).reduce<Record<string, number>>((acc, s) => {
    if (activeSins.has(s.id)) acc[s.pillar] = (acc[s.pillar] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-base font-extrabold text-gray-900">Bản đồ cây Kabbalah</p>
      <p className="mt-0.5 text-xs text-gray-400">
        Bảy ô dưới Vực Thẳm là bảy đại tội của bài thi. Ba ô trên là ba điều kiện thăng cấp
        còn lại — bài thi không tự mở được chúng.
      </p>

      <div className="mt-4 grid gap-5 lg:grid-cols-[290px_1fr]">
        <div>
          <KabbalahTree lit={lit} detail />
          <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2.5">
            <p className="text-xs font-extrabold text-gray-700">
              Đề đang phủ {lit.length}/7 đại tội
            </p>
            <p className="mt-1 text-[11px] font-semibold leading-snug text-gray-500">
              Trụ Nghiêm khắc {byPillar.SEVERITY ?? 0} · Cân bằng {byPillar.BALANCE ?? 0} ·
              Khoan dung {byPillar.MERCY ?? 0}
            </p>
          </div>
        </div>
        <KabbalahLegend lit={lit} status={status} />
      </div>
    </div>
  );
}

export function TrialRoundsTab({ levels }: { levels: LevelOption[] }) {
  // Hiện MỌI cấp chứ không chỉ cấp đã bật dạng thử thách: phải soạn xong đề
  // rồi mới dám đổi dạng đề, chứ đổi trước thì người ở cấp đó mở đề ra là gặp
  // màn trống.
  const [levelId, setLevelId] = useState<string>(
    levels.find((l) => l.format === "TRIAL")?.id ?? levels[0]?.id ?? ""
  );
  const router = useRouter();
  const selected = levels.find((l) => l.id === levelId) ?? null;
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Báo kết quả lưu GẮN VỚI TỪNG VÒNG. Trước đây chỉ có một dòng ở đầu tab:
  // đang cuộn xuống trong vòng đã mở mà bấm Lưu thì dòng đó nằm ngoài màn hình,
  // nhìn y như bấm xong không có gì xảy ra.
  const [msg, setMsg] = useState<{ roundId: string; text: string; ok: boolean } | null>(null);
  const [newType, setNewType] = useState<"MEAL" | "SORT">("MEAL");
  const [newSin, setNewSin] = useState<Sin>("GLUTTONY");
  // Tên vòng mặc định lấy theo tên tội; sửa tay thì giữ nguyên phần đã sửa.
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    if (!levelId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/exam/rounds?levelId=${levelId}`);
      if (res.ok) setRounds(normalizeRounds(await res.json()));
    } finally {
      setLoading(false);
    }
  }, [levelId]);

  useEffect(() => {
    load();
  }, [load]);

  function patch(id: string, next: Partial<Round>) {
    setRounds((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));
  }

  async function addRound() {
    if (!levelId) return;
    const res = await fetch("/api/exam/rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        levelId,
        type: newType,
        sin: newSin,
        name: (newName.trim() || SIN_LABEL[newSin]),
      }),
    });
    if (res.ok) {
      const created = normalizeRounds([await res.json()])[0];
      setRounds((prev) => [...prev, created]);
      setOpenId(created.id);
      setNewName("");
    }
  }

  async function saveRound(r: Round) {
    setSavingId(r.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/exam/rounds/${r.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: r.name,
          sin: r.sin,
          intro: r.intro,
          maxPoints: r.maxPoints,
          passPercent: r.passPercent,
          failPenalty: r.failPenalty,
          isActive: r.isActive,
          briefs: r.type === "MEAL" ? r.mealBriefs : undefined,
          cards: r.type === "SORT" ? r.sortCards : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMsg({ roundId: r.id, text: err.error ?? "Không lưu được vòng", ok: false });
        return;
      }
      const saved = normalizeRounds([await res.json()])[0];
      setRounds((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      setMsg({ roundId: r.id, text: `Đã lưu ${countOf(saved)}`, ok: true });
      setTimeout(() => setMsg((m) => (m?.roundId === r.id ? null : m)), 4000);
    } finally {
      setSavingId(null);
    }
  }

  // Chỉ vòng đang bật mới ra đề, nên nút Thi thử cũng phải theo đúng con số đó.
  const activeRounds = rounds.filter((r) => r.isActive).length;

  async function removeRound(id: string) {
    const res = await fetch(`/api/exam/rounds/${id}`, { method: "DELETE" });
    if (res.ok) setRounds((prev) => prev.filter((r) => r.id !== id));
  }

  if (levels.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm">
        <Swords className="mx-auto mb-3 h-8 w-8 text-gray-200" />
        <p className="text-sm font-bold text-gray-500">Chưa có cấp độ nào</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-base font-extrabold text-gray-900">Đề thử thách</p>
            <p className="mt-0.5 text-xs text-gray-400">
              Mỗi vòng một lối chơi. Trượt một vòng không đánh rớt cả kỳ nhưng bị trừ thẳng điểm phạt vào tổng.
            </p>
          </div>
          {/* Tự làm thử đề của cấp đang chọn — chấm bằng đúng luật của bài thật
              nhưng không ghi vào đâu, và chấm xong soi lại được đáp án từng phần. */}
          <button
            // Không truyền sẵn tội khai: thi thử đi qua đúng cửa của thí sinh —
            // 7 ô tròn, rồi cây Kabbalah, rồi mới vào đề.
            onClick={() => router.push(`/dashboard/exam/thi-thu?levelId=${levelId}`)}
            disabled={activeRounds === 0}
            title={
              activeRounds === 0
                ? "Cấp này chưa có vòng nào đang dùng để thi thử"
                : "Tự làm thử đề — không lưu kết quả, chấm xong xem được đáp án"
            }
            className="flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-gray-200 px-4 text-sm font-bold text-gray-600 transition-colors hover:border-[#f15b5c] hover:text-[#f15b5c] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-600"
          >
            <FlaskConical className="h-4 w-4 shrink-0" />
            Thi thử đề này
          </button>
        </div>


        <div className={cn(SLIDER, "mt-3")}>
          <div className="flex w-max items-center gap-2">
          {levels.map((l) => (
            <button
              key={l.id}
              onClick={() => setLevelId(l.id)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                levelId === l.id ? "text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              )}
              style={levelId === l.id ? { backgroundColor: l.color } : undefined}
            >
              {l.name}
              {l.format === "TRIAL" && <span className="ml-1.5 opacity-70">· thử thách</span>}
            </button>
          ))}
          </div>
        </div>

        {selected && selected.format !== "TRIAL" && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-700">
            Cấp “{selected.name}” đang dùng đề trắc nghiệm phẳng. Soạn vòng ở đây trước cũng
            được, nhưng phải vào Cài đặt → Cấp độ đổi dạng đề sang “Thử thách nhiều vòng”
            thì người ở cấp này mới thi đề này.
          </p>
        )}
      </div>

      {selected?.format === "TRIAL" || rounds.length > 0 ? <TreeMap rounds={rounds} /> : null}

      {/* Thêm vòng mới */}
      <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        {/* Đại tội và lối chơi là HAI ô riêng — trộn vào một là sinh ra chuyện
            dropdown lối chơi lại hiện tên tội, đổi tên vòng thì nó không đổi. */}
        <select
          value={newSin}
          onChange={(e) => setNewSin(e.target.value as Sin)}
          className={cn(inputCls, "sm:w-52")}
          title="Đại tội — mảng năng lực vòng này đo"
        >
          {SINS.map((sn) => (
            <option key={sn} value={sn}>
              {SIN_LABEL[sn]} — {SIN_DOMAIN[sn]}
            </option>
          ))}
        </select>
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as "MEAL" | "SORT")}
          className={cn(inputCls, "sm:w-52")}
          title="Lối chơi — cách đo"
        >
          <option value="MEAL">{ROUND_TYPE_LABEL.MEAL}</option>
          <option value="SORT">{ROUND_TYPE_LABEL.SORT}</option>
        </select>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`Tên vòng (để trống = "${SIN_LABEL[newSin]}")`}
          className={cn(inputCls, "flex-1")}
        />
        <button
          onClick={addRound}
          className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-40"
          style={{ backgroundColor: "#f15b5c" }}
        >
          <Plus className="h-4 w-4" />
          Thêm vòng
        </button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-300">Đang tải…</p>
      ) : rounds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm font-semibold text-gray-300">Cấp này chưa có vòng nào</p>
        </div>
      ) : (
        rounds.map((r, idx) => (
          <div key={r.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-extrabold text-gray-500">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-gray-900">{r.name}</p>
                {/* Một dòng duy nhất, không xuống dòng — màn hẹp thì trượt ngang */}
                <div className={SLIDER}>
                  <p className="w-max whitespace-nowrap text-[11px] font-semibold text-gray-400">
                    {r.sin ? SIN_LABEL[r.sin] : "Chưa gắn tội"} · {ROUND_TYPE_LABEL[r.type]} · {countOf(r)} · {r.maxPoints} điểm · đạt {r.passPercent}% · trượt −{r.failPenalty}
                    {!r.isActive && " · đang tắt"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpenId(openId === r.id ? null : r.id)}
                className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-50"
                aria-label="Mở/đóng"
              >
                {openId === r.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <button
                onClick={() => removeRound(r.id)}
                className="shrink-0 rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500"
                aria-label="Xoá vòng"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {openId === r.id && (
              <div className="space-y-4 border-t border-gray-100 bg-gray-50/50 px-4 py-4 sm:px-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Tên vòng (hiện cho thí sinh)">
                    <input value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} className={inputCls} />
                  </Field>
                  <Field
                    label="Đại tội"
                    hint={r.sin ? SIN_DOMAIN[r.sin] : "Chưa gắn tội nào cho vòng này"}
                  >
                    <select
                      value={r.sin ?? ""}
                      onChange={(e) => patch(r.id, { sin: (e.target.value || null) as Sin | null })}
                      className={inputCls}
                    >
                      <option value="">— Chưa gắn —</option>
                      {SINS.map((sn) => (
                        <option key={sn} value={sn}>{SIN_LABEL[sn]}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Lối chơi" hint="Cơ chế của vòng — chọn lúc tạo, không đổi được">
                    <input
                      value={ROUND_TYPE_LABEL[r.type]}
                      readOnly
                      className={cn(inputCls, "bg-gray-100 text-gray-400 cursor-not-allowed")}
                    />
                  </Field>
                  <Field label="Trạng thái">
                    <select
                      value={r.isActive ? "1" : "0"}
                      onChange={(e) => patch(r.id, { isActive: e.target.value === "1" })}
                      className={inputCls}
                    >
                      <option value="1">Đang dùng</option>
                      <option value="0">Tắt (không ra đề)</option>
                    </select>
                  </Field>
                </div>

                <Field
                  label="Luật chơi / lời dẫn đầu vòng"
                  hint="Thí sinh đọc đoạn này trước khi vào vòng. Xuống dòng giữ nguyên như bạn gõ; kéo góc dưới bên phải để nới ô."
                >
                  <textarea
                    rows={8}
                    value={r.intro ?? ""}
                    onChange={(e) => patch(r.id, { intro: e.target.value })}
                    className={proseCls}
                    placeholder="Giải thích cho thí sinh vòng này yêu cầu gì…"
                  />
                </Field>

                {/* Màn hẹp xếp dọc: ba ô này nhãn dài, ép vào 1/3 màn là vỡ chữ */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Điểm tối đa">
                    <input
                      type="number" min={1} max={1000}
                      value={r.maxPoints}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => patch(r.id, { maxPoints: parseInt(e.target.value) || 0 })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Đạt vòng từ (%)">
                    <input
                      type="number" min={1} max={100}
                      value={r.passPercent}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => patch(r.id, { passPercent: parseInt(e.target.value) || 0 })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Trượt trừ (điểm)">
                    <input
                      type="number" min={0} max={1000}
                      value={r.failPenalty}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => patch(r.id, { failPenalty: parseInt(e.target.value) || 0 })}
                      className={inputCls}
                    />
                  </Field>
                </div>

                {r.type === "MEAL" ? (
                  <MealBriefEditor
                    briefs={r.mealBriefs}
                    onChange={(mealBriefs) => patch(r.id, { mealBriefs })}
                  />
                ) : (
                  <SortCardEditor
                    cards={r.sortCards}
                    onChange={(sortCards) => patch(r.id, { sortCards })}
                  />
                )}

                {/* Nút lưu và lời báo đi liền nhau — báo ở nơi mắt đang nhìn */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => saveRound(r)}
                    disabled={savingId === r.id}
                    className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-5 text-sm font-bold text-white disabled:opacity-50"
                    style={{ backgroundColor: "#f15b5c" }}
                  >
                    <Save className="h-4 w-4" />
                    {savingId === r.id ? "Đang lưu…" : "Lưu vòng này"}
                  </button>
                  {msg?.roundId === r.id && (
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-sm font-bold",
                        msg.ok ? "text-emerald-600" : "text-red-500"
                      )}
                    >
                      {msg.ok && <Check className="h-4 w-4 shrink-0" />}
                      {msg.text}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block whitespace-nowrap text-[11px] font-bold text-gray-500">{label}</label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-gray-400">{hint}</p>}
    </div>
  );
}

// ── Vòng Phàm ăn ─────────────────────────────────────────────────────────────

function MealBriefEditor({
  briefs,
  onChange,
}: {
  briefs: MealBrief[];
  onChange: (next: MealBrief[]) => void;
}) {
  function patch(i: number, next: Partial<MealBrief>) {
    onChange(briefs.map((b, j) => (j === i ? { ...b, ...next } : b)));
  }
  const num = (v: string) => (v === "" ? null : Math.max(0, parseInt(v) || 0));

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-gray-600">Hồ sơ khách ({briefs.length})</p>
      {briefs.map((b, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-extrabold text-[#f15b5c]">Hồ sơ {i + 1}</p>
            <button
              onClick={() => onChange(briefs.filter((_, j) => j !== i))}
              className="rounded-lg p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"
              aria-label="Xoá hồ sơ"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea
            rows={5}
            value={b.clientProfile}
            onChange={(e) => patch(i, { clientProfile: e.target.value })}
            className={proseCls}
            placeholder="Nữ 32 tuổi, 68kg, cao 158cm, mục tiêu giảm 5kg trong 2 tháng, ăn trưa ở văn phòng…"
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label="Calo">
              <input type="number" min={0} value={b.targetCalories ?? ""} placeholder="—"
                onChange={(e) => patch(i, { targetCalories: num(e.target.value) })} className={inputCls} />
            </Field>
            <Field label="Đạm g">
              <input type="number" min={0} value={b.targetProtein ?? ""} placeholder="—"
                onChange={(e) => patch(i, { targetProtein: num(e.target.value) })} className={inputCls} />
            </Field>
            <Field label="Béo g">
              <input type="number" min={0} value={b.targetFat ?? ""} placeholder="—"
                onChange={(e) => patch(i, { targetFat: num(e.target.value) })} className={inputCls} />
            </Field>
            <Field label="Bột đường g">
              <input type="number" min={0} value={b.targetCarbs ?? ""} placeholder="—"
                onChange={(e) => patch(i, { targetCarbs: num(e.target.value) })} className={inputCls} />
            </Field>
          </div>
          <p className="text-[11px] text-gray-400">
            Chỉ tiêu bỏ trống thì vòng không chấm chỉ tiêu đó.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Sai số cho phép %">
              <input type="number" min={1} max={100} value={b.tolerancePercent}
                onChange={(e) => patch(i, { tolerancePercent: parseInt(e.target.value) || 10 })} className={inputCls} />
            </Field>
            <Field label="Món cấm — cách nhau bằng dấu phẩy">
              <input
                value={b.bannedFoods.join(", ")}
                onChange={(e) =>
                  patch(i, { bannedFoods: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
                }
                className={inputCls}
                placeholder="Tôm biển, Cua bể"
              />
            </Field>
          </div>
          <p className="text-[11px] font-semibold text-amber-600">
            Dùng đúng tên món như trong bảng dinh dưỡng. Chạm phải món cấm là mất trắng hồ sơ này.
          </p>
        </div>
      ))}
      <button
        onClick={() => onChange([...briefs, { ...emptyBrief }])}
        className="flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-xs font-bold text-gray-600 hover:border-[#f15b5c] hover:text-[#f15b5c]"
      >
        <Plus className="h-3.5 w-3.5" />
        Thêm hồ sơ
      </button>
    </div>
  );
}

// ── Vòng Sa ngã ──────────────────────────────────────────────────────────────

function SortCardEditor({
  cards,
  onChange,
}: {
  cards: SortCard[];
  onChange: (next: SortCard[]) => void;
}) {
  function patch(i: number, next: Partial<SortCard>) {
    onChange(cards.map((c, j) => (j === i ? { ...c, ...next } : c)));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-gray-600">Thẻ tình huống ({cards.length})</p>
      {cards.map((c, i) => (
        <div key={i} className="space-y-2.5 rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-extrabold text-[#f15b5c]">Thẻ {i + 1}</p>
            <button
              onClick={() => onChange(cards.filter((_, j) => j !== i))}
              className="rounded-lg p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"
              aria-label="Xoá thẻ"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea
            rows={3}
            value={c.text}
            onChange={(e) => patch(i, { text: e.target.value })}
            className={proseCls}
            placeholder="Khách nhắn tin lúc 11h đêm hỏi chuyện ngoài tập luyện…"
          />
          <div className={SLIDER}>
            <div className="flex w-max gap-2">
              {SORT_ZONES.map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => patch(i, { correctZone: z })}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                    c.correctZone === z ? "bg-[#f15b5c] text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                  )}
                >
                  {SORT_ZONE_LABEL[z]}
                </button>
              ))}
            </div>
          </div>
          <input
            value={c.explanation ?? ""}
            onChange={(e) => patch(i, { explanation: e.target.value })}
            className={inputCls}
            placeholder="Giảng giải (không bắt buộc)"
          />
        </div>
      ))}
      <button
        onClick={() => onChange([...cards, { ...emptyCard }])}
        className="flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-xs font-bold text-gray-600 hover:border-[#f15b5c] hover:text-[#f15b5c]"
      >
        <Plus className="h-3.5 w-3.5" />
        Thêm thẻ
      </button>
    </div>
  );
}
