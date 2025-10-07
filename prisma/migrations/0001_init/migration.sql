-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('MAIN', 'WAIT');

-- CreateEnum
CREATE TYPE "ScorePart" AS ENUM ('STRENGTH', 'MAIN');

-- CreateTable
CREATE TABLE "Wod" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scoring" TEXT NOT NULL,
    "timeCap" TEXT,
    "strengthTitle" TEXT,
    "strengthDescription" TEXT,
    "strengthScoreHint" TEXT,
    "strengthRecordScore" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'MAIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "athleteId" TEXT NOT NULL,
    "part" "ScorePart" NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wod_date_key" ON "Wod"("date");

-- CreateIndex
CREATE INDEX "Wod_date_idx" ON "Wod"("date");

-- CreateIndex
CREATE INDEX "Booking_date_time_idx" ON "Booking"("date", "time");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_date_time_athleteId_key" ON "Booking"("date", "time", "athleteId");

-- CreateIndex
CREATE INDEX "Score_date_athleteId_part_idx" ON "Score"("date", "athleteId", "part");

