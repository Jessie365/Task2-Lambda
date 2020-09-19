const AWS = require('aws-sdk')
const DB = new AWS.DynamoDB.DocumentClient()

exports.handler = async (event) => {
    const invocationDate = Date.now()
    const ec2 = new AWS.EC2({apiVersion: '2016-11-15'})

    let regionsData
    try {
        regionsData = await ec2.describeRegions().promise()
    } catch (ex) {
        console.log('There was an error fetching regions data')
        console.log(ex)
        return 1
    }
    
    for (let region of regionsData.Regions) {
        let ec2Regional = new AWS.EC2({apiVersion: '2016-11-15', region: region.RegionName})
        let vpcsData, subnetsData

        try {
            vpcsData = await ec2Regional.describeVpcs().promise()
            subnetsData = await ec2Regional.describeSubnets().promise()
        } catch (ex) {
            console.log(`There was an error fetching VPCs and subnets for region: ${region.RegionName}`)
            console.log(ex)
            return 1
        }
        
        try {
            await persistVpsWithSubnets(vpcsData, subnetsData, region, invocationDate)
        } catch (ex) {
            console.log(`There was an error persisting VPCs for region: ${region.RegionName}`)
            console.log(ex)
            return 1
        }
        
    }
    console.log('VPC information for each Region saved!')
    return 0;
};

// vpcsData    -> info for all VPCs in particular Region
// subnetsData -> info for all Subnets in particular Region
async function persistVpsWithSubnets(vpcsData, subnetsData, region, invocationDate) {
    for (let vpc of vpcsData.Vpcs) {
        const subnets = subnetsData.Subnets.filter(s => s.VpcId == vpc.VpcId)
        let vpcToPersist = (({VpcId, State, CidrBlock, IsDefault}) => ({VpcId, State, CidrBlock, IsDefault}))(vpc)
        vpcToPersist.Region = region.RegionName
        vpcToPersist.Subnets = []
        for (let subnet of subnets) {
            subnet = (({SubnetId, State, CidrBlock, AvailableIpAddressCount}) => ({SubnetId, State, CidrBlock, AvailableIpAddressCount}))(subnet)
            vpcToPersist.Subnets.push(subnet)
        }
        await persistVpc(vpcToPersist, invocationDate)
    }
}

// Persist single VPC with its subnets in DynamoDB using document client
async function persistVpc(vpc, invocationDate) {   
    let params = {
        Item: {
            created_at: invocationDate.toString(),
            ...vpc
        },
        TableName: 'VpcInfo'
    }
    await DB.put(params).promise()
}
