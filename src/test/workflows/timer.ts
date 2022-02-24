import { defineSignal, defineQuery, setHandler, condition } from '@temporalio/workflow';

exports.setDeadlineSignal = defineSignal('setDeadline');
exports.timeLeftQuery = defineQuery('timeLeft');

exports.countdownWorkflow = async function countdownWorkflow({ delay }: { delay: number }) {
  delay = delay == null ? 1500 : delay;
  let deadline = Date.now() + delay;
  
  setHandler(exports.setDeadlineSignal, (data) => {
    // send in new deadlines via Signal
    deadline = data.deadline;
  });
  setHandler(exports.timeLeftQuery, (data) => {
    if (data.seconds) {
      return Math.floor((deadline - Date.now()) / 1000);
    }
    return deadline - Date.now();
  });
  
  await condition(() => (deadline - Date.now()) < 0);
}