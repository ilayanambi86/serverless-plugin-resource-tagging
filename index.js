'use strict';

class ServerlessPlugin {
  constructor(serverless) {
    this.serverless = serverless;
    this.provider = serverless ? serverless.getProvider('aws') : null;
    this.service = serverless.service;
    this.listTagsResources = [
      'AWS::ApiGateway::RestApi',
      'AWS::ApiGateway::Stage',
      'AWS::CloudFront::Distribution',
      'AWS::DynamoDB::Table',
      'AWS::IAM::Role',
      'AWS::Kinesis::Stream',
      'AWS::Lambda::Function',
      'AWS::Logs::LogGroup',
      'AWS::S3::Bucket',
      'AWS::SNS::Topic',
      'AWS::SQS::Queue',
      'AWS::StepFunctions::StateMachine',
      'AWS::WAFv2::WebACL',
    ];
    this.objectTagsResources = [
      'AWS::ApiGatewayV2::Api',
      'AWS::ApiGatewayV2::Stage',
      'AWS::SSM::Parameter',
    ];

    if (!this.provider) {
      throw new Error('This plugin must be used with AWS');
    }

    this.hooks = {
      'after:aws:package:finalize:mergeCustomProviderResources': this._addTagsToResources.bind(this),
    };
  }

  _addTagsToResources() {
    const stackTags = this._getStackTags();
    if (stackTags.length === 0) {
      this.serverless.cli.log('No stack tags, not updating AWS resource tags');
      return;
    }

    const template = this.serverless.service.provider.compiledCloudFormationTemplate;

    Object.keys(template.Resources).forEach((key) => {
      const resourceType = template.Resources[key]['Type'];
      const properties = template.Resources[key]['Properties'];

      if (properties) {
        if (this.listTagsResources.includes(resourceType)) {
          const resourceTags = this._readTagsFromList(properties['Tags']);
          properties['Tags'] = this._mergeTags(resourceTags, stackTags);
        } else if (this.objectTagsResources.includes(resourceType)) {
          const resourceTags = this._readTagsFromObject(properties['Tags']);
          properties['Tags'] = this._tagsListToObject(this._mergeTags(resourceTags, stackTags));
        }
      }
    });

    this.serverless.cli.log('Updated AWS resource tags');
  }

  _readTagsFromList(tags) {
    return tags || [];
  }

  _readTagsFromObject(tags) {
    if (!tags) {
      return [];
    }

    return Object.keys(tags).map(key => ({
      Key: key,
      Value: tags[key],
    }));
  }

  _tagsListToObject(tags) {
    return tags.reduce((acc, tag) => {
      acc[tag['Key']] = tag['Value'];
      return acc;
    }, {});
  }

  _mergeTags(resourceTags, stackTags) {
    return [
      ...resourceTags,
      ...stackTags.filter(tag => !resourceTags.map(t => t['Key']).includes(tag['Key'])),
    ];
  }

  _getStackTags() {
    if (typeof this.serverless.service.provider.stackTags === 'object') {
      return this._readTagsFromObject(this.serverless.service.provider.stackTags);
    }
    return [];
  }
}

module.exports = ServerlessPlugin;
