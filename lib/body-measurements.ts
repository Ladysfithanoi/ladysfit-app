// Một đường duy nhất cho số đo cơ thể.
// PT đo thông số nào thì khách hàng cũng đo đúng thông số đó, cùng tên gọi,
// cùng thứ tự, cùng màu biểu đồ — mọi giao diện đều đọc từ file này.

export type BodyMeasurementKey =
  | "waist"
  | "belly"
  | "armSize"
  | "armFromElbow"
  | "thighSize"
  | "thighFromKnee"
  | "calfSize"
  | "calfFromKnee";

export type BodyMeasurementValues = Record<BodyMeasurementKey, number | null>;

export type BodyMeasurementLog = BodyMeasurementValues & {
  id:           string;
  measuredDate: string;
  notes:        string | null;
  measuredBy:   { id: string; name: string | null } | null;
};

export type BodyMeasurementField = {
  key:         BodyMeasurementKey;
  /** Nhãn ngắn — dùng cho thẻ tóm tắt, cột bảng, chú thích biểu đồ */
  label:       string;
  /** Nhãn trong form nhập (kèm đơn vị) */
  formLabel:   string;
  placeholder: string;
  /** Màu đường trong biểu đồ */
  color:       string;
};

export const MEASUREMENT_FIELDS: BodyMeasurementField[] = [
  { key: "waist",         label: "Eo",                  formLabel: "Eo (cm)",                  placeholder: "70", color: "#f15b5c" },
  { key: "belly",         label: "Bụng",                formLabel: "Bụng (cm)",                placeholder: "80", color: "#f97316" },
  { key: "armSize",       label: "Bắp tay",             formLabel: "Bắp tay (cm)",             placeholder: "30", color: "#8b5cf6" },
  { key: "armFromElbow",  label: "Bắp tay từ khuỷu",    formLabel: "Bắp tay từ khuỷu (cm)",    placeholder: "25", color: "#a78bfa" },
  { key: "thighSize",     label: "Bắp đùi",             formLabel: "Bắp đùi (cm)",             placeholder: "55", color: "#06b6d4" },
  { key: "thighFromKnee", label: "Bắp đùi từ đầu gối",  formLabel: "Bắp đùi từ đầu gối (cm)",  placeholder: "40", color: "#38bdf8" },
  { key: "calfSize",      label: "Bắp chân",            formLabel: "Bắp chân (cm)",            placeholder: "35", color: "#10b981" },
  { key: "calfFromKnee",  label: "Bắp chân từ đầu gối", formLabel: "Bắp chân từ đầu gối (cm)", placeholder: "30", color: "#34d399" },
];

export const MEASUREMENT_KEYS: BodyMeasurementKey[] = MEASUREMENT_FIELDS.map((f) => f.key);

/** Gom các ô đã nhập (chuỗi) thành payload gửi API — ô trống thành null. */
export function buildMeasurementPayload(vals: Record<string, string>): BodyMeasurementValues {
  const out = {} as BodyMeasurementValues;
  for (const key of MEASUREMENT_KEYS) {
    const v = vals[key];
    out[key] = v ? parseFloat(v) : null;
  }
  return out;
}
