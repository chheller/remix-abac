-- CreateTable
CREATE TABLE "UserAdGroup" (
    "adGroupName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    PRIMARY KEY ("adGroupName", "userId"),
    CONSTRAINT "UserAdGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserJobCode" (
    "jobCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    PRIMARY KEY ("jobCode", "userId"),
    CONSTRAINT "UserJobCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
