-- CreateEnum
CREATE TYPE "ParticipationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Participation" ADD COLUMN     "status" "ParticipationStatus" NOT NULL DEFAULT 'PENDING';
