import * as cdk from '@aws-cdk/core';
import * as path from 'path';
import { Vpc, SecurityGroup, Peer, Port, BastionHostLinux, SubnetType, InstanceType, InstanceClass, InstanceSize } from '@aws-cdk/aws-ec2';
import { DatabaseCluster } from '@aws-cdk/aws-docdb';
import { RestApi, LambdaIntegration } from '@aws-cdk/aws-apigateway';
import { Function, Runtime, Code } from '@aws-cdk/aws-lambda';
import { Secret } from '@aws-cdk/aws-secretsmanager';
import { CfnOutput } from '@aws-cdk/core';

export interface ZoomEventDbStackProps extends cdk.StackProps {
  readonly vpcId: string;
}

export class ZoomEventDbStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: ZoomEventDbStackProps) {
    super(scope, id, props as cdk.StackProps);

    const vpc = Vpc.fromLookup(this, 'Vpc', { vpcId: props.vpcId }) as Vpc;
    const sg = new SecurityGroup(this, 'DocDbSecurityGroup', { vpc });

		const bastionHost = new BastionHostLinux(this, 'SshBastionHost', {
			vpc,
			subnetSelection: { subnetType: SubnetType.PUBLIC },
			instanceName: `${props.stackName}-bastion`,
			securityGroup: sg,
		});
    sg.addIngressRule(Peer.anyIpv4(), Port.tcp(22));
    sg.addIngressRule(Peer.ipv4(vpc.vpcCidrBlock), Port.tcp(27017));

    const dbPassword = new Secret(this, 'DbPasswordSecret', {
      description: `Login password for the ${props.stackName} document db`,
      secretName: `${props.stackName}DbPassword`,
      generateSecretString: {
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 12,
      },
    });

    const dbCluster = new DatabaseCluster(this, 'DocDbCluster', {
      masterUser: {
        username: 'root',
        password: dbPassword.secretValue,
      },
      instanceProps: {
        vpc,
        instanceType: InstanceType.of(InstanceClass.R5, InstanceSize.LARGE),
        securityGroup: sg,
        vpcSubnets: {
          subnetType: SubnetType.PRIVATE,
        },
      }
    });

    const endpoint = dbCluster.clusterEndpoint;
    const DB_URL = `mongodb://root:${dbPassword.secretValue.toString()}@${endpoint.hostname}:${endpoint.portAsString()}`;

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

    const dbEndpoint = new CfnOutput(this, 'DbEndpoint', {
      value: dbCluster.clusterEndpoint.hostname,
      exportName: `${props.stackName}-db-endpoint`,
    });

    const eventEndpoint = new CfnOutput(this, 'ZoomEventEndpointUrl', {
      value: `https://${api.restApiId}.execute-api.${this.region}.amazonaws.com/prod/event`,
      exportName: `${props.stackName}-endpoint-url`,
    });

    const bastionInstanceId = new CfnOutput(this, 'BastionInstanceId', {
      value: bastionHost.instanceId,
      exportName: `${props.stackName}-bastion-instance-id`,
    });

    const dbPasswordSecret = new CfnOutput(this, 'DbPasswordSecretArn', {
      value: dbPassword.secretArn,
      exportName: `${props.stackName}-db-password-secret-arn`,
    });

  }
}
