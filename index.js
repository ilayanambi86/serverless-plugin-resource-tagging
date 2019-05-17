'use strict';


class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.supportedTypes = [
      "AWS::Lambda::Function",
      "AWS::SQS::Queue",
      "AWS::Kinesis::Stream",
      "AWS::DynamoDB::Table",
      "AWS::S3::Bucket",
      "AWS::ApiGateway::Stage"
    ]
    this.hooks = {
      'after:deploy:deploy': this.addTagsToResource.bind(this),
      'after:aws:package:finalize:mergeCustomProviderResources': this.addTagsToResource.bind(this)
    };
  }

  addTagsToResource() {
    var resourceTags = [];
    var self = this;
    const template = this.serverless.service.provider.compiledCloudFormationTemplate;

    var stage = this.serverless.service.provider.stage;
    if (this.serverless.variables.options.stage) {
      stage = this.serverless.variables.options.stage;
    }

    if (typeof this.serverless.service.provider.resourceTags === 'object') {
      var tags = this.serverless.service.provider.resourceTags
      Object.keys(tags).forEach(function (key) {
        resourceTags.push({ "Key": key, "Value": tags[key] })
      });
    }

    Object.keys(template.Resources).forEach(function (key) {
      var resourceType = template.Resources[key]['Type']
      if ((self.supportedTypes.indexOf(resourceType) !== -1) && Array.isArray(resourceTags) && resourceTags.length > 0) {
        if (template.Resources[key]['Properties']) {
          var tags = template.Resources[key]['Properties']['Tags']
          if (tags) {
            template.Resources[key]['Properties']['Tags'] = tags.concat(resourceTags.filter(obj => (self.getTagNames(tags).indexOf(obj["Key"]) === -1)))
          } else {
            template.Resources[key]['Properties']['Tags'] = resourceTags
          }
        } else {
          self.serverless.cli.log('Properties not available for ' + resourceType);
        }
      }
    });
    self.serverless.cli.log('Updated resource tags..');
  }

  getTagNames(srcArray) {
    var tagNames = []
    srcArray.forEach(function (element) {
      tagNames.push(element["Key"])
    });
    return tagNames
  }
}

module.exports = ServerlessPlugin;
