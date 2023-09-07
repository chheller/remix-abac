import { ActionArgs } from "@remix-run/node";
import { prisma } from "~/db.server";

export const action = async ({ request }: ActionArgs) => {
  const formData = await request.formData();
  const formJson = Object.fromEntries(formData);
  console.log({ formData, formJson });
  // TODO: Zod validations
  // TODO: include user session token
  const newRole = await prisma.userRole.create({
    data: { name: formJson.role as string, modifiedBy: "test" },
  });
  console.log({ newRole });
  return newRole;
};
