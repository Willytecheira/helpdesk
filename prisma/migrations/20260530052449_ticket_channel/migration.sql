-- CreateEnum
CREATE TYPE "TicketChannel" AS ENUM ('WEB', 'EMAIL', 'WHATSAPP');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "channel" "TicketChannel" NOT NULL DEFAULT 'WEB',
ADD COLUMN     "channelRef" TEXT;
