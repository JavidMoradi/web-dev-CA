import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "../shared/utils";
import { movieReviews } from "../seed/movieReviews";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";
import { UserPool } from "aws-cdk-lib/aws-cognito";

export class AppStack extends cdk.Stack {
  private auth: apig.IResource;
  private userPoolId: string;
  private userPoolClientId: string;

  private userPool: cdk.aws_cognito.UserPool;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    this.userPool = new UserPool(this, "UserPool", {
      signInAliases: { username: true },
      selfSignUpEnabled: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.userPoolId = this.userPool.userPoolId;

    const appClient = this.userPool.addClient("AppClient", {
      authFlows: { userPassword: true },
    });

    this.userPoolClientId = appClient.userPoolClientId;

    const authApi = new apig.RestApi(this, "AuthServiceApi", {
      description: "Authentication Service RestApi",
      endpointTypes: [apig.EndpointType.REGIONAL],
      defaultCorsPreflightOptions: {
        allowOrigins: apig.Cors.ALL_ORIGINS,
      },
    });

    this.auth = authApi.root.addResource("auth");

    this.addAuthRoute("signup", "POST", "SignupFn", "signup.ts");
    this.addAuthRoute("signin", "POST", "SigninFn", "signin.ts");
    this.addAuthRoute("signout", "GET", "SignoutFn", "signout.ts");

    // dummy lambda function
    const simpleFn = new lambdanode.NodejsFunction(this, "SimpleFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambdas/simple.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    });

    const simpleFnURL = simpleFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
      },
    });

    new cdk.CfnOutput(this, "Simple Function Url", { value: simpleFnURL.url });

