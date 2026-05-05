import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-6xl font-extrabold text-[#f15b5c]">404</p>
        <h1 className="mt-4 text-xl font-bold text-gray-900">Không tìm thấy trang</h1>
        <p className="mt-2 text-sm text-gray-400">Trang bạn đang tìm kiếm không tồn tại.</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "#f15b5c" }}
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
