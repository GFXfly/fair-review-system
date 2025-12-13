-- AlterTable
ALTER TABLE "Regulation" ADD COLUMN "embedding" TEXT;

-- CreateTable
CREATE TABLE "Report" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "publishDate" TEXT,
    "province" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "status" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "details" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Case" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "violationType" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "publishDate" TEXT,
    "province" TEXT,
    "reportId" INTEGER,
    "violationClause" TEXT,
    "documentName" TEXT,
    "documentOrg" TEXT,
    "violationDetail" TEXT,
    "legalScope" TEXT,
    "embedding" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Case_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Case" ("content", "createdAt", "id", "province", "publishDate", "result", "title", "updatedAt", "violationType") SELECT "content", "createdAt", "id", "province", "publishDate", "result", "title", "updatedAt", "violationType" FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
CREATE INDEX "Case_violationType_idx" ON "Case"("violationType");
CREATE INDEX "Case_province_idx" ON "Case"("province");
CREATE INDEX "Case_reportId_idx" ON "Case"("reportId");
CREATE TABLE "new_ReviewRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "riskCount" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "text" TEXT,
    "html" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" INTEGER,
    CONSTRAINT "ReviewRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ReviewRecord" ("createdAt", "fileName", "fileSize", "id", "riskCount", "status", "summary", "updatedAt") SELECT "createdAt", "fileName", "fileSize", "id", "riskCount", "status", "summary", "updatedAt" FROM "ReviewRecord";
DROP TABLE "ReviewRecord";
ALTER TABLE "new_ReviewRecord" RENAME TO "ReviewRecord";
CREATE INDEX "ReviewRecord_userId_status_idx" ON "ReviewRecord"("userId", "status");
CREATE INDEX "ReviewRecord_createdAt_idx" ON "ReviewRecord"("createdAt" DESC);
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_status_createdAt_idx" ON "AuditLog"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Regulation_level_idx" ON "Regulation"("level");

-- CreateIndex
CREATE INDEX "Regulation_category_idx" ON "Regulation"("category");
