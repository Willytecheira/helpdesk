import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-40" />
        </div>
        <TableSkeleton rows={8} cols={7} />
      </div>
    </div>
  )
}
