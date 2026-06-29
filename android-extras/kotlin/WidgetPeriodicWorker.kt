package com.otakudeck.app

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

class WidgetPeriodicWorker(
    context: Context,
    params: WorkerParameters,
) : Worker(context, params) {
    override fun doWork(): Result {
        WidgetRefresh.updateAll(applicationContext)
        return Result.success()
    }
}
