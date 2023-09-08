import { ActionArgs, LoaderArgs, redirect } from "@remix-run/node";
import {
  Form,
  useFetcher,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import qs from "qs";
import { useEffect, useRef, useState } from "react";
import { prisma } from "~/db.server";
import { getUser, requireUser } from "~/session.server";
import styles from "./styles.css";

import { TrashIcon } from "@heroicons/react/24/solid";
import { produce } from "immer";
import { isEmpty, negate, pick } from "lodash/fp";
import { match } from "ts-pattern";

// TODO:
// Server validation errors
// Client Validation errors
// Validate AD Groups (Should be alphabetical only)
// Validate job codes (should be numeric only, except for asterisk in at most 2 of the 3 slots)
// Validate Roles (Should be alphabetical only)
// Implement get endpoint for given user that returns a signed JWT with roles and features (matches wildcard JobCodes)
// UI to delete roles
// UI to delete features

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
export const action = async ({ request, context }: ActionArgs) => {
  const text = await request.text();
  const user = await getUser(request);
  if (!user) {
    return redirect("/login");
  }
  const parsedRoleMappings = qs.parse(text) as {
    role: Record<
      string, // This the role id
      {
        features: Array<string>; // these are feature ids
        jobCodes: Array<string>; // these are job code values e.g. 123-456-789
        adGroups: Array<string>; // these are AD Group values e.g. "Test Group"
      }
    >;
  };
  for (const [roleKey, roleValue] of Object.entries(
    parsedRoleMappings.role ?? [],
  )) {
    await prisma.userRole.update({
      where: { id: roleKey },
      data: {
        roleAdGroups: {
          deleteMany: { adGroupName: { notIn: roleValue.adGroups } },
          connectOrCreate: roleValue.adGroups
            .filter(negate(isEmpty))
            .map((adGroup) => ({
              create: { adGroupName: adGroup, modifiedBy: user.id },
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
                modifiedBy: user.id,
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
                modifiedBy: user.id,
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

export const links = () => [{ rel: "stylesheet", href: styles }];

export default () => {
  const { roles, features } = useLoaderData<typeof loader>();
  const featureFetcher = useFetcher();
  const roleFetcher = useFetcher();

  const formRef = useRef<HTMLFormElement | null>(null);

  const navigation = useNavigation();

  // For a nicer UX, we manage some local state to add or remove features, job codes, or ad groups before submitting the form altogether
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

  // Clear out the form on submit
  // TODO: Use this for a spinner? Typical response time is so fast a spinner doesn't even make sense
  useEffect(() => {
    if (navigation.state !== "submitting") {
      formRef.current?.reset();
    }
  }, [navigation]);

  /**
   *  Add a feature, jobcode, or adgroup to the local form state
   * @param attribute The type of attribute to add
   * @param roleId The id of the Role to add the attribute to
   * @param attributeValue The value of the attribute. Should be the feature id in the case the attribute is 'features'
   */
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
            // Iterate over the possible attribute types, and check if they've already been added
            // If the attribute is already added, no-op
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
  /**
   * Remove a feature, jobcode, or adgroup from the local form state
   * @param attribute The type of attribute to remove
   * @param roleId The role to remove the attribute from
   * @param attributeValue  The value of the attribute being removed. Should be the feature id in the case the attribute is 'features'
   */
  const removeAttribute = (
    attribute: "jobCodes" | "features" | "adGroups",
    roleId: string,
    attributeValue: string,
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
      <h1 className="text-lg font-bold m-6">Role Manager </h1>
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
      <Form
        method="POST"
        replace
        ref={formRef}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        className="flex flex-col"
      >
        <table className="table-fixed">
          <thead>
            <tr>
              <th className="w-1/12">Role</th>
              <th className="w-1/3">Features</th>
              <th className="w-1/3">Job Codes</th>
              <th className="w-1/3">AD Groups</th>
            </tr>
          </thead>
          <tbody>
            {/* Iterate over all the roles and map out the features, jobcodes and ad groups*/}
            {stateRoles.map((role) => (
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
                                  "features",
                                  role.id,
                                  feature.feature,
                                )
                              }
                            />
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td className="flex flex-1 justify-center">
                          {/* For features, those need to already exist in the database. So we use a select here instead of arbitrary text */}
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
                              // Hide any features that are already added to the role
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
                  <table className="table-auto">
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
                                  "jobCodes",
                                  role.id,
                                  jobCode.jobCode!,
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
                                e.currentTarget.value = "";
                              }
                            }}
                          ></input>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
                <td style={{ verticalAlign: "top" }}>
                  <table className="table-auto">
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
                                  "adGroups",
                                  role.id,
                                  adGroup.adGroupName!,
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
                                e.currentTarget.value = "";
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
        <button type="submit" className="btn btn-blue m-4 self-center w-60">
          Save Changes
        </button>
      </Form>
    </div>
  );
};

