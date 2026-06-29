package com.otakudeck.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class AiringTodayWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        val snapshot = readSnapshot(context)
        for (widgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_airing_today)
            views.setTextViewText(R.id.widget_title, context.getString(R.string.widget_airing_title))

            if (snapshot == null || snapshot.entries.length() == 0) {
                views.setTextViewText(R.id.widget_line_1, context.getString(R.string.widget_airing_empty))
                views.setTextViewText(R.id.widget_line_2, "")
                views.setTextViewText(R.id.widget_line_3, "")
                clearLineClick(views, R.id.widget_line_1)
                clearLineClick(views, R.id.widget_line_2)
                clearLineClick(views, R.id.widget_line_3)
            } else {
                bindLine(context, views, snapshot, 0, R.id.widget_line_1)
                bindLine(context, views, snapshot, 1, R.id.widget_line_2)
                bindLine(context, views, snapshot, 2, R.id.widget_line_3)
            }

            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }

    private data class Snapshot(val entries: JSONArray)

    private fun readSnapshot(context: Context): Snapshot? {
        return try {
            val file = File(context.filesDir, "widget_airing.json")
            if (!file.exists()) return null
            val raw = file.readText()
            val root = JSONObject(raw)
            Snapshot(root.optJSONArray("entries") ?: JSONArray())
        } catch (_: Exception) {
            null
        }
    }

    private fun bindLine(
        context: Context,
        views: RemoteViews,
        snapshot: Snapshot,
        index: Int,
        viewId: Int,
    ) {
        if (index >= snapshot.entries.length()) {
            views.setTextViewText(viewId, "")
            clearLineClick(views, viewId)
            return
        }

        val item = snapshot.entries.getJSONObject(index)
        views.setTextViewText(viewId, formatLine(item))

        val animeId = item.optLong("anime_id", 0L)
        if (animeId <= 0L) {
            clearLineClick(views, viewId)
            return
        }

        val intent = Intent(
            Intent.ACTION_VIEW,
            Uri.parse("otakudeck://anime/$animeId"),
        ).apply {
            setPackage(context.packageName)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val pending = PendingIntent.getActivity(
            context,
            (animeId * 10 + index).toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        views.setOnClickPendingIntent(viewId, pending)
    }

    private fun clearLineClick(views: RemoteViews, viewId: Int) {
        views.setOnClickPendingIntent(viewId, null)
    }

    private fun formatLine(item: JSONObject): String {
        val title = item.optString("title", "")
        val time = item.optString("time", "")
        val episode = item.optInt("episode", 0)
        val epLabel = if (episode > 0) " · Ep.$episode" else ""
        val timeLabel = if (time.isNotBlank()) "$time · " else ""
        return "$timeLabel$title$epLabel"
    }
}
