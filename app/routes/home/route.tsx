import { useLoaderData } from "@remix-run/react";
import { prisma } from "~/db.server"


export const loader = async () => {
    const roles = await prisma.userRole.findMany({});
    const roleFeatureMappings = await prisma.roleFeature.findMany({});
    const roleAdGroups = await prisma.roleAdGroup.findMany({});
    const roleJobCodes = await prisma.roleJobCode.findMany({});

    return {roles, roleFeatureMappings, roleAdGroups, roleJobCodes}

}
export default () => {  
    const { roles, roleAdGroups, roleFeatureMappings, roleJobCodes }= useLoaderData<typeof loader>();

    return (
        <>
        
        <ol>
            {roles.map(({name}) => <li>{name}</li>)}
        </ol>
        </>
    )
    
}