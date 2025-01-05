






































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const path = require("path");
const { existsSync, mkdirSync } = require("fs");
const fs = require("fs");
const pino = require("pino");
const config = require("./config");
const axios = require("axios");
const cheerio = require("cheerio");
const { File } = require("megajs");
const PREFIX = config.PREFIX;
const SESSION_DIR = "./sessions";
if (!existsSync(SESSION_DIR)) {
  mkdirSync(SESSION_DIR);
}
if (!fs.existsSync(__dirname + "/sessions/creds.json")) {
  if (!config.SESSION_ID)
    return console.log("Please add your session to SESSION_ID env !!");
  const sessdata = config.SESSION_ID;
  const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
  filer.download((err, data) => {
    if (err) throw err;
    fs.writeFile(__dirname + "/sessions/creds.json", data, () => {
      console.log("Session downloaded successfully ✅");
    });
  });
}
const express = require("express");
const app = express();
const port = process.env.PORT || 8000;
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const sock = makeWASocket({
    printQRInTerminal: false,
    auth: state,
    logger: pino({ level: "silent" }),
    maxFileSize: config.MAX_SIZE * 1024 * 1024,
  });
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      if (
        lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
      ) {
        connectToWhatsApp();
      }
    } else if (connection === "open") {
      console.log("Bot connecting... 🔄");
      console.log("Bot connected successfully ✅");
    }
  });
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;
    if (
      m.key &&
      m.key.remoteJid === "status@broadcast" &&
      config.AUTO_READ_STATUS === "on"
    ) {
      await sock.readMessages([m.key]);
    }
    let messageContent = "";
    if (m.message.conversation) {
      messageContent = m.message.conversation;
    } else if (m.message.extendedTextMessage) {
      messageContent = m.message.extendedTextMessage.text;
    } else if (m.message.imageMessage) {
      messageContent = m.message.imageMessage.caption || "";
    } else if (m.message.videoMessage) {
      messageContent = m.message.videoMessage.caption || "";
    }
    if (messageContent && messageContent.trim()) {
        const command = messageContent.slice(1).split(" ")[0].toLowerCase();
        const args = messageContent.trim().split(/ +/).slice(1);
        const q = args.join(" ");
        const jid = m.key.remoteJid;
        const isDev = jid === "94701814946@s.whatsapp.net";
        switch (command) {
          case "ai":
            try {
              const {
                GoogleGenerativeAI,
                HarmCategory,
                HarmBlockThreshold,
              } = require("@google/generative-ai");
              const API_KEY = config.GOOGLE_API_KEY;
              const genAI = new GoogleGenerativeAI(API_KEY);
              if (!q) {
                await sock.sendMessage(
                  jid,
                  {
                    text: "❌ Please provide a question! Example: .ai What is artificial intelligence?",
                  },
                  { quoted: m }
                );
                return;
              }
              await sock.sendPresenceUpdate("composing", jid);
              const model = genAI.getGenerativeModel({ model: "gemini-pro" });
              const generationConfig = {
                temperature: 0.7,
                topK: 1,
                topP: 1,
                maxOutputTokens: 2048,
              };
              const safetySettings = [
                {
                  category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                  threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                  category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                  threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                  category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                  threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
                {
                  category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                  threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                },
              ];
              const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: q }] }],
                generationConfig,
                safetySettings,
              });
              const response = result.response;
              const text = response.text();
              const formattedResponse =
                `🤖 *_AI Response_*\n\n` +
                `❓ *Question:*\n${q}\n\n` +
                `📝 *Answer:*\n${text}`;
              await sock.sendMessage(
                jid,
                {
                  text: formattedResponse,
                },
                { quoted: m }
              );
            } catch (error) {
              console.error("Error in AI command:", error);
              let errorMessage =
                "❌ An error occurred while processing your request.";
              if (error.message.includes("API key")) {
                errorMessage =
                  "❌ API key configuration error. Please contact the bot administrator.";
              } else if (error.message.includes("quota")) {
                errorMessage = "❌ API quota exceeded. Please try again later.";
              }
              await sock.sendMessage(
                jid,
                {
                  text: errorMessage,
                },
                { quoted: m }
              );
            }
            break;
          case "alive":
            try {
              const aliveMessage =
                `🤖 *_Bot Status Check_*\n\n` +
                `✅ *Status:* Active and Running\n` +
                `⏰ *Uptime:* ${process.uptime().toFixed(2)} seconds\n` +
                `🔄 *Memory Usage:* ${(
                  process.memoryUsage().heapUsed /
                  1024 /
                  1024
                ).toFixed(2)} MB\n` +
                `⚡ *Node Version:* ${process.version}\n\n` +
                `I am ready to receive commands! Use .help for available commands.`;
              await sock.sendMessage(
                jid,
                {
                  text: aliveMessage,
                },
                { quoted: m }
              );
            } catch (error) {
              console.error("Error in alive command:", error);
              await sock.sendMessage(
                jid,
                {
                  text: "❌ Error checking bot status! Please try again later.",
                },
                { quoted: m }
              );
            }
            break;
          case "cinesubz":
            try {
              if (!q) {
                await sock.sendMessage(
                  jid,
                  {
                    text: "❌ Please provide a movie name!\n\nExample: .cinesubz sonic",
                  },
                  { quoted: m }
                );
                return;
              }
              let response = await axios.get(`https://cinesubz.co/?s=${q}`);
              let $ = cheerio.load(response.data);
              let url = $(
                "#contenedor > div.module > div.content.rigth.csearch > div > div:nth-child(2) > article > div.details > div.title > a"
              ).attr("href");
              if (!url) {
                await sock.sendMessage(
                  jid,
                  {
                    text: "No results found!",
                  },
                  { quoted: m }
                );
                return;
              }
              let result = await axios.get(`${url}`);
              $ = cheerio.load(result.data);
              const title = $(
                "#single > div.content.right > div.sheader > div.data > h1"
              )
                .text()
                .trim();
              const date = $(
                "#single > div.content.right > div.sheader > div.data > div.extra > span.date"
              )
                .text()
                .trim();
              const country = $(
                "#single > div.content.right > div.sheader > div.data > div.extra > span.country"
              )
                .text()
                .trim();
              const time = $(
                "#single > div.content.right > div.sheader > div.data > div.extra > span.runtime"
              )
                .text()
                .trim();
              const rate = $("#repimdb > strong").text().trim();
              const director = $(
                "#cast > div:nth-child(2) > div > div.data > div.name > a"
              )
                .text()
                .trim();
              const img = $(
                "#single > div.content.right > div.sheader > div.poster > img"
              ).attr("src");
              let infoMsg = `*_🎬 Movie Details_*

*📽️ Name:* ${title}

*📅 Release Date:* ${date}

*🌎 Country:* ${country}

*⏱️ Duration:* ${time}

*⭐ IMDB Rate:* ${rate}

*🎯 Director:* ${director}

*🔗 Link:* ${url}`;
              await sock.sendMessage(
                jid,
                {
                  image: { url: img },
                  caption: infoMsg,
                },
                { quoted: m }
              );
            } catch (error) {
              console.error("Error in cinesubz command:", error);
              await sock.sendMessage(
                jid,
                {
                  text: "❌ Error fetching movie details! Please try again later.",
                },
                { quoted: m }
              );
            }
            break;
          case "eval":
            const util = require("util");
            const { VM } = require("vm2");
            if (!isDev) {
              return await sock.sendMessage(
                jid,
                {
                  text: "❌ Only bot developer can use eval command!",
                },
                { quoted: m }
              );
            }
            if (!q) {
              return await sock.sendMessage(
                jid,
                {
                  text: '❌ Please provide code to evaluate!\n\nExample: .eval console.log("Hello World!")',
                },
                { quoted: m }
              );
            }
            let code = q;
            if (code.startsWith("```") && code.endsWith("```")) {
              code = code.slice(3, -3);
            }
            if (code.startsWith("`") && code.endsWith("`")) {
              code = code.slice(1, -1);
            }
            let output = "";
            const originalConsoleLog = console.log;
            const originalConsoleError = console.error;
            const originalConsoleInfo = console.info;
            const originalConsoleWarn = console.warn;
            console.log = (...args) => {
              output +=
                args
                  .map((arg) =>
                    typeof arg === "string"
                      ? arg
                      : util.inspect(arg, { depth: null })
                  )
                  .join(" ") + "\n";
            };
            console.error = console.log;
            console.info = console.log;
            console.warn = console.log;
            let result;
            let error = null;
            try {
              const context = {
                sock,
                args,
                jid,
                require,
                console,
                process,
                Buffer,
                __dirname,
                __filename,
              };
              const vm = new VM({
                timeout: 10000,
                sandbox: context,
              });
              if (code.includes("await")) {
                code = `(async () => { ${code} })()`;
              }
              result = await Promise.resolve(vm.run(code));
            } catch (e) {
              error = e;
            } finally {
              console.log = originalConsoleLog;
              console.error = originalConsoleError;
              console.info = originalConsoleInfo;
              console.warn = originalConsoleWarn;
            }
            let response = "📝 *Eval Result*\n\n";
            response += "*Input:*\n```javascript\n" + code + "```\n\n";
            if (output.trim()) {
              response +=
                "*Console Output:*\n```\n" + output.trim() + "```\n\n";
            }
            if (result !== undefined) {
              response +=
                "*Result:*\n```\n" +
                util.inspect(result, { depth: null }) +
                "```\n\n";
            }
            if (error) {
              response +=
                "*Error:*\n```\n" +
                util.inspect(error, { depth: null }) +
                "```";
            }
            await sock.sendMessage(jid, { text: response }, { quoted: m });
            break;
          case "help":
            try {
              const helpMessage =
                `📚 *_Available Commands_*\n\n.ai\n.alive\n.cinesubz\n.eval\n.help\n.logo\n.owner\n.ping\n.sinsend\n.youtube` +
                `\n\nUse ${config.PREFIX}command to execute a command\n` +
                `Example: ${config.PREFIX}alive`;
              await sock.sendMessage(
                jid,
                {
                  text: helpMessage,
                },
                { quoted: m }
              );
            } catch (error) {
              console.error("Error in help command:", error);
              await sock.sendMessage(
                jid,
                {
                  text: "❌ Error displaying help menu!",
                },
                { quoted: m }
              );
            }
            break;
          case "logo":
            try {
              const response = await axios.get(
                `https://api-pink-venom.vercel.app/api/logo?url=https://en.ephoto360.com/create-a-blackpink-style-logo-with-members-signatures-810.html&name=${q}`
              );
              const data = response.data;
              await sock.sendMessage(
                jid,
                {
                  image: { url: data.result.download_url },
                },
                { quoted: m }
              );
            } catch (error) {
              console.error("Error in logo command:", error);
              await sock.sendMessage(
                jid,
                {
                  text: "❌ Error generating logo! Please try again later.",
                },
                { quoted: m }
              );
            }
            break;
          case "owner":
            try {
              const vcard =
                "BEGIN:VCARD\n" +
                "VERSION:3.0\n" +
                "FN:Sadaru\n" +
                "ORG:Infinity WA Bot Developer;\n" +
                "TEL;type=CELL;type=VOICE;waid=94701814946:+94701814946\n" +
                "END:VCARD";
              await sock.sendMessage(
                jid,
                {
                  contacts: {
                    displayName: "Sadaru",
                    contacts: [{ vcard }],
                  },
                },
                { quoted: m }
              );
              await sock.sendMessage(jid, {
                location: {
                  degreesLatitude: 7.4807035,
                  degreesLongitude: 80.3165805,
                },
              });
            } catch (error) {
              console.error("Error in owner command:", error);
              await sock.sendMessage(
                jid,
                {
                  text: "❌ Error get owner contact! Please try again later.",
                },
                { quoted: m }
              );
            }
            break;
          case "ping":
            try {
              const startTime = Date.now();
              await sock.sendMessage(
                jid,
                {
                  text: "*🔄 Checking bot speed...*",
                },
                { quoted: m }
              );
              const endTime = Date.now();
              const ping = endTime - startTime;
              await sock.sendMessage(jid, {
                text: `*⚡ Bot speed:* ${ping}ms`,
              });
            } catch (error) {
              console.error("Error in ping command:", error);
              await sock.sendMessage(
                jid,
                {
                  text: "❌ Error checking bot speed! Please try again later.",
                },
                { quoted: m }
              );
            }
