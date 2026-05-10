const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";
const API_KEY = process.env.USDA_API_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function searchFoods(query: string, pageSize = 10): Promise<any> {
  const res = await fetch(
    `${USDA_BASE_URL}/foods/search?query=${encodeURIComponent(query)}&pageSize=${pageSize}&api_key=${API_KEY}`
  );
  return res.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getFoodDetail(fdcId: number): Promise<any> {
  const res = await fetch(`${USDA_BASE_URL}/food/${fdcId}?api_key=${API_KEY}`);
  return res.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractNutrients(food: any) {
  const nutrients = food.foodNutrients || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const get = (name: string) =>
    nutrients.find((n: any) => n.nutrientName?.includes(name))?.value || 0;

  return {
    calories: get("Energy"),
    protein:  get("Protein"),
    carbs:    get("Carbohydrate"),
    fat:      get("Total lipid"),
    fiber:    get("Fiber"),
    sodium:   get("Sodium"),
  };
}
