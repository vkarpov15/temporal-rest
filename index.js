'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');

module.exports = function createExpressMiddleware(workflows, client, taskQueue) {
  const router = express.Router();
  
  for (const [key, value] of Object.entries(workflows)) {
    if (typeof value === 'function') {
      // Workflow
      createWorkflowEndpoint(router, client, key, value, taskQueue);
    } else if (typeof value === 'object' && value != null) {
      if (value.type === 'signal') {
        // Signal
        createSignalEndpoint(router, client, value);
      } else if (value.type === 'query') {
        // Query
        createQueryEndpoint(router, client, value);
      }
    }
  }

  return router;
}

function createWorkflowEndpoint(router, client, name, fn, taskQueue) {
  router.post(`/workflow/${name}`, function(req, res) {
    const workflowId = uuidv4();
    const opts = {
      taskQueue,
      workflowId
    };
    client.start(fn, opts).then(() => res.json({ workflowId }));
  });
}

function createSignalEndpoint(router, client, signal) {
  router.put(`/signal/${signal.name}/:id`, function(req, res) {
    const handle = client.getHandle(req.params.id);
    handle.signal(signal).
      then(() => res.json({ ok: 1 })).
      catch(err => res.status(500).json({ message: err.message }));
  });
}

function createQueryEndpoint(router, client, query) {
  router.get(`/query/${query.name}/:id`, function(req, res) {
    const handle = client.getHandle(req.params.id);

    handle.query(query).
      then(result => res.json({ result })).
      catch(err => res.status(500).json({ message: err.message }));
  });
}