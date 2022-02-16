import { Core, DefaultLogger, Worker } from '@temporalio/worker';
import { Server } from 'http';
import { WorkflowClient } from '@temporalio/client';
import assert from 'assert';
import axios, { Axios } from 'axios';
import { before, describe, it } from 'mocha';
import { createExpressMiddleware } from '../';
import express from 'express';
import * as wf from '@temporalio/workflow';

import * as signalsQueries from './workflows/signals-queries';
import * as timer from './workflows/timer';

describe('createExpressMiddleware', function() {
  let server: Server;
  let worker: Worker;
  let client: WorkflowClient;
  let apiClient: Axios;
  let runPromise: Promise<any>;
  let workflows: any;

  describe('using signals-queries', function() {
    before(async function() {
      this.timeout(10000);
      workflows = signalsQueries;
  
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
      workflows = timer;
  
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
  
    it('can pass args to signals in request body', async function() {
      let res = await apiClient.post('/workflow/countdownWorkflow');
      const { workflowId } = res.data;
  
      assert.ok(workflowId);

      res = await apiClient.get(`/query/timeLeft/${workflowId}`);
      assert.strictEqual(res.data.result, 1500);

      res = await apiClient.put(`/signal/setDeadline/${workflowId}`, { deadline: Date.now() + 3000 });
      assert.ok(res.data.ok);
      
      res = await apiClient.get(`/query/timeLeft/${workflowId}`);
      assert.equal(typeof res.data.result, 'number');
      assert.ok(res.data.result >= 1500 && res.data.result <= 3000, res.data.result);
    });

    it('can pass args to workflows in request body', async function() {
      let res = await apiClient.post('/workflow/countdownWorkflow', { delay: 3000 });
      const { workflowId } = res.data;
  
      assert.ok(workflowId);

      res = await apiClient.get(`/query/timeLeft/${workflowId}`);
      assert.strictEqual(res.data.result, 3000);
    });

    it('can pass args to queries in query string', async function() {
      let res = await apiClient.post('/workflow/countdownWorkflow');
      const { workflowId } = res.data;
  
      assert.ok(workflowId);

      res = await apiClient.get(`/query/timeLeft/${workflowId}?seconds=true`);
      assert.strictEqual(res.data.result, 1);
    });
  });
});