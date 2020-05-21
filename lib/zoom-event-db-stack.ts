import * as cdk from '@aws-cdk/core';
import * as path from 'path';
import { Vpc, SecurityGroup, Peer, Port, BastionHostLinux, SubnetType } from '@aws-cdk/aws-ec2';
import { CfnDBSubnetGroup, CfnDBCluster, CfnDBInstance } from '@aws-cdk/aws-docdb';
import { RestApi, LambdaIntegration, AwsIntegration } from '@aws-cdk/aws-apigateway';
import { Function, Runtime, Code } from '@aws-cdk/aws-lambda';
import { CfnOutput } from '@aws-cdk/core';

export interface ZoomEventDbStackProps extends cdk.StackProps {
  readonly vpcId: string;
  readonly docDbMasterUser: string;
  readonly docDbMasterPassword: string;
}

export class ZoomEventDbStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: ZoomEventDbStackProps) {
    super(scope, id, props as cdk.StackProps);

    const {
      vpcId,
      docDbMasterUser,
      docDbMasterPassword,
    } = props;

    const vpc = Vpc.fromLookup(this, 'Vpc', { vpcId }) as Vpc;

    const sg = new SecurityGroup(this, 'docdb-sg', {
      vpc,
      securityGroupName: 'docdb-sg',
    });

		const bastionHost = new BastionHostLinux(this, 'SshBastionHost', {
			vpc,
			subnetSelection: { subnetType: SubnetType.PUBLIC },
			instanceName: `${props.stackName}-bastion`,
			securityGroup: sg,
		});
		sg.addIngressRule(Peer.anyIpv4(), Port.tcp(22));

    const dbSubnetGroup = new CfnDBSubnetGroup(this, 'DocDbSubnetGroup', {
      subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
      dbSubnetGroupName: `${props.stackName}-db-subnet-group`,
      dbSubnetGroupDescription: 'DocDB subnet for zoom-event-db',
    });

    const dbCluster = new CfnDBCluster(this, 'DocDbCluster', {
      masterUsername: docDbMasterUser,
      masterUserPassword: docDbMasterPassword,
      dbSubnetGroupName: dbSubnetGroup.dbSubnetGroupName,
      vpcSecurityGroupIds: [sg.securityGroupId],
      availabilityZones: vpc.availabilityZones,
    });

    const dbInstance = new CfnDBInstance(this, 'DocDbInstance', {
      dbClusterIdentifier: dbCluster.ref,
      dbInstanceClass: "db.r5.large",
    });
    dbInstance.addDependsOn(dbCluster);

    sg.addIngressRule(Peer.ipv4(vpc.vpcCidrBlock), Port.tcp(27017));

    const DB_URL = `mongodb://${dbCluster.masterUsername}:${dbCluster.masterUserPassword}@${dbCluster.attrEndpoint}:${dbCluster.attrPort}`;

    const newEvent = new Function(this, "PutEventFunction", {
      runtime: Runtime.NODEJS_12_X,
      code: Code.asset(path.join(__dirname, '..', 'build/zoomEvent.zip')),
      handler: "index.handler",
      securityGroup: sg,
      environment: {
        DB_URL,
      },
      vpc,
    });

    const api = new RestApi(this, 'EventApi', {
      restApiName: "zoom-event-db-api",
    });

    const eventResource = api.root.addResource("event");
    const integration = new LambdaIntegration(newEvent);
    eventResource.addMethod("POST", integration);

    const eventEndpoint = new CfnOutput(this, 'ZoomEventEndpointUrl', {
      value: `https://${api.restApiId}.execute-api.${this.region}.amazonaws.com/prod/event`,
      exportName: 'ZoomEventEndpointUrl',
    });

  }
}
