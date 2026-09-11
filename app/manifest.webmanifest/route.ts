// Bản khai cho cửa PT (mặc định của cả tên miền).
//
// Viết bằng route chứ không dùng file app/manifest.ts theo quy ước của Next:
// bản sinh theo quy ước luôn được gắn vào <head> của mọi trang và đè cả khai báo
// ở layout con, nên khu hội viên không tài nào khai bản riêng của mình được.
// Khai bằng metadata ở từng layout thì layout con mới đè được layout cha.
// Bản của hội viên: app/my/manifest.webmanifest/route.ts
export const dynamic = "force-static";

export function GET() {
  const manifest = {
    id: "/",
    name: "Ladysfit — Quản lý Phòng Gym",
    short_name: "LOTS",
    description:
      "Hệ thống quản lý phòng gym Ladysfit: giáo án, dinh dưỡng, cân nặng và lịch tập.",
    // "/" mở ra cửa PT: còn phiên thì vào /dashboard, chưa thì /login
    // (xem app/page.tsx).
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#f15b5c",
    lang: "vi",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
