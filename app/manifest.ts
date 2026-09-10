import type { MetadataRoute } from "next";

// Cho phép "Thêm vào màn hình chính": mở như app riêng, không có thanh địa chỉ.
// Next tự phục vụ file này ở /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ladysfit — Quản lý Phòng Gym",
    short_name: "Ladysfit",
    description:
      "Hệ thống quản lý phòng gym Ladysfit: giáo án, dinh dưỡng, cân nặng và lịch tập.",
    // "/" mở ra cửa PT: còn phiên thì vào /dashboard, chưa thì /login
    // (xem app/page.tsx). Hội viên vẫn vào được qua /my/login.
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
}
