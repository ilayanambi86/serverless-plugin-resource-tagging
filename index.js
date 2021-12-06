'use strict';

const _ = require('underscore');

class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.provider = serverless ? serverless.getProvider('aws') : null;
    this.service = serverless.service;
    this.stage = null;
    this.region = null;
    this.isApiGatewayStageAvailableInTemplate = false;
    this.supportedTypes = [
      "AWS::Lambda::Function",
      "AWS::SQS::Queue",
      "AWS::Kinesis::Stream",
      "AWS::DynamoDB::Table",
      "AWS::S3::Bucket",
      "AWS::ApiGateway::Stage",
      "AWS::CloudFront::Distribution",
      "AWS::Logs::LogGroup"
    ];

    if (!this.provider) {
      throw new Error('This plugin must be used with AWS');
    }

    this.hooks = {
      'deploy:finalize': this._addAPIGatewayStageTags.bind(this),
      'after:deploy:deploy': this._addTagsToResource.bind(this),
      'after:aws:package:finalize:mergeCustomProviderResources': this._addTagsToResource.bind(this)
    };
  }

  _addTagsToResource() {
    var stackTags = [];
    var self = this;
    const template = this.serverless.service.provider.compiledCloudFormationTemplate;


    this.stage = this.serverless.service.provider.stage;
    if (this.options.stage) {
      this.stage = this.options.stage;
    }

    this.region = this.serverless.service.provider.region;
    if (this.options.region) {
      this.region = this.options.region;
    }

    if (typeof this.serverless.service.provider.stackTags === 'object') {
      var tags = this.serverless.service.provider.stackTags
      Object.keys(tags).forEach(function (key) {
        stackTags.push({ "Key": key, "Value": tags[key] })
      });
    }

    Object.keys(template.Resources).forEach(function (key) {
      var resourceType = template.Resources[key]['Type']
      if ((self.supportedTypes.indexOf(resourceType) !== -1) && Array.isArray(stackTags) && stackTags.length > 0) {
        if (template.Resources[key]['Properties']) {
          var tags = template.Resources[key]['Properties']['Tags']
          if (tags) {
            template.Resources[key]['Properties']['Tags'] = tags.concat(stackTags.filter(obj => (self._getTagNames(tags).indexOf(obj["Key"]) === -1)))
          } else {
            template.Resources[key]['Properties']['Tags'] = stackTags
          }
        } else {
          self.serverless.cli.log('Properties not available for ' + resourceType);
        }
      }

      //Flag to avoid _addAPIGatewayStageTags() call if stage config is available in serverless.yml
      if (resourceType === "AWS::ApiGateway::Stage") {
        self.isApiGatewayStageAvailableInTemplate = true;
      }
    });
    self.serverless.cli.log('Updated AWS resource tags..');
  }

  _addAPIGatewayStageTags() {
    var self = this;
    var stackName = this.provider.naming.getStackName();
    if (!self.isApiGatewayStageAvailableInTemplate) {
      return this.provider.request('CloudFormation', 'describeStackResources', { StackName: stackName })
        .then(function (resp) {
          var promiseStack = [];
          _.each(_.filter(resp.StackResources, resource => resource.ResourceType === 'AWS::ApiGateway::RestApi'), function (resource) {
            var apiStageParams = {
              resourceArn: 'arn:aws:apigateway:' + self.region + '::/restapis/' + resource.PhysicalResourceId + '/stages/' + self.stage,
              tags: self.service.provider.stackTags
            };
            promiseStack.push(self.provider.request('APIGateway', 'tagResource', apiStageParams))
          });
          return Promise.all(promiseStack).then(resp => self.serverless.cli.log('Updated APIGateway resource tags..'));
        });
    } else {
      self.serverless.cli.log('APIGateway stage already available in serverless.yml. Tag update skipped.');
      return null;
    }
  }

  _getTagNames(srcArray) {
    var tagNames = []
    srcArray.forEach(function (element) {
      tagNames.push(element["Key"])
    });
    return tagNames
  }
}

module.exports = ServerlessPlugin;
