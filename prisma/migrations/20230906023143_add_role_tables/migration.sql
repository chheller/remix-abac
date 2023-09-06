-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "modifiedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RoleFeature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "modifiedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoleFeature_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "UserRole" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoleFeature_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "UserFeature" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserFeature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feature" TEXT NOT NULL,
    "modifiedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RoleJobCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "jobCode" TEXT NOT NULL,
    "modifiedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoleJobCode_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "UserRole" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoleAdGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "adGroupName" TEXT NOT NULL,
    "modifiedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoleAdGroup_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "UserRole" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_name_key" ON "UserRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RoleFeature_roleId_featureId_key" ON "RoleFeature"("roleId", "featureId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFeature_feature_key" ON "UserFeature"("feature");

-- CreateIndex
CREATE UNIQUE INDEX "RoleJobCode_jobCode_roleId_key" ON "RoleJobCode"("jobCode", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleAdGroup_adGroupName_roleId_key" ON "RoleAdGroup"("adGroupName", "roleId");
