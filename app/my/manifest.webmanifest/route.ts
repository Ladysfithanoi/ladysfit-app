// Bản khai riêng cho cổng hội viên.
//
// Cùng một tên miền nhưng hai lớp người dùng đi hai cửa khác nhau, nên phải có
// hai bản khai: cài từ trang hội viên thì icon mở thẳng /my, cài từ chỗ khác
// thì mở cửa PT (xem app/manifest.ts). Khác "id" nên điện thoại coi là hai app
// riêng, PT và hội viên cài trên cùng một máy cũng không đè nhau.
//
// Next chỉ sinh sẵn manifest ở thư mục gốc, nên bản này tự viết bằng route.
// Trang khai dùng nó ở app/my/layout.tsx.
export const dynamic = "force-static";

export function GET() {
  const manifest = {
    id: "/my",
    name: "Ladysfit Objective Training System — Hội viên",
    short_name: "LOTS",
    description:
      "Giáo án, dinh dưỡng và cân nặng của bạn tại Ladysfit.",
    start_url: "/my",
    // Bó trong /my: hội viên bấm nhầm ra ngoài thì mở bằng trình duyệt,
    // không lạc vào khu quản lý ngay trong app.
    scope: "/my",
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
