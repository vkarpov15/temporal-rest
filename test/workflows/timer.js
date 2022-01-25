'use strict';

const { defineSignal, defineQuery, setHandler, condition } = require('@temporalio/workflow');

exports.setDeadlineSignal = defineSignal('setDeadline');
exports.timeLeftQuery = defineQuery('timeLeft');

exports.countdownWorkflow = async function countdownWorkflow() {
  let deadline = Date.now() + 1500;
  
  setHandler(exports.setDeadlineSignal, (data) => {
    // send in new deadlines via Signal
    deadline = data.deadline;
  });
  setHandler(exports.timeLeftQuery, () => deadline - Date.now());
  
  await condition(() => (deadline - Date.now()) < 0);
}