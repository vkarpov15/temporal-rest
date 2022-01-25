'use strict';

const { Core, DefaultLogger, Worker } = require('@temporalio/worker');
const { WorkflowClient } = require('@temporalio/client');
const assert = require('assert');
const axios = require('axios');
const { createExpressMiddleware } = require('../');
const express = require('express');
const workflows = require('./workflows/signals-queries');

describe('createExpressMiddleware', function() {
  let server;
  let worker;
  let client;
  let apiClient;
  let runPromise;

  before(async function() {
    this.timeout(10000);

    // Suppress default log output to avoid logger polluting test output
    await Core.install({ logger: new DefaultLogger('ERROR') });

    const taskQueue = 'temporal-rest-test';
    worker = await Worker.create({
      workflowsPath: require.resolve('./workflows/signals-queries'),
      taskQueue
    });

    runPromise = worker.run();

    client = new WorkflowClient();

    const app = express();
    app.use(createExpressMiddleware(workflows, client, taskQueue));
    server = app.listen(3001);

    apiClient = axios.create({ baseURL: 'http://localhost:3001' });
  });

  after(async function() {
    worker.shutdown();
    await runPromise;
    await server.close();
  });

  it('allows creating workflows', async function() {
    const res = await apiClient.post('/workflow/unblockOrCancel');
    assert.ok(res.data.workflowId);

    const handle = await client.getHandle(res.data.workflowId);
    const isBlocked = await handle.query(workflows.isBlockedQuery);
    assert.strictEqual(isBlocked, true);
  });

  it('can query and signal the workflow', async function() {
    let res = await apiClient.post('/workflow/unblockOrCancel');
    const { workflowId } = res.data;

    res = await apiClient.get(`/query/isBlocked/${workflowId}`);
    assert.ok(res.data.result);

    await apiClient.put(`/signal/unblock/${workflowId}`);
    
    res = await apiClient.get(`/query/isBlocked/${workflowId}`);
    assert.strictEqual(res.data.result, false);
  });
});