'use strict';

const { Core, DefaultLogger, Worker } = require('@temporalio/worker');
const { WorkflowClient } = require('@temporalio/client');
const assert = require('assert');
const axios = require('axios');
const { createExpressMiddleware } = require('../');
const express = require('express');

describe('createExpressMiddleware', function() {
  let server;
  let worker;
  let client;
  let apiClient;
  let runPromise;
  let workflows;

  describe('using signals-queries', function() {
    before(async function() {
      this.timeout(10000);
      workflows = require('./workflows/signals-queries');
  
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
  
  describe('using timer', function() {
    before(async function() {
      this.timeout(10000);
      workflows = require('./workflows/timer');
  
      // Suppress default log output to avoid logger polluting test output
      await Core.install({ logger: new DefaultLogger('ERROR') });
  
      const taskQueue = 'temporal-rest-test';
      worker = await Worker.create({
        workflowsPath: require.resolve('./workflows/timer'),
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
  
    it('can query and signal the workflow', async function() {
      this.timeout(10000);
      let res = await apiClient.post('/workflow/countdownWorkflow');
      const { workflowId } = res.data;
  
      assert.ok(workflowId);

      res = await apiClient.get(`/query/timeLeft/${workflowId}`);
      assert.equal(typeof res.data.result, 'number');
      assert.ok(res.data.result > 0 && res.data.result <= 1500, res.data.result);

      res = await apiClient.put(`/signal/setDeadline/${workflowId}`, { deadline: Date.now() + 3000 });
      assert.ok(res.data.ok);
      
      res = await apiClient.get(`/query/timeLeft/${workflowId}`);
      assert.equal(typeof res.data.result, 'number');
      assert.ok(res.data.result > 1500 && res.data.result <= 3000, res.data.result);
    });
  });
});