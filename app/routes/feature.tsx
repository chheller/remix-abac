import { ActionArgs } from "@remix-run/node";
import { Form } from "@remix-run/react";
import { prisma } from "~/db.server";

export const action = async ({ request }: ActionArgs) => {
  const formData = await request.formData();
  const formJson = Object.fromEntries(formData);
  console.log({ formData, formJson });
  // TODO: Zod validations
  // TODO: include user session token
  const newFeature = await prisma.userFeature.create({
    data: { feature: formJson.newFeature as string, modifiedBy: "test" },
  });
  console.log({ newFeature });
  return newFeature;
};
