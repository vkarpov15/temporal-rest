import { WorkflowClient } from '@temporalio/client';
import { QueryDefinition, SignalDefinition, Workflow } from '@temporalio/common';
import express from 'express';
import { v4 } from 'uuid';

const signalValidators = new WeakMap<SignalDefinition, Function>();

export function useValidator(signal: SignalDefinition, fn: Function): void {
  signalValidators.set(signal, fn);
}

export function createExpressMiddleware(workflows: any, client: WorkflowClient, taskQueue: string) {
  const router = express.Router();
  
  for (const key of Object.keys(workflows)) {
    const value: any = workflows[key];
    if (typeof value === 'function') {
      // Workflow
      createWorkflowEndpoint(router, client, key, value as Workflow, taskQueue);
    } else if (typeof value === 'object' && value != null) {
      if (value['type'] === 'signal') {
        // Signal
        createSignalEndpoint(router, client, value as SignalDefinition<unknown[]>);
      } else if (value['type'] === 'query') {
        // Query
        createQueryEndpoint(router, client, value as QueryDefinition<unknown, unknown[]>);
      }
    }
  }

  return router;
}

function createWorkflowEndpoint(router: express.Router, client: WorkflowClient, name: string, fn: Workflow, taskQueue: string) {
  router.post(`/workflow/${name}`, express.json(), function(req: express.Request, res: express.Response) {
    const workflowId = v4();
    const opts = {
      taskQueue,
      workflowId,
      args: [req.body]
    };
    client.start(fn, opts).then(() => res.json({ workflowId }));
  });
}

function createSignalEndpoint(router: express.Router, client: WorkflowClient, signal: SignalDefinition<any[]>) {
  router.put(`/signal/${signal.name}/:id`, express.json(), function(req: express.Request, res: express.Response) {
    let data = req.body;

    let fn: Function | undefined = signalValidators.get(signal);
    if (fn != null) {
      data = fn(data);
    }
    
    const handle = client.getHandle(req.params.id);
    handle.signal(signal, req.body).
      then(() => res.json({ received: true })).
      catch(err => res.status(500).json({ message: err.message }));
  });
}

function createQueryEndpoint(router: express.Router, client: WorkflowClient, query: QueryDefinition<any, any[]>) {
  router.get(`/query/${query.name}/:id`, function(req, res) {
    const handle = client.getHandle(req.params.id);

    handle.query(query, req.query).
      then(result => res.json({ result })).
      catch(err => res.status(500).json({ message: err.message }));
  });
}