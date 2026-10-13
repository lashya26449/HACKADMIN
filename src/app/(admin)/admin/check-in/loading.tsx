export default function CheckInLoading() {
  return (
    <div className="space-y-4 w-full max-w-full pb-16 animate-pulse">
      {/* Sticky Search & Filter Skeleton */}
      <div className="sticky top-0 z-30 bg-[#080808]/95 backdrop-blur-2xl py-3.5 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 border-b border-white/10 space-y-3">
        {/* Full-width search bar skeleton */}
        <div className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/10" />

        {/* Filter tabs skeleton */}
        <div className="flex items-center justify-between gap-3">
          <div className="h-9 w-64 rounded-lg bg-white/[0.04] border border-white/10" />
          <div className="h-4 w-32 rounded bg-white/[0.03]" />
        </div>
      </div>

      {/* Single-column full-width team card skeletons */}
      <div className="w-full flex flex-col space-y-2.5">
        {[1, 2, 3, 4, 5].map(idx => (
          <div
            key={idx}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
          >
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="h-6 w-16 rounded bg-white/[0.06]" />
              <div className="h-5 w-40 rounded bg-white/[0.06]" />
              <div className="h-4 w-28 rounded bg-white/[0.04]" />
              <div className="h-4 w-48 rounded bg-white/[0.04]" />
            </div>
            <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
              <div className="h-7 w-24 rounded bg-white/[0.04]" />
              <div className="h-9 w-28 rounded-lg bg-white/[0.06]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
