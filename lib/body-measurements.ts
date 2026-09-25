// Một đường duy nhất cho số đo cơ thể.
// PT đo thông số nào thì khách hàng cũng đo đúng thông số đó, cùng tên gọi,
// cùng thứ tự, cùng màu biểu đồ — mọi giao diện đều đọc từ file này.

// Bộ số đo rút gọn (25/09/2026): Vòng 2 (ngang rốn), Eo, Hông, Bắp tay, Đùi,
// Mông. Các cột cũ (bắp tay từ khuỷu, bắp đùi từ đầu gối, bắp chân…) vẫn nằm
// trong DB để giữ lịch sử đã đo, nhưng không còn nhập và không còn hiện ở đâu.
export type BodyMeasurementKey =
  | "belly"
  | "waist"
  | "hip"
  | "armSize"
  | "thighSize"
  | "glute";

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
  { key: "belly",     label: "Vòng 2 (ngang rốn)", formLabel: "Vòng 2 – ngang rốn (cm)", placeholder: "80", color: "#f97316" },
  { key: "waist",     label: "Eo",                 formLabel: "Eo (cm)",                 placeholder: "70", color: "#f15b5c" },
  { key: "hip",       label: "Hông",               formLabel: "Hông (cm)",               placeholder: "90", color: "#ec4899" },
  { key: "armSize",   label: "Bắp tay",            formLabel: "Bắp tay (cm)",            placeholder: "30", color: "#8b5cf6" },
  { key: "thighSize", label: "Đùi",                formLabel: "Đùi (cm)",                placeholder: "55", color: "#06b6d4" },
  { key: "glute",     label: "Mông",               formLabel: "Mông (cm)",               placeholder: "95", color: "#10b981" },
];

export const MEASUREMENT_KEYS: BodyMeasurementKey[] = MEASUREMENT_FIELDS.map((f) => f.key);

/** Body API → giá trị ghi DB, đúng các cột đang đo. Ô trống/không phải số → null. */
export function parseMeasurementBody(body: Record<string, unknown>): BodyMeasurementValues {
  const out = {} as BodyMeasurementValues;
  for (const key of MEASUREMENT_KEYS) {
    const v = body[key];
    const n = v == null || v === "" ? NaN : parseFloat(String(v));
    out[key] = Number.isFinite(n) ? n : null;
  }
  return out;
}

/** Lấy đúng các cột đang đo từ một dòng DB — cột cũ không lọt ra giao diện. */
export function pickMeasurements(row: Record<BodyMeasurementKey, number | null>): BodyMeasurementValues {
  const out = {} as BodyMeasurementValues;
  for (const key of MEASUREMENT_KEYS) out[key] = row[key] ?? null;
  return out;
}

/** Gom các ô đã nhập (chuỗi) thành payload gửi API — ô trống thành null. */
export function buildMeasurementPayload(vals: Record<string, string>): BodyMeasurementValues {
  const out = {} as BodyMeasurementValues;
  for (const key of MEASUREMENT_KEYS) {
    const v = vals[key];
    out[key] = v ? parseFloat(v) : null;
  }
  return out;
}
