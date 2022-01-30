declare module 'temporal-rest' {
  import temporal = require('@temporalio/client');

  export function createExpressMiddleware(workflows: any, client: temporal.WorkflowClient, taskQueue: string);
}