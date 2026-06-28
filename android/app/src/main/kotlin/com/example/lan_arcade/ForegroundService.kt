package com.example.lan_arcade

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager

class ForegroundService : Service() {
    companion object {
        @JvmStatic var isServiceRunning = false
        @JvmStatic var isWakeLockHeld = false
        @JvmStatic var isWifiLockHeld = false
        @JvmStatic var isMulticastLockHeld = false
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var multicastLock: WifiManager.MulticastLock? = null

    private val CHANNEL_ID = "lan_arcade_service_channel"
    private val NOTIFICATION_ID = 101

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = createNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        // Acquire CPU WakeLock if not already held
        if (wakeLock == null) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "LanArcade::ServerWakeLock").apply {
                acquire()
            }
        }

        // Acquire WifiLock if not already held
        val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        if (wifiLock == null) {
            wifiLock = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "LanArcade::ServerWifiLock")
            } else {
                @Suppress("DEPRECATION")
                wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL, "LanArcade::ServerWifiLock")
            }.apply {
                acquire()
            }
        }

        // Acquire MulticastLock if not already held to ensure mDNS requests are received in background
        if (multicastLock == null) {
            multicastLock = wifiManager.createMulticastLock("LanArcade::MulticastLock").apply {
                setReferenceCounted(false)
                acquire()
            }
        }

        isServiceRunning = true
        isWakeLockHeld = wakeLock?.isHeld == true
        isWifiLockHeld = wifiLock?.isHeld == true
        isMulticastLockHeld = multicastLock?.isHeld == true

        return START_NOT_STICKY
    }

    override fun onDestroy() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }

        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (e: Exception) {}
        try {
            if (wifiLock?.isHeld == true) {
                wifiLock?.release()
            }
        } catch (e: Exception) {}
        try {
            if (multicastLock?.isHeld == true) {
                multicastLock?.release()
            }
        } catch (e: Exception) {}

        isServiceRunning = false
        isWakeLockHeld = false
        isWifiLockHeld = false
        isMulticastLockHeld = false

        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
        super.onTaskRemoved(rootIntent)
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "LAN Arcade Server Service Channel",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    private fun createNotification(): Notification {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("LAN Arcade Host Server")
                .setContentText("The arcade server is running active rooms.")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("LAN Arcade Host Server")
                .setContentText("The arcade server is running active rooms.")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .build()
        }
    }
}
