import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { faker } from '@faker-js/faker'
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
          hash: await bcrypt.hash(`a test password`, 10)
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
          hash: await bcrypt.hash(`a test password`, 10)
        }
      }
    }
  ] as const



  await prisma.userRole.deleteMany({});
  await prisma.userJobCode.deleteMany({});
  await prisma.userAdGroup.deleteMany({})
  await prisma.user.deleteMany({})

  const seededUsers = [];
  for (const user of testUsers) {
    const seededUser = await prisma.user.create({ data: user, include: { adGroups: true, jobCodes: true } });
    seededUsers.push(seededUser)
  }

  const adminRole = await prisma.userRole.create({ data: { name: "Administrator", modifiedBy: faker.helpers.arrayElement(seededUsers).id, roleFeatures: { create: { feature: { create: { feature: 'Manage Users', modifiedBy: faker.helpers.arrayElement(seededUsers).id } }, modifiedBy: faker.helpers.arrayElement(seededUsers).id } }, } })
  await prisma.roleAdGroup.create({ data: { adGroupName: "Admin", roleId: adminRole.id, modifiedBy: faker.helpers.arrayElement(seededUsers).id } })
  await prisma.roleJobCode.create({ data: { jobCode: '888-888-8888', roleId: adminRole.id, modifiedBy: faker.helpers.arrayElement(seededUsers).id } })
  const basicRole = await prisma.userRole.create({ data: { name: "Basic", modifiedBy: faker.helpers.arrayElement(seededUsers).id, roleFeatures: { create: { feature: { create: { feature: 'Make Post', modifiedBy: faker.helpers.arrayElement(seededUsers).id } }, modifiedBy: faker.helpers.arrayElement(seededUsers).id } }, } })
  await prisma.roleAdGroup.create({ data: { adGroupName: "Basic", roleId: basicRole.id, modifiedBy: faker.helpers.arrayElement(seededUsers).id } })
  await prisma.roleJobCode.create({ data: { jobCode: '555-555-555', roleId: basicRole.id, modifiedBy: faker.helpers.arrayElement(seededUsers).id } })
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
