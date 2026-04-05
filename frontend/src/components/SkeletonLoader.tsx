export function SkeletonLoader() {
  return (
    <div className="w-full aspect-video rounded-2xl overflow-hidden glass relative">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    </div>
  )
}
