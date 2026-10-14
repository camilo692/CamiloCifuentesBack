function isPaymentsQueueEnabled() {
  return String(process.env.PAYMENTS_QUEUE_ENABLED || '').toLowerCase() === 'true';
}

function getPaymentsQueueConfig() {
  return {
    enabled: isPaymentsQueueEnabled(),
    region: process.env.AWS_REGION || 'sa-east-1',
    queueUrl: process.env.PAYMENTS_QUEUE_URL || '',
    waitTimeSeconds: Number(process.env.PAYMENTS_QUEUE_WAIT || 20),
    visibilityTimeout: Number(process.env.PAYMENTS_VISIBILITY_TIMEOUT || 120),
  };
}

module.exports = {
  isPaymentsQueueEnabled,
  getPaymentsQueueConfig,
};
