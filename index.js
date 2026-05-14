process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1'
process.env.UV_THREADPOOL_SIZE = 8

import "./config.js"
import cfonts from "cfonts"
import chalk from "chalk"
import path, { join } from "path"
import fs, { readdirSync, unlinkSync, rmSync, existsSync, watch, mkdirSync } from "fs"
import yargs from "yargs"
import { spawn } from "child_process"
import syntaxerror from "syntax-error"
import { fileURLToPath } from "url"
import { createRequire } from "module"
import { platform } from "process"
import { format } from "util"
import pkg from "google-libphonenumber"
import pino from "pino"
import Pino from "pino"
import readline from "readline"
import NodeCache from "node-cache"
import { Boom } from "@hapi/boom"
import lodash from "lodash"

import {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidNormalizedUser,
} from "@whiskeysockets/baileys"

import { Low } from "lowdb"
    import { JSONFile } from "lowdb/node"
import { makeWASocket as MakeSocket, protoType, serialize } from "./lib/simple.js"
import store from "./lib/store.js"

const { PhoneNumberUtil } = pkg
const phoneUtil = PhoneNumberUtil.getInstance()
const { chain } = lodash

const sessionDir = `./${global.sessions || "sessions"}`
const credsPath = `${sessionDir}/creds.json`

// --- ألوان CHEON BOT ---
const cheonBlue    = chalk.hex("#5B8DEF")
const cheonPurple  = chalk.hex("#9B59B6")
const cheonCyan    = chalk.hex("#00BCD4")
const cheonRed     = chalk.hex("#E74C3C")
const cheonGold    = chalk.hex("#F1C40F")
const cheonGray    = chalk.hex("#7F8C8D")
const cheonGreen   = chalk.hex("#2ECC71")

// --- دوال المساعدة ---
global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== "win32") {
    return rmPrefix ? (/file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL) : pathURL
}
global.__dirname = function dirname(pathURL) {
    return path.dirname(global.__filename(pathURL, true))
}
const __dirname = global.__dirname(import.meta.url)

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

async function showCheonBanner() {
    console.clear()
    console.log(cheonPurple("『 𝐂𝐇𝐄𝐎𝐍 𝐁𝐎𝐓 』"))
    console.log(cheonCyan("  جاري محاولة الاتصال باستخدام ملف creds.json..."))
}

// --- فحص وجود الجلسة قبل البدء ---
if (!existsSync(credsPath)) {
    console.log(cheonRed("\n❌ خطأ: ملف creds.json غير موجود!"))
    console.log(cheonGold(`📌 يرجى التأكد من وضع الملف في المسار: ${credsPath}\n`))
    process.exit(1)
}

await showCheonBanner()
protoType()
serialize()

// --- قاعدة البيانات ---
global.db = new Low(new JSONFile("database.json"))
await global.db.read()
global.db.data = { users: {}, chats: {}, stats: {}, settings: {}, ...(global.db.data || {}) }

setInterval(async () => { if (global.db.data) await global.db.write() }, 60 * 1000)

// --- إعدادات الاتصال ---
const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
const { version } = await fetchLatestBaileysVersion()
const msgRetryCounterCache = new NodeCache({ stdTTL: 300 })
const userDevicesCache = new NodeCache({ stdTTL: 300 })

const connectionOptions = {
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false, // تم الإيقاف لأننا نستخدم ملفاً
    browser: ["Ubuntu", "Chrome", "120.0.0"],
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: "fatal" }).child({ level: "fatal" })),
    },
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    defaultQueryTimeoutMs: 5000,
    keepAliveIntervalMs: 30000,
    requestTimeoutMs: 10000,
    maxCachedMessages: 150,
    getMessage: async (key) => {
        try {
            const jid = jidNormalizedUser(key.remoteJid)
            const msg = await store.loadMessage(jid, key.id)
            return msg?.message || ""
        } catch { return "" }
    },
    msgRetryCounterCache,
    userDevicesCache,
}

global.conn = MakeSocket(connectionOptions)
conn.ev.on("creds.update", saveCreds)

// --- معالجة الاتصال ---
async function connectionUpdate(update) {
    const { connection, lastDisconnect } = update
    if (connection === "open") {
        console.log(cheonGreen("\n✅ تم الاتصال بنجاح باستخدام ملف الجلسة!"))
    }
    if (connection === "close") {
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
        console.log(cheonRed(`  🔄 انقطع الاتصال، السبب: ${reason}. جاري إعادة المحاولة...`))
        if (reason !== DisconnectReason.loggedOut) await global.reloadHandler(true)
        else {
            console.log(cheonRed("  💀 الجلسة انتهت (Logged Out). يرجى تحديث ملف creds.json"))
            process.exit(1)
        }
    }
}

// --- نظام البلوجينات ---
let isInit = true
let handler = await import("./handler.js")
global.reloadHandler = async function (restatConn) {
    try {
        const Handler = await import(`./handler.js?update=${Date.now()}`)
        if (Object.keys(Handler || {}).length) handler = Handler
    } catch (e) { console.error(e) }
    if (restatConn) {
        try { global.conn.ws.close() } catch {}
        conn.ev.removeAllListeners()
        global.conn = MakeSocket(connectionOptions)
    }
    conn.handler = handler.handler.bind(global.conn)
    conn.connectionUpdate = connectionUpdate.bind(global.conn)
    conn.credsUpdate = saveCreds.bind(global.conn, true)
    conn.ev.on("messages.upsert", conn.handler)
    conn.ev.on("connection.update", conn.connectionUpdate)
    conn.ev.on("creds.update", conn.credsUpdate)
    return true
}

await global.reloadHandler()

// --- تنظيف الملفات المؤقتة ---
setInterval(() => {
    const tmpDir = join(__dirname, "tmp")
    if (existsSync(tmpDir)) {
        readdirSync(tmpDir).forEach(file => { try { unlinkSync(join(tmpDir, file)) } catch {} })
    }
}, 1000 * 60 * 10)

console.log(cheonBlue("\n  🪻 تم تشغيل محرك CHEON BOT بنجاح..."))
