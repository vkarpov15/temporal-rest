import * as wf from '@temporalio/workflow';

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