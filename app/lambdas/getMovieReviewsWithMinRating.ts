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
    const parameters = event?.pathParameters;

    const movieReviewId = parameters?.movieId
      ? parseInt(parameters.movieId)
      : undefined;

    const minRate = event?.queryStringParameters?.minRating
      ? parseInt(event?.queryStringParameters?.minRating)
      : undefined;

    if (!movieReviewId) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "Missing movie ID" }),
      };
    } else if (!minRate) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "Missing min rate" }),
      };
    }

    // THIS SECTION UNNECESSARY?????
    // const queryParams = event.queryStringParameters;
    // if (!queryParams) {
    //   return {
    //     statusCode: 500,
    //     headers: {
    //       "content-type": "application/json",
    //     },
    //     body: JSON.stringify({ message: "Missing query parameters" }),
    //   };
    // }
    // if (!isValidQueryParams(queryParams)) {
    //   return {
    //     statusCode: 500,
    //     headers: {
    //       "content-type": "application/json",
    //     },
    //     body: JSON.stringify({
    //       message: `Incorrect type. Must match Query parameters schema`,
    //       schema: Number,
    //     }),
    //   };
    // }

    let commandInput: QueryCommandInput = {
      TableName: process.env.TABLE_NAME,
    };

    const commandOutput = await ddbDocClient.send(
      new QueryCommand({
        ...commandInput,
        KeyConditionExpression:
          "movidId = :movieReviewId AND rating = :minRate",
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
