const dotenv = require('dotenv');
const {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} = require('@aws-sdk/client-sqs');
const connectDB = require('../config/db');
const { getPaymentsQueueConfig } = require('../config/queue');
const { processPaymentJob } = require('../services/paymentProcessor');

dotenv.config();

let running = true;

function parseBody(body) {
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

async function deleteMessage(client, queueUrl, receiptHandle) {
  await client.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    })
  );
}

async function pollOnce(client, config) {
  const response = await client.send(
    new ReceiveMessageCommand({
      QueueUrl: config.queueUrl,
      MaxNumberOfMessages: 5,
      WaitTimeSeconds: config.waitTimeSeconds,
      VisibilityTimeout: config.visibilityTimeout,
      MessageAttributeNames: ['All'],
    })
  );

  const messages = response.Messages || [];

  for (const message of messages) {
    const payload = parseBody(message.Body);
    const orderId = payload.orderId;

    try {
      const result = await processPaymentJob(orderId);
      console.log('[payment-worker]', result);
      await deleteMessage(client, config.queueUrl, message.ReceiptHandle);
    } catch (error) {
      console.error('[payment-worker] fallo orden', orderId, error.message);
    }
  }
}

async function start() {
  const config = getPaymentsQueueConfig();

  if (!config.enabled) {
    console.error('PAYMENTS_QUEUE_ENABLED no está en true. El worker no arranca.');
    process.exit(1);
  }

  if (!config.queueUrl) {
    console.error('PAYMENTS_QUEUE_URL es requerida.');
    process.exit(1);
  }

  await connectDB();
  const client = new SQSClient({ region: config.region });
  console.log(`Payment worker escuchando ${config.queueUrl}`);

  while (running) {
    try {
      await pollOnce(client, config);
    } catch (error) {
      console.error('[payment-worker] error de polling', error.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

process.on('SIGTERM', () => {
  running = false;
});
process.on('SIGINT', () => {
  running = false;
});

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
