const config = {

    botName:    "𝐒𝐀𝐄𝐄𝐃-𝐁𝐎𝐓",
    botTag:     "@SAEED",
    botVersion: "2.0.0",
    botDev:     "𝐒𝐀𝐄𝐄𝐃",
    devNumber:  "967770179625",

    sessions:   "sessions",
    botNumber:  "", 


    owner: [
        "967770179625", 
    ],

    ownerLid: [],
    prems:    [],
    premsLid: [],

    prefix: /^[°•π÷×¶∆£¢€¥®™✓=|~!?#%^&.]/,

    
    ch: {
        main:    "120363402804601196@newsletter",
        second:  "120363377374711810@newsletter", 
    },

   
    

    theme: {
        border:    "🪻",
        icon:      "✦",
        separator: "~*『✦▬▬▬✦┇• 🪻 •┇✦▬▬▬✦』*~",
        header:    (title) => `╔═══「 🪻 ${title} 🪻 」═══╗`,
        subHeader: (title) => `┌─「 ✦ ${title} 」`,
        tail:      `╚══════════════════════╝`,
        subTail:   `└──────────────────────`,
        footer:    `〔 𝐒𝐀𝐄𝐄𝐃-𝐁𝐎𝐓 〕`,
        row:       (key, val) => `│ ✦ ${key}: 〘${val}〙`,
        zarfLine:  `~*『✦▬▬▬✦┇• 🪻 •┇✦▬▬▬✦』*~`,
    },

    links: {
        channel: "https://whatsapp.com/channel/0029Vb6kG3s0AgW2lYD8ad1L",
        group:   "https://chat.whatsapp.com/KDO7e7XHcnG4lBdy1YYBAF",
        support: "https://chat.whatsapp.com/KDO7e7XHcnG4lBdy1YYBAF",
        github:  "https://github.com/Loydsumer/baileys-speed",
        dev:     "https://wa.me/967770179625",
    },

    images: {
        menu:       "https://i.ibb.co/3904kF0V/image.jpg",
        owner:      "https://i.ibb.co/3904kF0V/image.jpg",
        group:      "https://i.ibb.co/3904kF0V/image.jpg",
        economy:    "https://i.ibb.co/3904kF0V/image.jpg",
        games:      "https://i.ibb.co/3904kF0V/image.jpg",
        tools:      "https://i.ibb.co/3904kF0V/image.jpg",
        info:       "https://i.ibb.co/3904kF0V/image.jpg",
        downloader: "https://i.ibb.co/3904kF0V/image.jpg",
        ai:         "https://i.ibb.co/3904kF0V/image.jpg",
    },

    

    opts: {
        queque:    false,
        restrict:  false,
        noprint:   false,
        autoread:  true,
        autoReact: true,
    },
}


global.botName    = config.botName
global.botTag     = config.botTag
global.botVersion = config.botVersion
global.botDev     = config.botDev
global.devNumber  = config.devNumber
global.sessions   = config.sessions
global.botNumber  = config.botNumber
global.owner      = config.owner
global.ownerLid   = config.ownerLid
global.prems      = config.prems
global.premsLid   = config.premsLid
global.prefix     = config.prefix
global.ch         = config.ch
global.zarf       = config.zarf
global.theme      = config.theme
global.links      = config.links
global.images     = config.images
global.zarf_settings = config.zarf_settings

global.opts = { ...config.opts, ...(global.opts || {}) }

export default config
