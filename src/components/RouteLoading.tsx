export function RouteLoading({ label = "页面加载中..." }: { label?: string }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
        <p className="mt-3 text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}
