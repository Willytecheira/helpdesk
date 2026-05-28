-- CreateTable
CREATE TABLE "RecurringTicket" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "customerId" TEXT NOT NULL,
    "systemId" TEXT,
    "assignedToId" TEXT,
    "tags" TEXT[],
    "intervalDays" INTEGER NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringTicket_active_nextRunAt_idx" ON "RecurringTicket"("active", "nextRunAt");

-- CreateIndex
CREATE INDEX "RecurringTicket_customerId_idx" ON "RecurringTicket"("customerId");

-- AddForeignKey
ALTER TABLE "RecurringTicket" ADD CONSTRAINT "RecurringTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTicket" ADD CONSTRAINT "RecurringTicket_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTicket" ADD CONSTRAINT "RecurringTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
