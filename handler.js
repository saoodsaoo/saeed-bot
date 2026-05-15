                await conn.sendMessage(m.chat, { text: `🪻 *أنت محظور من استخدام البوت*\n📌 السبب: ${user?.bannedReason || 'غير محدد'}\n⚠️ تواصل مع **سعيد الذبحاني** للمراجعة` }, { quoted: m }).catch(() => {})
            }
            return
        }

        for (const name in global.plugins) {
            const plugin = global.plugins[name]
            if (!plugin || plugin.disabled) continue
            const __filename = join(___dirname, name)

            if (typeof plugin.all === "function") {
                try {
                    await plugin.all.call(this, m, {
                        chatUpdate, __dirname: ___dirname, __filename,
                        user, chat, settings,
                        isAdmin, isROwner, isBotAdmin, isOwner, isPrems,
                        participants, groupMetadata
                    })
                } catch (e) { console.error(e) }
            }

            if (!opts["restrict"])
                if (plugin.tags && plugin.tags.includes("admin")) continue

            const strRegex     = str => str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&")
            const pluginPrefix = plugin.customPrefix || conn.prefix || global.prefix || "!"

            let match
            try {
                match = (
                    pluginPrefix instanceof RegExp ? [[pluginPrefix.exec(m.text), pluginPrefix]] :
                    Array.isArray(pluginPrefix) ? pluginPrefix.map(p => { const r = p instanceof RegExp ? p : new RegExp(strRegex(p)); return [r.exec(m.text), r] }) :
                    typeof pluginPrefix === "string" ? [[new RegExp(strRegex(pluginPrefix)).exec(m.text), new RegExp(strRegex(pluginPrefix))]] :
                    [[[], new RegExp]]
                ).find(p => p[1])
            } catch { continue }

            export async function participantsUpdate({ id, participants, action }) {
    if (opts["self"]) return
    if (this.isInit) return
    if (global.db.data == null) await global.loadDatabase()

    const chat = global.db.data.chats[id] || {}
    if (!chat.welcome) return

    const groupMetadata = await safeRequest(() => this.groupMetadata(id), `groupMeta_${id}`).catch(() => null)
    if (!groupMetadata) return

    for (const user of participants) {
        let pp = "https://i.ibb.co/3904kF0V/image.jpg"
        try { pp = await this.profilePictureUrl(user, "image") } catch {}

        let text = ""
        if (action === "add") {
            text = (chat.sWelcome || `🪻 *أهلاً وسهلاً @user في المجموعة!*\n\n📌 منور في جروب: *${groupMetadata.subject}*\n💎 مطور البوت: **سعيد الذبحاني**`)
                .replace("@user", "@" + user.split("@")[0])
                .replace("@subject", groupMetadata.subject || "")
        } else if (action === "remove") {
            text = (chat.sBye || `👋 *@user ساب المجموعة.. الله معك*`)
                .replace("@user", "@" + user.split("@")[0])
        } else if (action === "promote") {
            text = `🛡️ *@${user.split("@")[0]} صار أدمن! تهانينا 🎉*`
        } else if (action === "demote") {
            text = `📉 *@${user.split("@")[0]} ما عاد أدمن*`
        }

        if (text) {
            await this.sendMessage(id, { text, mentions: [user] }).catch(() => {})
        }
    }
}

export async function callUpdate(callUpdate) {
    const settings = global.db.data?.settings?.[this.user?.jid] || {}
    if (!settings.antiCall) return
    for (const call of callUpdate) {
        if (!call.isGroup && call.status === "offer") {
            try {
                await this.rejectCall(call.id, call.from).catch(() => {})
                await this.sendMessage(call.from, {
                    text: `⚡ *𝐒𝐀𝐄𝐄𝐃-𝐁𝐎𝐓*\n\n❌ عذراً، المكالمات ممنوعة لتجنب الحظر.\n⚠️ تواصل مع المطور **سعيد الذبحاني** لو عندك استفسار.`
                }).catch(() => {})
            } catch (e) { console.error(e) }
        }
    }
}

let file = global.__filename(import.meta.url, true)
watchFile(file, async () => {
    unwatchFile(file)
    console.log(chalk.cyan("🪻 تم تحديث handler.js بواسطة سعيد الذبحاني"))
    if (global.reloadHandler) console.log(await global.reloadHandler())
})



