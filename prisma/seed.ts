import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seed() {
  const testUsers = [
    {
      email: "basicUser@test.com",
      adGroups: {
        create: {
          adGroupName: "Basic"
        }
      },
      jobCodes: {
        create: {
          jobCode: "555-555-5555"
        }
      },
      password: {
        create: {
          hash: await bcrypt.hash(`test_1`, 10)
        }
      }
    },
    {
      email: "admin@test.com",
      adGroups: {
        create: {
          adGroupName: "Admin"
        }
      },
      jobCodes: {
        create: {
          jobCode: "888-888-8888"
        }
      },
      password: {
        create: {
          hash: await bcrypt.hash(`test_1`, 10)
        }
      }
    }
  ] as const

  // cleanup the existing database
  await prisma.user.deleteMany({
    where: {
      email: { in: testUsers.map(({ email }) => email) }
    }
  }).catch(() => {
    // no worries if it doesn't exist yet
  });

  for (const user of testUsers) {
    await prisma.user.create({ data: user })
  }

  console.log(`Database has been seeded. 🌱`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
