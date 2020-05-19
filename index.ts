#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ZoomEventDbStack } from './lib/zoom-event-db-stack';
import { config } from 'dotenv';

config();

const app = new cdk.App();
new ZoomEventDbStack(app, 'ZoomEventDbStack', {
  stackName: process.env.STACK_NAME || 'zoom-event-db',
  env: {
    region: process.env.AWS_REGION || 'us-east-1',
    account: process.env.AWS_ACCOUNT_ID || '',
  },
  vpcId: process.env.VPC_ID || '',
  docDbMasterUser: process.env.DOCDB_MASTER_USER || '',
  docDbMasterPassword: process.env.DOCDB_MASTER_PASSWORD || '',
});
