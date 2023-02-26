import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const namespace = `${pulumi.getProject()}-${pulumi.getStack()}`;
const cfg = new pulumi.Config();

const sharedStack = new pulumi.StackReference(
  cfg.require("sharedStackReference")
);

const clusterId = sharedStack.getOutput("clusterID");

const vpc = {
  publicSubnetsIDs: sharedStack.getOutput("publicSubnetsIDs"),
  vpcDefaultSecurityGroupID: sharedStack.getOutput("vpcDefaultSecurityGroupID"),
}

// A role that AWS assumes in order to *launch* the task (not the role that the task itself assumes)
const executionRole = new aws.iam.Role(`${namespace}-execution-role`, {
  description: `Allows the AWS ECS service to create and manage the ${namespace} service`,
  assumeRolePolicy: {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: "ecs-tasks.amazonaws.com" },
        Action: "sts:AssumeRole",
      },
    ],
  },
});

// AWS-managed policy giving the above role some basic permissions it needs
const _executionPolicyBasic = new aws.iam.RolePolicyAttachment(
  `${namespace}-basic-ecs-policy`,
  {
    policyArn:
      "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    role: executionRole,
  },
  { parent: executionRole }
);

// The role the actual task itself will assume when running
const taskRole = new aws.iam.Role(`${namespace}-task-role`, {
  assumeRolePolicy: {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: {
          Service: "ecs-tasks.amazonaws.com",
        },
        Action: "sts:AssumeRole",
      },
    ],
  },
});

const taskRolePolicy = new aws.iam.RolePolicy(`${namespace}-task-role-policy`, {
  role: taskRole,
  policy: {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: [
          "dynamodb:BatchGetItem",
          "dynamodb:GetItem",
          "dynamodb:Scan",
          "dynamodb:Query",
          "dynamodb:BatchWriteItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
        ],
        Resource: "*",
      },
      {
        Effect: "Allow",
        Action: ["kinesis:PutRecords"],
        Resource: "*",
      },
    ],
  },
});

const logGroupName = "/aws/ecs/IMXPoller";
const logGroup = new aws.cloudwatch.LogGroup(`${namespace}-log-group`, {
  name: logGroupName,
  retentionInDays: cfg.requireNumber("logsRetentionInDays"),
});

const logResourcePolicyDocument = aws.iam.getPolicyDocument({
  statements: [
    {
      actions: [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:PutLogEventsBatch",
      ],
      resources: ["arn:aws:logs:*"],
      principals: [
        {
          identifiers: ["es.amazonaws.com"],
          type: "Service",
        },
      ],
    },
  ],
});
const logResourcePolicy = new aws.cloudwatch.LogResourcePolicy(
  `${namespace}-log-resource-policy`,
  {
    policyDocument: logResourcePolicyDocument.then(
      (policyDocument) => policyDocument.json
    ),
    policyName: "log-publishing-policy",
  }
);

const sharedECRRepositoryURI =
  "169819332803.dkr.ecr.eu-central-1.amazonaws.com/zoidpay-shared-repository";

const taskDefinition = new aws.ecs.TaskDefinition(
  `${namespace}-task-definition`,
  {
    family: "TaskDefinition",
    containerDefinitions: logGroup.name.apply((logGroupNameValue) =>
      JSON.stringify([
        {
          name: "service",
          image: `${sharedECRRepositoryURI}:${cfg.require("imageTag")}`,
          cpu: 512,
          memory: 1024,
          essential: true,
          logConfiguration: {
            logDriver: "awslogs",
            options: {
              "awslogs-region": aws.config.requireRegion().toString(),
              "awslogs-group": logGroupNameValue,
              "awslogs-stream-prefix": namespace,
            },
          },
          environment: [
            {
              name: "IMX_EVENT_STREAM",
              value: cfg.require("eventStreamName"),
            },
            {
              name: "LOG_LEVEL",
              value: cfg.require("logLevel"),
            },
          ],
        },
      ])
    ),
    executionRoleArn: executionRole.arn,
    taskRoleArn: taskRole.arn,
    cpu: "512",
    memory: "1024",
    requiresCompatibilities: ["FARGATE"],
    networkMode: "awsvpc",
  },
  { dependsOn: logGroup }
);

const service = new aws.ecs.Service(namespace, {
  cluster: clusterId,
  launchType: "FARGATE",
  taskDefinition: taskDefinition.arn,
  desiredCount: 1,
  networkConfiguration: {
    subnets: vpc.publicSubnetsIDs,
    assignPublicIp: false,
    securityGroups: [vpc.vpcDefaultSecurityGroupID],
  },
});

export const serviceID = service.id;
