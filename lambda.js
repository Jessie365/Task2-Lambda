const AWS = require('aws-sdk')
const DB = new AWS.DynamoDB.DocumentClient()

exports.handler = async (event) => {
    const invocationDate = Date.now()
    const ec2 = new AWS.EC2({apiVersion: '2016-11-15'})
    const regionsData = await ec2.describeRegions().promise()
    for (let region of regionsData.Regions) {
        const ec2Regional = new AWS.EC2({apiVersion: '2016-11-15', region: region.RegionName})
        const vpcsData = await ec2Regional.describeVpcs().promise()
        const subnetsData = await ec2Regional.describeSubnets().promise()
        await persistVpsWithSubnets(vpcsData, subnetsData, region, invocationDate)
    }
    const response = {
        statusCode: 200,
        body: JSON.stringify('gr8'),
    };
    return response;
};

// vpcsData    -> info for all VPCs in particular Region
// subnetsData -> info for all Subnets in particular Region
async function persistVpsWithSubnets(vpcsData, subnetsData, region, invocationDate) {
    for (let vpc of vpcsData.Vpcs) {
        console.log(vpc.VpcId)
        const subnets = subnetsData.Subnets.filter(s => s.VpcId == vpc.VpcId)
        // console.log(subnets)
        let vpcToPersist = (({VpcId, State, CidrBlock, IsDefault}) => ({VpcId, State, CidrBlock, IsDefault}))(vpc)
        vpcToPersist.Region = region.RegionName
        vpcToPersist.Subnets = []
        for (let subnet of subnets) {
            subnet = (({SubnetId, State, CidrBlock, AvailableIpAddressCount}) => ({SubnetId, State, CidrBlock, AvailableIpAddressCount}))(subnet)
            vpcToPersist.Subnets.push(subnet)
        }
        console.log(vpcToPersist)
        await persistVpc(vpcToPersist, invocationDate)
    }
}

async function persistVpc(vpc, invocationDate) {   
    let params = {
        Item: {
            created_at: invocationDate.toString(),
            ...vpc
        },
        TableName: 'VpcInfo'
    }
    console.log(params)
    await DB.put(params).promise()
}