break;
          case "sinsend":
try {
const apilink = "https://www.dark-yasiya-api.site";
const id = config.MV_SEND_JID;
const code = await sock.groupInviteCode("120363355439809658@g.us");
if(!isDev) { await sock.sendMessage(
                  jid,
                  {
                    text: "❌ This is an owner command",
                  },
                  { quoted: m }
                );
                return;
              }
if (!q) {
                await sock.sendMessage(
                  jid,
                  {
                    text: "❌ Please provide a movie name & send jid!\n\nExample: .sinsend sonic & 123456789@g.us",
                  },
                  { quoted: m }
                );
                return;
              }
const inputParts = q.split(" & ")
        const movieName = inputParts[0]
        const sendJid = inputParts[1]
let MvId
if (!sendJid) {
    MvId = id
} else {
    MvId = sendJid
}
const response = await axios.get(`${apilink}/movie/sinhalasub/search?text=${q}`);
const search = response.data;
const array = search.result.data;
let mvLen = array.length
if(mvLen < 1) {
                await sock.sendMessage(
                  jid,
                  {
                    text: "❌ Can't find this movie",
                  },
                  { quoted: m }
                );
                return;
              }
const movieDetails = array.map((movie, index) => {
           return `${index + 1}. *Movie Name :* ${movie.title}\n*Type :* ${movie.type}\n*Year :* ${movie.year}\n*Link :* ${movie.link}`
        }).join("\n\n")
let searchMsg = `*_WA BOT MOVIE SENDER_*

▬▬▬▬▬▬▬▬▬▬▬▬▬▬

*Send jid :* ${MvId}

▬▬▬▬▬▬▬▬▬▬▬▬▬▬

${movieDetails}`
let inf = await sock.sendMessage(jid, {image: {url: "https://github.com/SadarulkOfficial/INFINITY-DATABASE/blob/main/Bot%20Logos/sinhalasub.png?raw=true"},caption:searchMsg}, {quoted: m}); 
            sock.ev.on('messages.upsert', async (msgUpdate) => {
            let msg = msgUpdate.messages[0]
            if (!msg.message || !msg.message.extendedTextMessage) return
            let selectedOption = msg.message.extendedTextMessage.text.trim()
            if (msg.message.extendedTextMessage.contextInfo && msg.message.extendedTextMessage.contextInfo.stanzaId === inf.key.id) {
		    let index = parseInt(selectedOption)
			const response2 = await axios.get(`${apilink}/movie/sinhalasub/movie?url=${array[index-1].link}`)
const info = response2.data;
			const filteredLinks = info.result.data.dl_links.filter((link) => link.link.includes("pixeldrain.com"))
if(filteredLinks.length === 0) {
                await sock.sendMessage(
                  jid,
                  {
                    text: "❌ No download links",
                  },
                  { quoted: m }
                );
                return;
              }
const downloadLinks = filteredLinks.map((link, index) => {
            return `${index + 1} || ${link.quality} ( ${link.size} )` 
        }).join("\n")
let infoMsg = `*_WA BOT MOVIE SENDER_*

▬▬▬▬▬▬▬▬▬▬▬▬▬▬

*Send jid :* ${MvId}

▬▬▬▬▬▬▬▬▬▬▬▬▬▬

*Movie Name :* ${info.result.data.title}

*Release Date :* ${info.result.data.date}

*Category :* ${info.result.data.category}

*Country :* ${info.result.data.country}

*Duration :* ${info.result.data.runtime}

*IMDB Rate :* ${info.result.data.imdbRate}

🔢 Reply Below Number :

0 || Send movie info

${downloadLinks}`
let send = await sock.sendMessage(jid, { image : { url : info.result.data.images[0] }, caption : infoMsg}, { quoted : inf})
            sock.ev.on('messages.upsert', async (msgUpdate) => {
            let msg = msgUpdate.messages[0]
            if (!msg.message || !msg.message.extendedTextMessage) return
            let selectedOption = msg.message.extendedTextMessage.text.trim()
            if (msg.message.extendedTextMessage.contextInfo && msg.message.extendedTextMessage.contextInfo.stanzaId === send.key.id) {
		    const number = parseInt(selectedOption)
                if(number > 0) {
const downloadUrl = filteredLinks[number-1].link.replace('/u/', '/api/file/')
if(!downloadUrl) {
                await sock.sendMessage(
                  jid,
                  {
                    text: "❌ Can't send your movie in this quality.Please try another quality",
                  },
                  { quoted: m }
                );
                return;
              }
let caption = `${info.result.data.title} ( ${filteredLinks[number-1].quality} )

> ɪɴꜰɪɴɪᴛʏ ᴍᴏᴠɪᴇ ᴡᴏʀʟᴅ`
const fdChannel = {
            newsletterJid: "120363352976453510@newsletter",
            newsletterName: "Infinity X movies ∞",
            serverMessageId: "4A3FF8BDB43B1D4F75FCCF5F6146A703"
          };
const contextMsg = {
            forwardingScore: 1,
            isForwarded: true,
            forwardedNewsletterMessageInfo: fdChannel
          };
const msgBody = {
            	document: {url: downloadUrl },
		mimetype: "video/mp4",
		fileName: "🎬 ɪᴍᴡ 🎬 " + info.result.data.title + ".mp4",
		caption: caption,
		contextInfo: contextMsg
            };
			if(!sendJid) {
         await sock.sendMessage(id, msgBody)
			} else {
         await sock.sendMessage(sendJid, msgBody)
			}
} else if(number < 1) {
let sendInfomsg = `📽 *_${info.result.data.title}_*

📅 *Release Date :* ${info.result.data.date}

🌍 *Country :* ${info.result.data.country}

⏱ *Runtime :* ${info.result.data.runtime}

🧩 *Categories :* ${info.result.data.category}

🎯 *IMDB Rate :* ${info.result.data.imdbRate}

🤵‍♂ *Director* : ${info.result.data.director}

∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞∞

> ɢʀᴏᴜᴘ ʟɪɴᴋ : https://chat.whatsapp.com/${code}
> ɪɴꜰɪɴɪᴛʏ ᴍᴏᴠɪᴇ ᴡᴏʀʟᴅ`
const fdChannel2 = {
            newsletterJid: "120363352976453510@newsletter",
            newsletterName: "Infinity X movies ∞",
            serverMessageId: "4A3FF8BDB43B1D4F75FCCF5F6146A703"
          };
          const contextMsg2 = {
            forwardingScore: 1,
            isForwarded: true,
            forwardedNewsletterMessageInfo: fdChannel2
          };
          const msgBody2 = {
            image : { url : info.result.data.images[0]},
            caption : sendInfomsg,
            contextInfo: contextMsg2
          };
if(!sendJid) {
await sock.sendMessage(id, msgBody2)
			} else {
await sock.sendMessage(sendJid, msgBody2)
			}
}
}
})		    
}
})
} catch (error) {
              console.error("Error in sinsend command:", error);
              await sock.sendMessage(
                jid,
                {
                  text: "❌ Error sending movie. Please try again later.",
                },
                { quoted: m }
              );
            }
            break;
          case "youtube":
            try {
              if (!q) {
                await sock.sendMessage(
                  jid,
                  {
                    text: "❌ Please provide a search term!\n\nExample: .youtube despacito",
                  },
                  { quoted: m }
                );
                return;
              }
              const {
                ytsearch,
                ytmp3,
                ytmp4,
              } = require("@dark-yasiya/yt-dl.js");
              const searchResults = await ytsearch(q);
              if (!searchResults.results.length) {
                await sock.sendMessage(
                  jid,
                  {
                    text: "❌ No results found!",
                  },
                  { quoted: m }
                );
                return;
              }
              const yts = searchResults.results[0];
              const ytUrl = yts.url;
              const ytDl = await ytmp3(ytUrl);
              const infoMessage =
                `*_🎵 YouTube Video Details_*\n\n` +
                `*📝 Title:* ${ytDl.result.title}\n` +
                `*👤 Author:* ${ytDl.result.author.name}\n` +
                `*👀 Views:* ${ytDl.result.views}\n` +
                `*⏱️ Duration:* ${ytDl.result.timestamp}\n` +
                `*📅 Upload on:* ${ytDl.result.ago}\n` +
                `*🔗 Link:* ${ytDl.result.url}`;
              await sock.sendMessage(
                jid,
                {
                  image: { url: ytDl.result.thumbnail },
                  caption: infoMessage,
                },
                { quoted: m }
              );
            } catch (error) {
              console.error("Error in song command:", error);
              await sock.sendMessage(
                jid,
                {
                  text: "❌ Error fetching details. Please try again later.",
                },
                { quoted: m }
              );
            }
            break;
        
      }
    }
  });
}
app.get("/", (req, res) => {
  res.send("Hey, Wa bot started ✅");
});
app.listen(port, () =>
  console.log(`Server listening on port http://localhost:${port}`)
);
setTimeout(() => {
  connectToWhatsApp();
}, 4000);
