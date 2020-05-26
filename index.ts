#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { ZoomEventDbStack } from './lib/zoom-event-db-stack';
import { config } from 'dotenv';

config();

const app = new cdk.App();
new ZoomEventDbStack(app, 'ZoomEventDbStack', {
  stackName: process.env.STACK_NAME || 'zoom-event-db',
  vpcId: process.env.VPC_ID || '',
  env: {
    region: process.env.AWS_REGION || 'us-east-1',
    account: process.env.AWS_ACCOUNT_ID || '',
  },
  tags: {
    "project": "MH",
    "department": "OU",
    "product": "edtech-apps",
    "subproduct": "zoom-event-db",
  },
});

app.synth();
