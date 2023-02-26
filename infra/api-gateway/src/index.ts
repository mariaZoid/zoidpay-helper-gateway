import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as awsnative from "@pulumi/aws-native";

const namespace = `${pulumi.getProject()}-${pulumi.getStack()}`;
const cfg = new pulumi.Config();

const sharedStack = new pulumi.StackReference(
  cfg.require("sharedStackReference")
);

const clusterArn = sharedStack.getOutput("clusterArn");
const clusterName = sharedStack.getOutput("clusterName");

const vpc = {
  id: sharedStack.getOutput("vpcId"),
  publicSubnetsIDs: sharedStack.getOutput("publicSubnetsIDs"),
  vpcDefaultSecurityGroupID: sharedStack.getOutput("vpcDefaultSecurityGroupID"),
};

const loadBalancers: aws.types.input.ecs.ServiceLoadBalancer[] = [];

const loadBalancer = new awsx.lb.ApplicationLoadBalancer(`${namespace}-alb`, {
  subnetIds: vpc.publicSubnetsIDs,
  defaultTargetGroup: {
    name: `${namespace}-tg`,
    port: 80,
    protocol: "HTTP",
    healthCheck: {
      path: "/api-docs/",
      matcher: "200",
    },
  },
  listeners: [
    {
      port: 443,
      protocol: "HTTPS",
      sslPolicy: "ELBSecurityPolicy-2016-08",
      certificateArn: "arn:aws:acm:eu-central-1:169819332803:certificate/38cee041-f4ad-43a8-ac68-4898f32437e0",
    },
    {
      port: 80,
      protocol: "HTTP",
      defaultActions: [
        {
          type: "redirect",
          redirect: {
            port: "443",
            protocol: "HTTPS",
            statusCode: "HTTP_301",
          },
        },
      ],
    },
  ],
});

const webAclRules: awsnative.wafv2.WebACLArgs["rules"] = [];

const webAcl = new awsnative.wafv2.WebACL(`${namespace}-web-acl`, {
  scope: "REGIONAL",
  defaultAction: { allow: {} },
  rules: webAclRules,
  visibilityConfig: {
    cloudWatchMetricsEnabled: false,
    metricName: "Requests",
    sampledRequestsEnabled: false,
  },
});

const _webAclAssociation = new aws.wafv2.WebAclAssociation(
  `${namespace}-web-acl-assoc`,
  {
    resourceArn: loadBalancer.loadBalancer.arn,
    webAclArn: webAcl.arn,
  }
);

loadBalancers.push({
  containerName: "container",
  containerPort: 80,
  targetGroupArn: loadBalancer.defaultTargetGroup.arn,
});

const sharedECRRepositoryURI =
  "169819332803.dkr.ecr.eu-central-1.amazonaws.com/zoidpay-shared-repository";

const fargateTaskDefinition = new awsx.ecs.FargateTaskDefinition(
  `${namespace}-task-definition`,
  {
    cpu: "512",
    memory: "1024",
    containers: {
      container: {
        image: `${sharedECRRepositoryURI}:${cfg.require("imageTag")}`,
        environment: [
          {
            name: "EXAMPLE",
            value: "example123",
          },
        ],
        portMappings: [
          {
            containerPort: 80,
            hostPort: 80,
            protocol: "tcp",
          },
        ],
      },
    },
  }
);

const fargateService = new awsx.ecs.FargateService(`${namespace}-ecs-service`, {
  cluster: clusterArn,
  networkConfiguration: {
    subnets: vpc.publicSubnetsIDs,
    assignPublicIp: true,
    securityGroups: [vpc.vpcDefaultSecurityGroupID],
  },
  desiredCount: 1,
  loadBalancers,
  taskDefinition: fargateTaskDefinition.taskDefinition.arn,
});

// Autoscaling configuration
const { minTasks, maxTasks, scaleInCooldown, scaleOutCooldown, threshold } = {
  minTasks: 1,
  maxTasks: 3,
  scaleInCooldown: 60,
  scaleOutCooldown: 60,
  threshold: 70,
};

const autoScalingTarget = new aws.appautoscaling.Target(
  `${namespace}-auto-scaling-target`,
  {
    minCapacity: minTasks,
    maxCapacity: maxTasks,
    serviceNamespace: "ecs",
    resourceId: pulumi.interpolate`service/${clusterName}/${fargateService.service.name}`,
    scalableDimension: "ecs:service:DesiredCount",
  }
);

const _autoScalingPolicy = new aws.appautoscaling.Policy(
  `${namespace}-auto-scaling-policy`,
  {
    policyType: "TargetTrackingScaling",
    resourceId: autoScalingTarget.id,
    scalableDimension: "ecs:service:DesiredCount",
    serviceNamespace: "ecs",
    targetTrackingScalingPolicyConfiguration: {
      predefinedMetricSpecification: {
        predefinedMetricType: "ECSServiceAverageCPUUtilization",
      },
      scaleInCooldown: scaleInCooldown ?? 60,
      scaleOutCooldown: scaleOutCooldown ?? 60,
      targetValue: threshold,
    },
  }
);