    // dynamoDB Table
    const movieReviewsTable = new dynamodb.Table(this, "MovieReviewsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieReviews",
    });

    new custom.AwsCustomResource(this, "moviesddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [movieReviewsTable.tableName]: generateBatch(movieReviews),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [movieReviewsTable.tableArn],
      }),
    });

    // Get all the reviews for the specified movie
    const getMovieReviewByIdFn = new lambdanode.NodejsFunction(
      this,
      "GetMovieReviewByIdFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/getMovieReviewById.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    const getMovieReviewByIdURL = getMovieReviewByIdFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
      },
    });

    new cdk.CfnOutput(this, "Get Movie Review By ID Function URL", {
      value: getMovieReviewByIdURL.url,
    });

    // Add a movie review.
    const newMovieReviewFn = new lambdanode.NodejsFunction(
      this,
      "AddMovieReviewFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/addMovieReview.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    // Get the reviews for the specified movie with a rating greater than the minRating.
    const getMovieReviewsWithMinRatingFn = new lambdanode.NodejsFunction(
      this,
      "GetMovieReviewsWithMinRatingFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/getMovieReviewsWithMinRating.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    const getMovieReviewsWithMinRatingURL =
      getMovieReviewsWithMinRatingFn.addFunctionUrl({
        authType: lambda.FunctionUrlAuthType.NONE,
        cors: {
          allowedOrigins: ["*"],
        },
      });

    new cdk.CfnOutput(this, "Get Movie Review By ID and Rating Function URL", {
      value: getMovieReviewsWithMinRatingURL.url,
    });

    // Get the review written by the named reviewer for the specified movie.
    const getMovieReviewByNameFn = new lambdanode.NodejsFunction(
      this,
      "GetMovieReviewByNameFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/getMovieReviewByName.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    const getMovieReviewByNameURL = getMovieReviewByNameFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
      },
    });

    new cdk.CfnOutput(this, "Get Movie Review By Reviewer Name Function URL", {
      value: getMovieReviewByNameURL.url,
    });

    // Get the reviews written in a specific year for a specific movie.
    const getMovieReviewByYearFn = new lambdanode.NodejsFunction(
      this,
      "GetMovieReviewByYearFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/getMovieReviewByYear.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    const getMovieReviewByYearURL = getMovieReviewByYearFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
      },
    });

    new cdk.CfnOutput(this, "Get Movie Review By Year Function URL", {
      value: getMovieReviewByYearURL.url,
    });

    // Get all the reviews written by a specific reviewer.
    const getMovieReviewsByReviewerFn = new lambdanode.NodejsFunction(
      this,
      "GetMovieReviewsByReviewerFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/getMovieReviewsByReviewer.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    const getMovieReviewsByReviewerURL =
      getMovieReviewsByReviewerFn.addFunctionUrl({
        authType: lambda.FunctionUrlAuthType.NONE,
        cors: {
          allowedOrigins: ["*"],
        },
      });

    new cdk.CfnOutput(this, "Get Movie Reviews By Reviewer Function URL", {
      value: getMovieReviewsByReviewerURL.url,
    });

    // Update the text of a review.
    const updateMovieReviewFn = new lambdanode.NodejsFunction(
      this,
      "UpdateMovieReviewFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/updateMovieReview.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    // Permissions
    movieReviewsTable.grantReadData(getMovieReviewByIdFn);
    movieReviewsTable.grantReadWriteData(newMovieReviewFn);
    movieReviewsTable.grantReadData(getMovieReviewsWithMinRatingFn);
    movieReviewsTable.grantReadData(getMovieReviewByNameFn);
    movieReviewsTable.grantReadData(getMovieReviewByYearFn);
    movieReviewsTable.grantReadData(getMovieReviewsByReviewerFn);
    movieReviewsTable.grantReadWriteData(updateMovieReviewFn);

    // REST Api Gateway
    const api = new apig.RestApi(this, "RestAPI", {
      description: "app api",
      deployOptions: {
        stageName: "dev",
      },
      endpointTypes: [apig.EndpointType.REGIONAL],
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });

    const appCommonFnProps = {
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
      environment: {
        USER_POOL_ID: this.userPoolId,
        CLIENT_ID: this.userPoolClientId,
        REGION: cdk.Aws.REGION,
      },
    };

    // const authorizerFn = new node.NodejsFunction(this, "AuthorizerFn", {
    //   ...appCommonFnProps,
    //   entry: "./lambdas/auth/authorizer.ts",
    // });

    // const requestAuthorizer = new apig.RequestAuthorizer(
    //   this,
    //   "RequestAuthorizer",
    //   {
    //     identitySources: [apig.IdentitySource.header("cookie")],
    //     handler: authorizerFn,
    //     resultsCacheTtl: cdk.Duration.minutes(0),
    //   }
    // );

    const movieReviewsEndpoint = api.root.addResource("movies");
    const movieIdEndpoint = movieReviewsEndpoint.addResource("{movieId}");
    const reviewsEndpoint = movieIdEndpoint.addResource("reviews");
    reviewsEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieReviewByIdFn, { proxy: true })
    );

    const addReviewEndpoint = movieReviewsEndpoint.addResource("reviews");
    addReviewEndpoint.addMethod(
      "POST",
      new apig.LambdaIntegration(newMovieReviewFn),
      // {
      //   authorizer: requestAuthorizer,
      //   authorizationType: apig.AuthorizationType.CUSTOM,
      // }
    );

    const reviewEndpoint = movieIdEndpoint.addResource("review");
    reviewEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieReviewsWithMinRatingFn, {
        proxy: true,
      })
    );

    const reviewerNameEndpoint = reviewsEndpoint.addResource("{reviewerName}");
    reviewerNameEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieReviewByNameFn, { proxy: true })
    );

    const yearsEndpoint = reviewsEndpoint.addResource("year");
    const yearEndpoint = yearsEndpoint.addResource("{year}");
    yearEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieReviewByYearFn, { proxy: true })
    );

    const allReviewsEndpoint = api.root
      .addResource("reviews")
      .addResource("{reviewerName}");
    allReviewsEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieReviewsByReviewerFn, { proxy: true })
    );

    reviewerNameEndpoint.addMethod(
      "PUT",
      new apig.LambdaIntegration(updateMovieReviewFn, { proxy: true })
    );
  }

  private addAuthRoute(
    resourceName: string,
    method: string,
    fnName: string,
    fnEntry: string,
    allowCognitoAccess?: boolean
  ): void {
    const commonFnProps = {
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
      environment: {
        USER_POOL_ID: this.userPoolId,
        CLIENT_ID: this.userPoolClientId,
        REGION: cdk.Aws.REGION,
      },
    };

    const resource = this.auth.addResource(resourceName);

    const fn = new node.NodejsFunction(this, fnName, {
      ...commonFnProps,
      entry: `${__dirname}/../lambdas/auth/${fnEntry}`,
    });

    resource.addMethod(method, new apig.LambdaIntegration(fn));
  }
}
