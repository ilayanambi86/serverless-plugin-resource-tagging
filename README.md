# serverless-plugin-resource-tagging

Serverless stackTags will update the tags for all the resources that support tagging. But the issue is it will update once during create. If you update the tag values after deployment, it will reflect in next deployment.
We have to remove the stack and redeploy to get the new tags reflect. This plugin will solve that issue for AWS.

### Using this pluging
```
npm install serverless-plugin-resource-tagging
```

### serverless.yml
```
provider:
    name: XXX
    resourceTags:
        Tag1: "Tag1 value"
        Tag2: "Tag2 value"
```
    
### Suported AWS resources
```
"AWS::Lambda::Function",
"AWS::SQS::Queue",
"AWS::Kinesis::Stream",
"AWS::DynamoDB::Table",
"AWS::S3::Bucket",
"AWS::ApiGateway::Stage"
```