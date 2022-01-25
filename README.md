# temporal-rest

Creates an [Express](http://expressjs.com/) middleware router that automatically exposes endpoints for [Temporal](https://temporal.io/) Workflows, Signals, and Queries.

## Usage

Suppose you have some Temporal Workflows, Queries, and Signals in a `workflows.js` file:

```javascript
'use strict';

const wf = require('@temporalio/workflow');

exports.unblockSignal = wf.defineSignal('unblock');
exports.isBlockedQuery = wf.defineQuery('isBlocked');

exports.unblockOrCancel = async function unblockOrCancel() {
  let isBlocked = true;
  wf.setHandler(exports.unblockSignal, () => void (isBlocked = false));
  wf.setHandler(exports.isBlockedQuery, () => isBlocked);
  console.log('Blocked');
  try {
    await wf.condition(() => !isBlocked);
    console.log('Unblocked');
  } catch (err) {
    if (err instanceof wf.CancelledFailure) {
      console.log('Cancelled');
    }
    throw err;
  }
}
```

Temporal-rest exports a function that returns an Express router with an endpoint for every Workflow, Signal, and Query.

```javascript
const { WorkflowClient } = require('@temporalio/client');
const workflows = require('./workflows');

const createExpressMiddleware = require('temporal-rest');
const express = require('express');

const app = express();

// Router has the below endpoints:
// - POST /workflow/unblockOrCancel
// - PUT /signal/unblock
// - GET /query/is-blocked
const router = createExpressMiddleware(workflows, new WorkflowClient(), 'my-task-queue');
app.use(router);
```

Note that temporal-rest _only_ registers endpoints for exported Signals and Queries.
If you want to register an endpoint for a Signal or Query, make sure you export it from `workflows.ts` / `workflows.js`:

```ts
// Temporal-rest will create a `PUT /signal/unblock/:id` endpoint
exports.unblockSignal = wf.defineSignal('unblock');

// Temporal-rest will NOT create a `PUT /signal/otherSignal/:id` endpoint,
// because this Signal isn't exported.
const otherSignal = wf.defineSignal('otherSignal');
```

## Running Tests

1. Make sure [Temporal server is running](https://github.com/temporalio/docker-compose)
2. Run `npm install`
3. Run `npm test`