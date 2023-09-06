import { useLoaderData } from "@remix-run/react";
import { prisma } from "~/db.server";
import styles from "./styles.css";

export const loader = async () => {
  const roles = await prisma.userRole.findMany({
    include: {
      roleAdGroups: true,
      roleFeatures: { include: { feature: true } },
      roleJobCodes: true,
    },
  });
  const features = await prisma.userFeature.findMany({});
  return { roles, features };
};
export default () => {
  const { roles, features } = useLoaderData<typeof loader>();

  return (
    <>
      <h1>ABAC </h1>
      <table>
        {roles.map((role) => (
          <tr>
            {" "}
            <td>{role.name}</td>
            <td>
              <table>
                {role.roleFeatures.map((feature) => (
                  <tr>
                    <td>{feature.feature.feature}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <label htmlFor="addFeature">Add Feature...</label>
                    <select name="addFeature" id="addFeature" className="">
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
                {role.roleJobCodes.map((jobCode) => (
                  <tr>
                    <td>{jobCode.jobCode}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <button className="btn btn-blue">Add Job Code...</button>
                  </td>
                </tr>
              </table>
            </td>
            <td>
              <table>
                {role.roleAdGroups.map((adGroup) => (
                  <tr>
                    <td>{adGroup.adGroupName}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <button className="btn btn-blue">Add AD Group...</button>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        ))}
      </table>
    </>
  );
};

export const links = () => [{ rel: "stylesheet", href: styles }];
