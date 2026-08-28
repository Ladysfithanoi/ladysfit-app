"use client";

import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuestionMedia } from "./question-media";

const OPTIONS = ["A", "B", "C", "D"] as const;

export type QuestionPreviewData = {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correct: string;
  imageUrl: string;
  videoUrl: string;
};

/**
 * Xem trước câu hỏi ĐÚNG NHƯ PT sẽ thấy khi làm bài — cùng khung thẻ, cùng kiểu
 * ô đáp án, ảnh và video hiển thị thật (bấm phóng to, phát video được ngay).
 *
 * Khác một điểm có chủ đích: đáp án đúng được tô xanh và ghi rõ "Đáp án đúng".
 * Đây là màn hình của người soạn đề, thứ cần kiểm là "câu hỏi trông đã ổn chưa
 * và mình có chọn nhầm đáp án không" — nên phải nhìn thấy đáp án đúng. Trang
 * làm bài của PT lấy dữ liệu từ API riêng, không bao giờ kèm trường `correct`.
 */
export function QuestionPreview({
  data,
  index,
  label = "Xem trước — PT sẽ thấy thế này",
}: {
  data: QuestionPreviewData;
  /** Số thứ tự câu để nhãn "Câu N." giống hệt lúc thi; bỏ trống thì hiện "Câu 1." */
  index?: number;
  /** Dòng tiêu đề nhỏ phía trên khung — đổi khi dùng để soi lại bài thi thử. */
  label?: string;
}) {
  const missing = !data.question.trim();

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
        <Eye className="h-3.5 w-3.5" />
        {label}
      </p>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        {missing ? (
          <p className="py-4 text-center text-xs font-semibold italic text-gray-300">
            Nhập nội dung câu hỏi để xem trước
          </p>
        ) : (
          <>
            <p className="text-sm font-semibold text-gray-800">
              <span className="mr-1.5 font-extrabold text-[#f15b5c]">Câu {index ?? 1}.</span>
              {data.question}
            </p>

            <QuestionMedia imageUrl={data.imageUrl} videoUrl={data.videoUrl} />

            <div className="mt-3 space-y-2">
              {OPTIONS.map((opt) => {
                const value = data[`option${opt}` as keyof QuestionPreviewData] as string;
                const isCorrect = data.correct === opt;
                return (
                  <div
                    key={opt}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium",
                      isCorrect
                        ? "border-2 border-emerald-500 bg-emerald-50 text-gray-800"
                        : "border border-gray-200 bg-gray-50 text-gray-600"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        isCorrect ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-500"
                      )}
                    >
                      {opt}
                    </span>
                    <span className="min-w-0 flex-1">
                      {value || <span className="italic text-gray-300">(chưa nhập)</span>}
                    </span>
                    {isCorrect && (
                      <span className="shrink-0 text-[11px] font-bold text-emerald-600">Đáp án đúng</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
