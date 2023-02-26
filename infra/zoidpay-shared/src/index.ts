import * as pulumi from  "@pulumi/pulumi";
import * as aws from  "@pulumi/aws";

const cfg = new pulumi.Config();

const exampleValue = cfg.require("example");


