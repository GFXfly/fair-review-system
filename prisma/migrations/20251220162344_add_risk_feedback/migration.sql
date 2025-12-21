/*
  Warnings:

  - You are about to drop the column `html` on the `ReviewRecord` table. All the data in the column will be lost.
  - You are about to drop the column `text` on the `ReviewRecord` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ReviewRisk" ADD COLUMN "law" TEXT;
ALTER TABLE "ReviewRisk" ADD COLUMN "relatedCase" TEXT;

-- CreateTable
CREATE TABLE "RiskFeedback" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reviewId" TEXT NOT NULL,
    "riskId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "isAccurate" BOOLEAN NOT NULL,
    "adminStatus" TEXT NOT NULL DEFAULT 'pending',
    "adminUserId" INTEGER,
    "adminComment" TEXT,
    "adminReviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RiskFeedback_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ReviewRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RiskFeedback_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "ReviewRisk" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RiskFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RiskFeedback_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ReviewRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "riskCount" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" INTEGER,
    CONSTRAINT "ReviewRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ReviewRecord" ("createdAt", "fileName", "fileSize", "id", "riskCount", "status", "summary", "updatedAt", "userId") SELECT "createdAt", "fileName", "fileSize", "id", "riskCount", "status", "summary", "updatedAt", "userId" FROM "ReviewRecord";
DROP TABLE "ReviewRecord";
ALTER TABLE "new_ReviewRecord" RENAME TO "ReviewRecord";
CREATE INDEX "ReviewRecord_userId_status_idx" ON "ReviewRecord"("userId", "status");
CREATE INDEX "ReviewRecord_createdAt_idx" ON "ReviewRecord"("createdAt" DESC);
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RiskFeedback_adminStatus_isAccurate_idx" ON "RiskFeedback"("adminStatus", "isAccurate");

-- CreateIndex
CREATE INDEX "RiskFeedback_createdAt_idx" ON "RiskFeedback"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "RiskFeedback_reviewId_riskId_idx" ON "RiskFeedback"("reviewId", "riskId");
