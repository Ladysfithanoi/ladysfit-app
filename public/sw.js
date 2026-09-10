// Service worker tối giản cho Ladysfit.
//
// Chrome chỉ hiện lời mời "Cài app" khi trang có service worker bắt sự kiện
// fetch. Nhưng app này toàn dữ liệu sống (giáo án, cân nặng, phiên đăng nhập),
// nên KHÔNG cache trang hay API — cache sai một nhịp là hội viên xem nhầm số cũ.
// Ở đây chỉ làm hai việc: cho qua mọi request, và khi mất mạng thì hiện trang
// báo "Không có mạng" thay vì màn hình khủng long của trình duyệt.

const OFFLINE_URL = "/offline.html";
const CACHE = "ladysfit-offline-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Dọn cache của bản cũ để không phình theo thời gian.
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Chỉ đỡ cho việc mở trang. Ảnh, API, file tĩnh cứ để trình duyệt lo.
  if (request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE_URL))
  );
});
