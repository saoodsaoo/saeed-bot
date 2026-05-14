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

import { Low, JSONFile } from "lowdb"
import { makeWASocket as MakeSocket, protoType, serialize } from "./lib/simple.js"
import store from "./lib/store.js"

const { PhoneNumberUtil } = pkg
const phoneUtil = PhoneNumberUtil.getInstance()
const { chain } = lodash

let lastRequestTime = {}
const MIN_DELAY = 3000

async function waitForRateLimit(key = 'default') {
    return new Promise((resolve) => {
        const now = Date.now()
        const last = lastRequestTime[key] || 0
        const elapsed = now - last
        if (elapsed < MIN_DELAY) {
            setTimeout(resolve, MIN_DELAY - elapsed)
        } else {
            resolve()
        }
        lastRequestTime[key] = Date.now()
    })
}

function clearTmp() {
    const tmpDir = join(__dirname, 'tmp')
    if (!existsSync(tmpDir)) return
    readdirSync(tmpDir).forEach(file => {
        try { unlinkSync(join(tmpDir, file)) } catch {}
    })
}

function purgeSessionFiles() {
    try {
        if (!existsSync(sessionDir)) return
        const files = readdirSync(sessionDir)
        let deleted = 0
        for (const f of files) {
            if (f !== 'creds.json' && (f.startsWith('pre-key-') || f.startsWith('sender-key-') || f === 'app-state-sync-key')) {
                try { unlinkSync(join(sessionDir, f)); deleted++ } catch {}
            }
        }
        if (deleted > 0) console.log(cheonGray(`  🧹 Session: ${deleted} ملف تم حذفه`))
    } catch (err) {
        console.log(cheonRed(`  ❌ خطأ في تنظيف الجلسة: ${err.message}`))
    }
}

function purgeOldFiles() {
    try {
        if (!existsSync(sessionDir)) return
        const files = readdirSync(sessionDir)
        let deleted = 0
        for (const f of files) {
            if (f !== 'creds.json') {
                try { unlinkSync(join(sessionDir, f)); deleted++ } catch {}
            }
        }
        if (deleted > 0) console.log(cheonGray(`  🧹 تنظيف عميق: ${deleted} ملف محذوف`))
    } catch (err) {
        console.log(cheonRed(`  ❌ خطأ في التنظيف العميق: ${err.message}`))
    }
}

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== "win32") {
    return rmPrefix ? (/file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL) : pathToFileURL(pathURL).toString()
}
global.__dirname = function dirname(pathURL) {
    return path.dirname(global.__filename(pathURL, true))
}
global.__require = function require(dir = import.meta.url) {
    return createRequire(dir)
}

global.timestamp = { start: new Date() }
const __dirname = global.__dirname(import.meta.url)
global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())
global.prefix = new RegExp("^[#!./-]")

const cheonBlue    = chalk.hex("#5B8DEF")
const cheonPurple  = chalk.hex("#9B59B6")
const cheonCyan    = chalk.hex("#00BCD4")
const cheonRed     = chalk.hex("#E74C3C")
const cheonGold    = chalk.hex("#F1C40F")
const cheonGray    = chalk.hex("#7F8C8D")
const cheonGreen   = chalk.hex("#2ECC71")

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

async function showCheonBanner() {
    console.clear()
    console.log(cheonPurple("".repeat(60)))
    cfonts.say("SAEED-BOT", { font: "block", align: "center", gradient: ["#5B8DEF", "#9B59B6"] })
    cfonts.say("The King Of Bots", { font: "console", align: "center", colors: ["#00BCD4"] })
    console.log(cheonPurple("『 𝐒𝐀𝐄𝐄𝐃 𝐁𝐎𝐓 - 𝐓𝐇𝐄 𝐊𝐈𝐍𝐆 』"))
    console.log(cheonPurple("".repeat(60)))
}

await showCheonBanner()
protoType()
serialize()

const sessionDir = `./${global.sessions || "sessions"}`
const credsPath = `${sessionDir}/creds.json`

function nukeSessionFolder() {
    // تم تعطيله لضمان حماية ملف creds.json الخاص بك من الحذف
    return 
}

if (existsSync(credsPath)) {
    try {
        const tempCreds = JSON.parse(fs.readFileSync(credsPath, "utf-8"))
        // تم تعطيل الحذف التلقائي هنا أيضاً لضمان استقرار الجلسة المرفوعة
    } catch { }
}

global.db = new Low(new JSONFile("database.json"))
global.db.read()
global.db.data = {
    users: {},
    chats: {},
    stats: {},
    settings: {},
    ...(global.db.data || {}),
}

