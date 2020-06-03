const mongodb = require('mongodb');
const fs = require('fs');

const DB_URL = process.env.DB_URL;
const ca = [fs.readFileSync(`${__dirname}/rds-combined-ca-bundle.pem`)];

let dbClient;

async function handler(event, context, callback) {
  try {
    console.log(event);
    dbClient = await connectToDB();
    const db = dbClient.db("zoomEvents");
    const zoomEvent = JSON.parse(event.body);
    zoomEvent.createdAt = new Date().toUTCString();
    await db.collection("events").insertOne(zoomEvent);
    callback(null, success({ }));
  } catch (err) {
    console.error(err);
    callback("Internal error");
  } finally {
    await dbClient.close();
  }
}


async function connectToDB() {
  const client = await mongodb.MongoClient.connect(DB_URL, {
    ssl: true,
    sslValidate: true,
    sslCA: ca,
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  return client;
}

function success(body) {
  return buildResponse(200, body);
}

function failure(body) {
  return buildResponse(500, body);
}

function notFound(body) {
  return buildResponse(404, body);
}

function redirect(location) {
  return {
    statusCode: 302,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
      Location: location,
    }
  };
}

function buildResponse(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true
    },
    body: JSON.stringify(body)
  };
}

module.exports = {
  handler,
};
