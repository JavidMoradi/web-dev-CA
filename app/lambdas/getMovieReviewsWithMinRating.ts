import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { MovieReview } from "../shared/types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";

const ajv = new Ajv();
const isValidQueryParams = ajv.compile(schema.definitions["MovieReview"] || {});

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("event:", event);
    
    const parameters = event?.pathParameters;
    console.log("parameters:", parameters);

    const movieReviewId = parameters?.movieId
      ? parseInt(parameters.movieId)
      : undefined;
    console.log("movie id:", movieReviewId);

    const minRate = event?.queryStringParameters?.minRate
      ? parseInt(event?.queryStringParameters?.minRate)
      : undefined;
    console.log("Min rate:", minRate);

    if (!movieReviewId || !minRate) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "Missing movie ID or Min Rate" }),
      };
    }

    const commandOutput = await ddbDocClient.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: "id = :movieReviewId",
        FilterExpression: "rating > :minRate",
        ExpressionAttributeValues: {
          ":movieReviewId": movieReviewId,
          ":minRate": minRate,
        },
      })
    );

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        data: commandOutput.Items,
      }),
    };
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error }),
    };
  }
};

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
