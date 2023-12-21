const db = require("../database/db.js")
const { checkConfirmation, analyze, analyzeForWithdraw, withdrawARC} = require("./btcHandler.js")


async function thread(app) {
  while (1) {
    await sleep(60000)
    updateConfirming(app)
    updateConfirmingForWithdraw(app)
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const updateConfirming = async (app) => {
  const pendingTransactions = await db.selectPendingTransactions()
  for (let index = 0; index < pendingTransactions?.length; index++) {
    const pendingTx = pendingTransactions[index]
    if (pendingTx.status == "pending") {
      const checkedResult = await analyze(pendingTx.transaction_id, pendingTx.deposit_address)
      const receivedAmt = checkedResult.body.data
      if (checkedResult.status == 201) {
        // TODO: update which ever amount to pending_balance
        // TODO: if the time between the latest update and now is > 3 hours. Mark everything as "blocked"
        await db.updateBtcAnalyzingTransaction(pendingTx.transaction_id, receivedAmt, "pending")
        await db.updatePendingBalance(pendingTx.user_id, { balance: receivedAmt, transactionId: pendingTx.transaction_id, availableBalance: receivedAmt})

        // TODO: Add conditional to check if we have processed this balance before
        let balance = await db.selectBalance(pendingTx.user_id)
        newBalance = JSON.stringify({balance: {
          userId: pendingTx.user_id,
          balance
        }})
        app.broadcast(newBalance);
      }
      else if (checkedResult.status == 200) {
        // TODO: update which ever amount to pending_balance
        // TODO: if the time between the lates update and now is > 3 hours. Mark everything as "blocked"
        await db.updateBtcAnalyzingTransaction(pendingTx.transaction_id, receivedAmt, "confirmed")
        await db.updateBalance(pendingTx.user_id, pendingTx.transaction_id)
      } else {
        if (checkedResult.body.data != "Sending bitcoin error") {
          await db.updateAnalyzingTransactionInvalid(pendingTx.transaction_id)
        } else {
          // TODO: update which ever amount in pending_balance to 0
          // TODO: update all pending XP to 0
          // TODO: Update all pending achievements to 0
          // If the account has more than three invalid txs, block it. 
        }
      }
    }
  }
}

const updateConfirmingForWithdraw = async (app) => {
  const pendingTransactions = await db.selectPendingTransactionsForWithdraws()
  for (let index = 0; index < pendingTransactions?.length; index++) {
    const pendingTx = pendingTransactions[index]
    if (pendingTx.status == "pending") {
      const checkedResult = await analyzeForWithdraw(pendingTx.transaction_id, pendingTx.deposit_address)
      const correctDeposit = checkedResult.body.data
      if (checkedResult.status == 201) {
        // TODO: update which ever amount to pending_balance
        // TODO: if the time between the latest update and now is > 3 hours. Mark everything as "blocked"
        await db.updateBtcAnalyzingTransactionForWithdraw(pendingTx.transaction_id, "pending", pendingTx.amount)
      }
      else if (checkedResult.status == 200) {
        // TODO: update which ever amount to pending_balance
        // TODO: if the time between the lates update and now is > 3 hours. Mark everything as "blocked"
        let bSend = await db.updateBtcAnalyzingTransactionForWithdraw(pendingTx.transaction_id, "confirmed", pendingTx.amount)
        if(bSend){
          let sentTxId = await withdrawARC(pendingTx.withdraw_address, pendingTx.amount);
          if(sentTxId==""){
            await db.updateAnalyzingTransactionInvalidForWithdraws(pendingTx.transaction_id)
          } else {
            await db.updateBtcAnalyzingTransactionForWithdraw(pendingTx.transaction_id, "done", pendingTx.amount, sentTxId)
          }
        }
      } else {
        if (checkedResult.body.data != "Sending bitcoin error") {
          await db.updateAnalyzingTransactionInvalidForWithdraws(pendingTx.transaction_id)
        } else {
          // TODO: update which ever amount in pending_balance to 0
          // TODO: update all pending XP to 0
          // TODO: Update all pending achievements to 0
          // If the account has more than three invalid txs, block it. 
        }
      }
    }
  }
}

module.exports = {
  thread,
  updateConfirming,
  updateConfirmingForWithdraw
}
