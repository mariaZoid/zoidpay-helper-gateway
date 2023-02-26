import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const namespace = `${pulumi.getProject()}-${pulumi.getStack()}`;
const cfg = new pulumi.Config();

const kmsKey = new aws.kms.Key(`${namespace}-kms-key`, {
  description: "KMS key for the Cluster logs",
  deletionWindowInDays: 7,
});

const logGroup = new aws.cloudwatch.LogGroup(`${namespace}-log-group`, {
  retentionInDays: cfg.requireNumber("logsRetentionInDays"),
});

const cluster = new aws.ecs.Cluster(namespace, {
  configuration: {
    executeCommandConfiguration: {
      kmsKeyId: kmsKey.arn,
      logging: "OVERRIDE",
      logConfiguration: {
        cloudWatchEncryptionEnabled: true,
        cloudWatchLogGroupName: logGroup.name,
      },
    },
  },
});

const _clusterCapacityProviders = new aws.ecs.ClusterCapacityProviders(
 `${namespace}-capacity-providers`,
  {
    clusterName: cluster.name,
    capacityProviders: ["FARGATE"],
    defaultCapacityProviderStrategies: [
      {
        base: 1,
        weight: 100,
        capacityProvider: "FARGATE",
      },
    ],
  }
);

export const clusterID = cluster.id;
