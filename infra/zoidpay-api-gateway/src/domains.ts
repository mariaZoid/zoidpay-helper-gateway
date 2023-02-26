import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const namespace = `${pulumi.getProject()}-${pulumi.getStack()}`;

export const createRoute53Zone = () => {
  return new aws.route53.Zone(`${namespace}-dns-zone`, {
    name: "dev-zoidpay.com",
  });
};

export const createACMCertificate = (dnsZone: aws.route53.Zone) => {
  const certificate = new aws.acm.Certificate(`${namespace}-acm-cert`, {
    domainName: `*.dev-zoidpay.com`,
    validationMethod: "DNS",
  });

  const validationRecords: aws.route53.Record[] = [];

  certificate.domainValidationOptions.apply((domainValidationOptions) =>
    domainValidationOptions.map((domainValidationOption, index) => {
      validationRecords.push(
        new aws.route53.Record(`${namespace}-validation-record-${index}`, {
          allowOverwrite: true,
          name: domainValidationOption.resourceRecordName,
          records: [domainValidationOption.resourceRecordValue],
          ttl: 60,
          type: domainValidationOption.resourceRecordType,
          zoneId: dnsZone.zoneId,
        })
      );
    })
  );

  const _certificateValidation = new aws.acm.CertificateValidation(
    `${namespace}-acm-cert-validation`,
    {
      certificateArn: certificate.arn,
      validationRecordFqdns: validationRecords.map((record) => record.fqdn),
    }
  );

  return certificate;
};