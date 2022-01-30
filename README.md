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

```javascript
// Temporal-rest will create a `PUT /signal/unblock/:workflowId` endpoint
exports.unblockSignal = wf.defineSignal('unblock');

// Temporal-rest will NOT create a `PUT /signal/otherSignal/:workflowId` endpoint,
// because this Signal isn't exported.
const otherSignal = wf.defineSignal('otherSignal');
```

## Passing Arguments

For Signals and Workflows, temporal-rest passes the HTTP request body as the first parameter to the Signal or Workflow.
For example, suppose you have the below `workflows.js` file.

```javascript
'use strict';

const { defineSignal, defineQuery, setHandler, condition } = require('@temporalio/workflow');

exports.setDeadlineSignal = defineSignal('setDeadline');
exports.timeLeftQuery = defineQuery('timeLeft');

exports.countdownWorkflow = async function countdownWorkflow({ delay }) {
  delay = delay == null ? 1500 : delay;
  let deadline = Date.now() + delay;
  
  setHandler(exports.setDeadlineSignal, (data) => {
    // send in new deadlines via Signal
    deadline = data.deadline;
  });
  setHandler(exports.timeLeftQuery, (data) => {
    if (data.seconds === 'true') {
      return Math.floor((deadline - Date.now()) / 1000);
    }
    return deadline - Date.now();
  });
  
  await condition(() => (deadline - Date.now()) < 0);
}
```

To pass a `delay` argument to `countdownWorkflow()`, you should send a `POST /workflow/countdownWorkflow` request with `{"delay": 3000}` as the request body.
Temporal-rest currently assumes the request body is JSON, and passes the parsed request body as the first argument to the Workflow.
For example, you can use the below CURL command.

```
curl -X POST http://localhost:3000/workflow/countdownWorkflow -d '{"delay": 3000}'
```

Similarly, you can pass arguments to Signals.
The below CURL command sets `deadline` to 3000 in `setDeadlineSignal`:

```
curl -X PUT http://localhost:3000/signal/setDeadline -d '{"deadline": 3000}'
```

For Queries, temporal-rest passes `req.query` as the first argument.
For example, the below CURL command calls `timeLeftQuery({ seconds: 'true' })`:

```
curl http://localhost:3000/query/timeLeft?seconds=true
```

# For Development

## Running Tests

1. Make sure [Temporal server is running](https://github.com/temporalio/docker-compose)
2. Run `npm install`
3. Run `npm test`
