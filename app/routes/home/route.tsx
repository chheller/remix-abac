import {
  Form,
  useFetcher,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "@remix-run/react";
import { prisma } from "~/db.server";
import styles from "./styles.css";
import { getUser, requireUser } from "~/session.server";
import { ActionArgs, LoaderArgs, redirect } from "@remix-run/node";
import qs from "qs";
import { useEffect, useRef } from "react";
import { features } from "process";
export const loader = async ({ request }: LoaderArgs) => {
  const user = await requireUser(request);

  const roles = await prisma.userRole.findMany({
    include: {
      roleAdGroups: true,
      roleFeatures: { include: { feature: true } },
      roleJobCodes: true,
    },
  });
  const features = await prisma.userFeature.findMany({});
  return { roles, features, user };
};
import { negate, isEmpty } from "lodash/fp";
export const action = async ({ request }: ActionArgs) => {
  const text = await request.text();

  const stringied = qs.parse(text) as {
    role: Record<
      string,
      {
        features: Array<string>;
        jobCodes: Array<string>;
        adGroups: Array<string>;
      }
    >;
  };

  for (const [roleKey, roleValue] of Object.entries(stringied.role ?? [])) {
    const adGroupMutations = roleValue.adGroups
      .filter(negate(isEmpty))
      .map((adGroup) =>
        prisma.roleAdGroup.upsert({
          create: { adGroupName: adGroup, roleId: roleKey, modifiedBy: "test" },
          where: {
            adGroupName_roleId: { adGroupName: adGroup, roleId: roleKey },
          },
          update: {},
        }),
      );
    const jobCodeMutations = roleValue.jobCodes
      .filter(negate(isEmpty))
      .map((jobCode) =>
        prisma.roleJobCode.upsert({
          create: { jobCode: jobCode, roleId: roleKey, modifiedBy: "" },
          where: { jobCode_roleId: { jobCode: jobCode, roleId: roleKey } },
          update: {},
        }),
      );
    console.log(roleValue.features);
    const userRoleFeaturesMutation = prisma.userRole.update({
      where: { id: roleKey },
      data: {
        roleFeatures: {
          connectOrCreate: roleValue.features
            .filter(negate(isEmpty))
            .map((feature) => ({
              create: {
                modifiedBy: "test",
                feature: { connect: { id: feature } },
              },

              where: {
                roleId_featureId: { featureId: feature, roleId: roleKey },
              },
            })),
        },
      },
    });

    const results = await Promise.allSettled([
      ...adGroupMutations,
      ...jobCodeMutations,
      userRoleFeaturesMutation,
    ]);
    results.forEach(console.log);
  }
  return null;
};

export default () => {
  const { roles, features } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const featureFetcher = useFetcher();
  const roleFetcher = useFetcher();

  const formRef = useRef<HTMLFormElement | null>(null);

  const navigation = useNavigation();

  useEffect(() => {
    if (navigation.state !== "submitting") {
      formRef.current?.reset();
    }
  }, [navigation]);

  return (
    <div className="flex flex-1 flex-col content-center items-center">
      <h1 className="text-lg font-bold">ABAC </h1>
      <Form method="POST" replace ref={formRef}>
        <table>
          {roles.map((role, idx) => (
            <tr key={role.id}>
              <td>{role.name}</td>
              <td>
                <table>
                  {role.roleFeatures.map((feature, featureIdx) => (
                    <tr key={feature.id}>
                      <td>
                        <input
                          type="hidden"
                          name={`role[${role.id}][features][${featureIdx}]`}
                          value={feature.featureId}
                        />
                        {feature.feature.feature}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <select
                        name={`role[${role.id}][features][${role.roleFeatures.length}]`}
                        id="addFeature"
                        className=""
                        onChange={(e) =>
                          submit(e.currentTarget.form as HTMLFormElement)
                        }
                      >
                        <option label=" "></option>
                        {features
                          .filter(
                            (feature) =>
                              !role.roleFeatures
                                .map((f) => f.featureId)
                                .includes(feature.id),
                          )
                          .map((feature) => (
                            <option value={feature.id} key={feature.id}>
                              {feature.feature}
                            </option>
                          ))}
                      </select>
                    </td>
                  </tr>
                </table>
              </td>
              <td>
                <table>
                  {role.roleJobCodes.map((jobCode, jobCodeIdx) => (
                    <tr key={jobCode.id}>
                      <td>
                        <input
                          type="hidden"
                          name={`role[${role.id}][jobCodes][${jobCodeIdx}]`}
                          value={jobCode.jobCode}
                        />
                        {jobCode.jobCode}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <input
                        name={`role[${role.id}][jobCodes][${role.roleJobCodes.length}]`}
                      ></input>
                      <button type="submit" className="btn btn-blue">
                        Add Job Code...
                      </button>
                    </td>
                  </tr>
                </table>
              </td>
              <td>
                <table>
                  {role.roleAdGroups.map((adGroup, adGroupIdx) => (
                    <tr key={adGroup.id}>
                      <td>
                        <input
                          type="hidden"
                          name={`role[${role.id}][adGroups][${adGroupIdx}]`}
                          value={adGroup.adGroupName}
                        />
                        {adGroup.adGroupName}
                      </td>
                    </tr>
                  ))}
                  <tr className="flex flex-1 content-center">
                    <td>
                      <input
                        type="text"
                        name={`role[${role.id}][adGroups][${role.roleAdGroups.length}]`}
                      ></input>
                      <button className="btn btn-blue">Add AD Group</button>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          ))}
        </table>
      </Form>
      <roleFetcher.Form
        name="addRole"
        id="addRole"
        method="POST"
        action="/role"
      >
        <input name="role" type="text" placeholder="new role name..."></input>
        <button type="submit" className="btn btn-blue">
          Create Role
        </button>
      </roleFetcher.Form>
      <featureFetcher.Form
        name="addFeature"
        id="addFeatureForm"
        method="POST"
        action="/feature"
      >
        <input
          name="newFeature"
          type="text"
          placeholder="new feature name..."
        ></input>
        <button type="submit" className="btn btn-blue">
          Create Feature
        </button>
      </featureFetcher.Form>
    </div>
  );
};

export const links = () => [{ rel: "stylesheet", href: styles }];
