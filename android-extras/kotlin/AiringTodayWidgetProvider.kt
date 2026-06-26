package com.otakudeck.app

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
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
            } else {
                views.setTextViewText(R.id.widget_line_1, formatLine(snapshot, 0))
                views.setTextViewText(R.id.widget_line_2, formatLine(snapshot, 1))
                views.setTextViewText(R.id.widget_line_3, formatLine(snapshot, 2))
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

    private fun formatLine(snapshot: Snapshot, index: Int): String {
        if (index >= snapshot.entries.length()) return ""
        val item = snapshot.entries.getJSONObject(index)
        val title = item.optString("title", "")
        val time = item.optString("time", "")
        val episode = item.optInt("episode", 0)
        val epLabel = if (episode > 0) " · Ep.$episode" else ""
        val timeLabel = if (time.isNotBlank()) "$time · " else ""
        return "$timeLabel$title$epLabel"
    }
}
