#!/usr/bin/env bash

set -e

STACK_NAME=${1:-zoom-event-db}

# id of the ssh bastion instance; need this to put our public key there
# this is where we'll keep the rds public key
RDS_CA_BUNDLE=${HOME}/.ssh/rds-combined-ca-bundle.pem
wget -q -O - https://s3.amazonaws.com/rds-downloads/rds-combined-ca-bundle.pem > $RDS_CA_BUNDLE

# allow for alternate stack names
BASTION_INSTANCE_ID=`aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[].Outputs[?ExportName=='${STACK_NAME}-bastion-instance-id'].OutputValue" --output text`

# arn of the secretsmanager secret where the db master password is stored
DB_PASSWORD_SECRET_ARN=`aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[].Outputs[?ExportName=='${STACK_NAME}-db-password-secret-arn'].OutputValue" --output text`

# endpoint/hostname of the db
DB_ENDPOINT=`aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[].Outputs[?ExportName=='${STACK_NAME}-db-endpoint'].OutputValue" --output text`

# fetch the db password from secretsmanager
DB_PASSWORD=`aws secretsmanager get-secret-value --secret-id $DB_PASSWORD_SECRET_ARN --query 'SecretString' --output text`

# we need the bastion host's availability zone and public ip to copy our key there and set up the ssh tunnel
aws ec2 describe-instances --instance-ids $BASTION_INSTANCE_ID --query 'Reservations[].Instances[].[PublicIpAddress,Placement.AvailabilityZone]' --output text | while read ip az
do
  # this puts our ssh public key on the bastion (but only for 60s!)
  aws ec2-instance-connect send-ssh-public-key --instance-id $BASTION_INSTANCE_ID \
    --instance-os-user ec2-user --availability-zone $az \
    --ssh-public-key file://${HOME}/.ssh/id_rsa.pub
  # create the tunnel; the `sleep 10` makes it so the process autocloses after not being in use
  ssh -C -o StrictHostKeyChecking=no -f -L 27018:$DB_ENDPOINT:27017 ec2-user@$ip sleep 10
done

#echo "mongodb://root:${DB_PASSWORD}@${DB_ENDPOINT}:27017"

mongo --sslAllowInvalidHostnames --ssl --sslCAFile $RDS_CA_BUNDLE \
  --username root --password $DB_PASSWORD --port 27018
