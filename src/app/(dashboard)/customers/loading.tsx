import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-9 w-64" />
        <TableSkeleton rows={6} cols={6} />
      </div>
    </div>
  )
}
