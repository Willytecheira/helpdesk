import { PageHeaderSkeleton, StatCardSkeleton, TableSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <TableSkeleton rows={6} cols={8} />
      </div>
    </div>
  )
}
