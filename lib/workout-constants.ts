export type SessionTypeConfig = {
  types: string[];
  displayLabels?: string[]; // optional display override (same order as types)
};

export const SESSION_TYPES: Record<string, SessionTypeConfig> = {
  "Giai đoạn 1": {
    types: ["Tạ 1", "Tạ 2", "Circuit", "Cardio"],
  },
  "Giai đoạn 2: Skinny Fat": {
    types: ["Full 1", "Full 2", "Mông"],
  },
  "Giai đoạn 2: Giảm béo": {
    types: ["Tạ 1", "Tạ 2", "Circuit", "Cardio"],
  },
  "Giai đoạn 2: Chuyên mông 1": {
    types: ["Lower 1", "Upper 1", "Lower 2", "Glute"],
    // "Upper 1" is stored in DB and used for exercise queries; displayed as "Upper"
    displayLabels: ["Lower 1", "Upper", "Lower 2", "Glute"],
  },
  "Giai đoạn 2: Chuyên mông 2": {
    types: ["Full 1", "Full 2", "Full 3", "Circuit"],
  },
  "Giai đoạn 2: Cân bằng": {
    types: ["Lower 1", "Upper 1", "Lower 2", "Upper 2"],
  },
  "Giai đoạn 3: GD3 Chuyên mông 2": {
    types: ["Full 1", "Full 2", "Full 3"],
  },
  "Giai đoạn 3: Duy trì": {
    types: ["Upper", "Lower", "Full", "Circuit"],
  },
  "Giai đoạn 3: Power Training": {
    types: ["Full 1", "Full 2", "Full 3"],
  },
};