global.loadDatabase = async function() {
    if (global.db.data) return
    await global.db.read()
    global.db.data = {
        users: {},
        chats: {},
        stats: {},
        settings: {},
        ...(global.db.data || {}),
    }
}

setInterval(async () => {
    if (global.db.data) await global.db.write()
}, 60 * 1000)

const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
const msgRetryCounterCache = new NodeCache({ stdTTL: 300 })
const userDevicesCache = new NodeCache({ stdTTL: 300 })
const { version } = await fetchLatestBaileysVersion()

let phoneNumber = "" 
const methodCodeQR = process.argv.includes("qr")
const MethodMobile = process.argv.includes("mobile")
const methodCode = false // جعلناه false ليعمل مباشرة من ملف creds.json
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((resolve) => rl.question(text, resolve))

let opcion
if (methodCodeQR) opcion = "1"

if (!methodCodeQR && !methodCode && !existsSync(credsPath)) {
    do {
        opcion = await question(
            cheonPurple("🪻 اختر طريقة الاتصال:\n") +
            cheonBlue("1. QR Code\n") +
            cheonCyan("2. Pairing Code\n") +
            "--> "
        )
        if (!/^[1-2]$/.test(opcion)) console.log(cheonRed("❌ اختر 1 أو 2 بس"))
    } while (opcion !== "1" && opcion !== "2")
}

console.info = () => {}

const connectionOptions = {
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: opcion == "1" || methodCodeQR,
    mobile: MethodMobile,
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

global.sendFromChannel = async function(jid, content, channelId = global.ch.main) {
    try {
        const msgContent = typeof content === 'string' ? { text: content } : content
        const withContext = {
            ...msgContent,
            contextInfo: {
                ...(msgContent.contextInfo || {}),
                forwardingScore: 1,
                isForwarded: false,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: channelId,
                    newsletterName: global.botName,
                    serverMessageId: -1,
                }
            }
        }
        return await global.conn.sendMessage(jid, withContext)
    } catch (e) {
        return await global.conn.sendMessage(jid, typeof content === 'string' ? { text: content } : content)
    }
}

let pairingCodeShown = false

if (!existsSync(credsPath) && (opcion === "2" || methodCode)) {
    opcion = "2"
    if (!conn.authState.creds.registered) {
        let addNumber
        if (phoneNumber) {
            addNumber = phoneNumber.replace(/[^0-9]/g, "")
            rl.close()
        } else {
            do {
                phoneNumber = await question(cheonCyan("\n  🪻 أدخل رقم الواتساب:\n--> "))
                phoneNumber = phoneNumber.replace(/\D/g, "")
                if (!phoneNumber.startsWith("+")) phoneNumber = `+${phoneNumber}`
            } while (!await isValidPhoneNumber(phoneNumber))
            addNumber = phoneNumber.replace(/\D/g, "")
            rl.close()
        }

        global._pairingNumber = addNumber
        const _pairingHandler = async (update) => {
            if (pairingCodeShown) return
            if (update.connection !== "connecting" && update.connection !== "open" && update.qr == null) return
            conn.ev.off("connection.update", _pairingHandler)
            await sleep(3000)
            if (pairingCodeShown || conn.authState?.creds?.registered) return
            try {
                pairingCodeShown = true
                console.log(cheonGold("  📱 جاري طلب كود الربط..."))
                let codeBot = await conn.requestPairingCode(global._pairingNumber)
                codeBot = codeBot?.match(/.{1,4}/g)?.join("-") || codeBot
                console.log(cheonGold( `${codeBot}`))
                console.log(cheonPurple(`『 𝐒𝐀𝐄𝐄𝐃 𝐁𝐎𝐓 』`))
            } catch (e) {
                console.log(cheonRed(`  ❌ فشل طلب الكود: ${e.message}`))
                pairingCodeShown = false
            }
        }
        conn.ev.on("connection.update", _pairingHandler)
    }
}

conn.isInit = false
let isInit = true
let handler = await import("./handler.js")

global.reloadHandler = async function (restatConn) {
    try {
        const Handler = await import(`./handler.js?update=${Date.now()}`)
        if (Object.keys(Handler || {}).length) handler = Handler
    } catch (e) { console.error(e) }

    if (restatConn) {
        const oldChats = global.conn.chats || {}
        try { global.conn.ws.close() } catch {}
        conn.ev.removeAllListeners()
        global.conn = MakeSocket(connectionOptions, { chats: oldChats })
        isInit = true
    }

    if (!isInit) {
        conn.ev.off("messages.upsert", conn.handler)
        conn.ev.off("connection.update", conn.connectionUpdate)
        conn.ev.off("creds.update", conn.credsUpdate)
    }

    conn.handler = handler.handler.bind(global.conn)
    conn.connectionUpdate = connectionUpdate.bind(global.conn)
    conn.credsUpdate = saveCreds.bind(global.conn, true)

    conn.ev.on("messages.upsert", conn.handler)
    conn.ev.on("connection.update", conn.connectionUpdate)
    conn.ev.on("creds.update", conn.credsUpdate)
    isInit = false
    return true
}

