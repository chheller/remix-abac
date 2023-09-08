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
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { features } from "process";

import { PlayCircleIcon, TrashIcon } from "@heroicons/react/24/solid";
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
import { negate, isEmpty, pick } from "lodash/fp";
import { produce } from "immer";
import { ro } from "@faker-js/faker";
import { match } from "ts-pattern";
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
  console.log(JSON.stringify(stringied, null, 2));
  for (const [roleKey, roleValue] of Object.entries(stringied.role ?? [])) {
    await prisma.userRole.update({
      where: { id: roleKey },
      data: {
        roleAdGroups: {
          deleteMany: { adGroupName: { notIn: roleValue.adGroups } },
          connectOrCreate: roleValue.adGroups
            .filter(negate(isEmpty))
            .map((adGroup) => ({
              create: { adGroupName: adGroup, modifiedBy: "test user" },
              where: {
                adGroupName_roleId: { adGroupName: adGroup, roleId: roleKey },
              },
            })),
        },
        roleJobCodes: {
          deleteMany: { jobCode: { notIn: roleValue.jobCodes } },
          connectOrCreate: roleValue.jobCodes
            .filter(negate(isEmpty))
            .map((jobCode) => ({
              create: {
                jobCode: jobCode,
                modifiedBy: "test user",
              },
              where: { jobCode_roleId: { jobCode: jobCode, roleId: roleKey } },
            })),
        },
        roleFeatures: {
          deleteMany: { featureId: { notIn: roleValue.features } },
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
      include: {
        roleFeatures: true,
      },
    });
  }
  return null;
};

export default () => {
  const { roles, features } = useLoaderData<typeof loader>();
  const featureFetcher = useFetcher();
  const roleFetcher = useFetcher();

  const formRef = useRef<HTMLFormElement | null>(null);

  const navigation = useNavigation();

  const [stateRoles, setStateRoles] = useState(
    roles.map((r) => ({
      id: r.id,
      name: r.name,
      adGroups: r.roleAdGroups.map(pick(["roleId", "adGroupName"])),
      jobCodes: r.roleJobCodes.map(pick(["roldId", "jobCode"])),
      features: r.roleFeatures.map(({ id, roleId, feature }) => ({
        id: feature.id,
        roleId,
        feature: feature.feature,
      })),
    })),
  );
  useEffect(() => {
    if (navigation.state !== "submitting") {
      formRef.current?.reset();
    }
  }, [navigation]);

  const addAttribute = (
    attribute: "features" | "jobCodes" | "adGroups",
    roleId: string,
    attributeValue: string,
  ) => {
    if (!isEmpty(attributeValue)) {
      setStateRoles((prevState) => {
        return produce(prevState, (draft) => {
          const roleIdx = draft.findIndex((r) => r.id === roleId);
          match(attribute)
            .with("features", () => {
              if (
                draft[roleIdx].features.findIndex(
                  ({ feature }) => feature === attributeValue,
                ) === -1
              ) {
                draft[roleIdx].features.push({
                  id: features.find((f) => f.feature === attributeValue)!.id,
                  roleId,
                  feature: attributeValue,
                });
              }
            })
            .with("jobCodes", () => {
              if (
                draft[roleIdx].jobCodes.findIndex(
                  ({ jobCode }) => jobCode === attributeValue,
                ) === -1
              )
                draft[roleIdx].jobCodes.push({
                  roleId,
                  jobCode: attributeValue,
                });
            })
            .with("adGroups", () => {
              if (
                draft[roleIdx].adGroups.findIndex(
                  ({ adGroupName }) => adGroupName === attributeValue,
                ) === -1
              )
                draft[roleIdx].adGroups.push({
                  roleId,
                  adGroupName: attributeValue,
                });
            })
            .exhaustive();
        });
      });
    }
  };

  const removeAttribute = (
    roleId: string,
    attributeValue: string,
    attribute: "jobCodes" | "features" | "adGroups",
  ) => {
    setStateRoles((prevState) => {
      return produce(prevState, (draft) => {
        const roleIdx = draft.findIndex((r) => r.id === roleId);
        draft[roleIdx][attribute].splice(
          draft[roleIdx][attribute].findIndex((a) => {
            if ("feature" in a) {
              return a.feature === attributeValue;
            } else if ("adGroupName" in a) {
              return a.adGroupName === attributeValue;
            } else if ("jobCode" in a) {
              return a.jobCode === attributeValue;
            }
          })!,
          1,
        );
      });
    });
  };

  return (
    <div className="flex flex-1 flex-col content-center items-center">
      <h1 className="text-lg font-bold">ABAC </h1>
      <Form
        method="POST"
        replace
        ref={formRef}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        className="flex flex-col"
      >
        <table>
          <tbody>
            {stateRoles.map((role, idx) => (
              <tr key={role.id}>
                <td>{role.name}</td>
                <td style={{ verticalAlign: "top" }}>
                  <table>
                    <tbody>
                      {role.features.map((feature, featureIdx) => (
                        <tr key={feature.id}>
                          <td className="flex flex-1 justify-between">
                            <input
                              type="hidden"
                              name={`role[${role.id}][features][${featureIdx}]`}
                              value={feature.id}
                            />
                            {feature.feature}
                            <TrashIcon
                              className="h-6 w-6"
                              onClick={() =>
                                removeAttribute(
                                  role.id,
                                  feature.feature,
                                  "features",
                                )
                              }
                            />
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td>
                          <select
                            name={`role[${role.id}][features][${role.features.length}]`}
                            id="addFeature"
                            className="border-2"
                            placeholder="Select Feature"
                            onChange={(e) => {
                              addAttribute("features", role.id, e.target.value);
                            }}
                          >
                            <option label="Select a Feature"></option>
                            {features
                              .filter((feature) => {
                                const contained =
                                  role.features.findIndex(
                                    (f) => f.id === feature.id,
                                  ) === -1;
                                return contained;
                              })
                              .map((feature) => (
                                <option
                                  value={feature.feature}
                                  key={feature.id}
                                >
                                  {feature.feature}
                                </option>
                              ))}
                          </select>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
                <td style={{ verticalAlign: "top" }}>
                  <table>
                    <tbody>
                      {role.jobCodes.map((jobCode, jobCodeIdx) => (
                        <tr key={jobCode.jobCode}>
                          <td className="flex flex-1 justify-between">
                            <input
                              type="hidden"
                              name={`role[${role.id}][jobCodes][${jobCodeIdx}]`}
                              value={jobCode.jobCode}
                            />
                            <p className="px-2">{jobCode.jobCode}</p>
                            <TrashIcon
                              className="h-6 w-6"
                              onClick={() =>
                                removeAttribute(
                                  role.id,
                                  jobCode.jobCode!,
                                  "jobCodes",
                                )
                              }
                            />
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td>
                          <input
                            className="border-2"
                            type="text"
                            name={`role[${role.id}][jobCodes][${role.jobCodes.length}]`}
                            placeholder="Job Code"
                            onKeyUp={(e) => {
                              if (e.key === "Enter") {
                                addAttribute(
                                  "jobCodes",
                                  role.id,
                                  e.currentTarget.value,
                                );
                              }
                            }}
                          ></input>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
                <td style={{ verticalAlign: "top" }}>
                  <table>
                    <tbody>
                      {role.adGroups.map((adGroup, adGroupIdx) => (
                        <tr key={adGroup.adGroupName}>
                          <td className="flex flex-1 justify-between">
                            <input
                              type="hidden"
                              name={`role[${role.id}][adGroups][${adGroupIdx}]`}
                              value={adGroup.adGroupName}
                            />
                            <p>{adGroup.adGroupName}</p>
                            <TrashIcon
                              className="h-6 w-6"
                              onClick={() =>
                                removeAttribute(
                                  role.id,
                                  adGroup.adGroupName!,
                                  "adGroups",
                                )
                              }
                            />
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td>
                          <input
                            className="border-2"
                            type="text"
                            name={`role[${role.id}][adGroups][${role.adGroups.length}]`}
                            placeholder="AD Group Name"
                            onKeyUp={(e) => {
                              if (e.key === "Enter") {
                                addAttribute(
                                  "adGroups",
                                  role.id,
                                  e.currentTarget.value,
                                );
                              }
                            }}
                          ></input>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button type="submit" className="btn btn-blue m-4 justify-self-center">
          Save Changes
        </button>
      </Form>
      <div className="flex flex-1 justify-between p-4">
        <roleFetcher.Form
          name="addRole"
          id="addRole"
          method="POST"
          action="/role"
        >
          <input
            name="role"
            type="text"
            placeholder="New role name..."
            className="border-2 mx-4"
          ></input>
          <button type="submit" className="btn btn-blue mx-4">
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
            placeholder="New feature name..."
            className="border-2 mx-4"
          ></input>
          <button type="submit" className="btn btn-blue mx-4">
            Create Feature
          </button>
        </featureFetcher.Form>
      </div>
    </div>
  );
};

export const links = () => [{ rel: "stylesheet", href: styles }];
