const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { getPaymentsQueueConfig } = require('../config/queue');

let client;

function getClient() {
  const { region } = getPaymentsQueueConfig();
  if (!client) {
    client = new SQSClient({ region });
  }
  return client;
}

async function enqueuePaymentJob(orderId) {
  const { enabled, queueUrl } = getPaymentsQueueConfig();

  if (!enabled) {
    return { queued: false, reason: 'disabled' };
  }

  if (!queueUrl) {
    throw new Error('PAYMENTS_QUEUE_URL no está configurada');
  }

  await getClient().send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({
        type: 'payment',
        orderId: String(orderId),
      }),
      MessageAttributes: {
        orderId: {
          DataType: 'String',
          StringValue: String(orderId),
        },
      },
    })
  );

  return { queued: true };
}

module.exports = {
  enqueuePaymentJob,
};