let pairingAttempts = 0

async function joinChannels(sock) {
    // تم تعطيل الانضمام التلقائي للقنوات لخصوصيتك
    return 
}

async function connectionUpdate(update) {
    const { connection, lastDisconnect, isNewLogin } = update
    global.stopped = connection
    if (isNewLogin) conn.isInit = true
    const isPairing = !conn.authState?.creds?.registered
    const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode

    if (code === 429) {
        console.log(cheonGold(`  ⚠️  تأخير (429)، انتظر...`))
        await sleep(10000)
        await global.reloadHandler(true)
        return
    }

    if (code && code !== DisconnectReason.loggedOut && conn?.ws?.socket == null && !isPairing) {
        await global.reloadHandler(true)
    }

    if (connection === "open") {
        pairingAttempts = 0
        pairingCodeShown = false
        console.log(cheonGreen("\n  ✅ 𝐒𝐀𝐄𝐄𝐃 𝐁𝐎𝐓 متصل الآن بنجاح! 🪻\n"))
    }

    if (connection === "close") {
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
        if (isPairing) {
            pairingAttempts++
            if (pairingAttempts > 30) process.exit(1)
            await sleep(10000)
            await global.reloadHandler(true)
            return
        }
        if (reason === DisconnectReason.restartRequired || reason === DisconnectReason.connectionLost) {
            await global.reloadHandler(true)
        } else if (reason === DisconnectReason.loggedOut) {
            console.log(cheonRed(`  💀 تم تسجيل الخروج`))
        } else {
            await global.reloadHandler(true)
        }
    }
}

const pluginFolder = global.__dirname(join(__dirname, "./plugins/index"))
const pluginFilter = (filename) => /\.js$/.test(filename)
global.plugins = {}

async function filesInit() {
    const files = readdirSync(pluginFolder).filter(pluginFilter)
    await Promise.allSettled(files.map(async (filename) => {
        try {
            const file = global.__filename(join(pluginFolder, filename))
            const module = await import(file)
            global.plugins[filename] = module.default || module
        } catch (e) {
            delete global.plugins[filename]
        }
    }))
}

await filesInit()

const reloadDebounce = {}
global.reload = async (_ev, filename) => {
    if (!pluginFilter(filename)) return
    if (reloadDebounce[filename]) clearTimeout(reloadDebounce[filename])
    reloadDebounce[filename] = setTimeout(async () => {
        delete reloadDebounce[filename]
        const dir = global.__filename(join(pluginFolder, filename), true)
        if (filename in global.plugins && !existsSync(dir)) {
            delete global.plugins[filename]
            return
        }
        try {
            const module = await import(`${global.__filename(dir)}?update=${Date.now()}`)
            global.plugins[filename] = module.default || module
        } catch (e) {}
    }, 500)
}

watch(pluginFolder, global.reload)
await global.reloadHandler()

async function _quickTest() {
    const test = await Promise.all([
        spawn("ffmpeg"), spawn("ffprobe"),
        spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-filter_complex", "color", "-frames:v", "1", "-f", "webp", "-"]),
        spawn("convert"), spawn("magick"), spawn("gm"), spawn("find", ["--version"]),
    ].map((p) => Promise.race([
        new Promise((r) => p.on("close", (c) => r(c !== 127))),
        new Promise((r) => p.on("error", () => r(false))),
    ])))
    const [ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find] = test
    global.support = Object.freeze({ ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find })
}
_quickTest()

const tmpDir = join(__dirname, "tmp")
if (!existsSync(tmpDir)) fs.mkdirSync(tmpDir)

setInterval(async () => {
    if (global.stopped === 'close' || !conn?.user) return
    clearTmp()
}, 1000 * 60 * 4)

setInterval(async () => {
    if (global.stopped === 'close' || !conn?.user) return
    purgeSessionFiles()
}, 1000 * 60 * 10)

global._lastMsgTime = Date.now()
conn.ev.on("messages.upsert", () => { global._lastMsgTime = Date.now() })

async function isValidPhoneNumber(number) {
    try {
        number = number.replace(/\s+/g, "")
        return phoneUtil.isValidNumber(phoneUtil.parseAndKeepRawInput(number))
    } catch { return false }
}

process.on("uncaughtException", (err) => console.error(cheonRed("  ⚠️  " + err.message)))
process.on("unhandledRejection", (reason) => console.error(cheonRed("  ⚠️  " + reason)))
