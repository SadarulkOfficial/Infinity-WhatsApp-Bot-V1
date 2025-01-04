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
const { File } = require("megajs")
const commands = new Map();
const PREFIX = config.PREFIX;
const SESSION_DIR = "./sessions";
if (!existsSync(SESSION_DIR)) {
  mkdirSync(SESSION_DIR);
}
if (!fs.existsSync(__dirname + "/sessions/creds.json")) {
if(!config.SESSION_ID) return console.log("Please add your session to SESSION_ID env !!");
const sessdata = config.SESSION_ID;
const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
filer.download((err, data) => {
if(err) throw err
fs.writeFile(__dirname + "/sessions/creds.json", data, () => {
console.log("Session downloaded successfully ✅");
})})}
const connectToWhatsApp = async () => {
  console.log("Bot installing... 🔄");
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const sock = makeWASocket({
    printQRInTerminal: false,
    auth: state,
    logger: pino({ level: "silent" }),
    maxFileSize: config.MAX_SIZE * 1024 * 1024,
  });
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error instanceof Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      console.log("Connection closed due to:", lastDisconnect?.error);
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === "open") {
      console.log("Bot connecting... 🔄");
      console.log("Bot connected successfully ✅");
    }
  });
  console.log("Bot installed successfully ✅");
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;
    const messageContent =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      m.message.imageMessage?.caption;
    if (messageContent.startsWith(PREFIX)) {
      const command = messageContent.slice(1).split(" ")[0].toLowerCase();
      const args = messageContent.trim().split(/ +/).slice(1);
      const q = args.join(" ");
      const jid = m.key.remoteJid;
      const typing = sock.sendPresenceUpdate("composing", jid);
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
              await sock.sendMessage(jid, {
                text: "❌ Please provide a question! Example: .ai What is artificial intelligence?",
              });
              return;
            }
            await typing;
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
            await sock.sendMessage(jid, {
              text: formattedResponse,
            });
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
            await sock.sendMessage(jid, {
              text: errorMessage,
            });
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
            await sock.sendMessage(jid, {
              text: aliveMessage,
            });
          } catch (error) {
            console.error("Error in alive command:", error);
            await sock.sendMessage(jid, {
              text: "❌ Error checking bot status! Please try again later.",
            });
          }
          break;
        case "cinesubz":
          try {
            if (!q) {
              await sock.sendMessage(jid, {
                text: "❌ Please provide a movie name!\n\nExample: .cinesubz sonic",
              });
              return;
            }
            let response = await axios.get(`https://cinesubz.co/?s=${q}`);
            let $ = cheerio.load(response.data);
            let url = $(
              "#contenedor > div.module > div.content.rigth.csearch > div > div:nth-child(2) > article > div.details > div.title > a"
            ).attr("href");
            if (!url) {
              await sock.sendMessage(msg.key.remoteJid, {
                text: "No results found!",
              });
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
            await sock.sendMessage(jid, {
              image: { url: img },
              caption: infoMsg,
            });
          } catch (error) {
            console.error("Error in cinesubz command:", error);
            await sock.sendMessage(jid, {
              text: "❌ Error fetching movie details! Please try again later.",
            });
          }
          break;
        case "help":
          try {
            const helpMessage =
              `📚 *_Available Commands_*\n\n.ai\n.alive\n.cinesubz\n.help\n.logo\n.owner\n.ping\n.youtube` +
              `\n\nUse ${config.PREFIX}command to execute a command\n` +
              `Example: ${config.PREFIX}alive`;
            await sock.sendMessage(jid, {
              text: helpMessage,
            });
          } catch (error) {
            console.error("Error in help command:", error);
            await sock.sendMessage(jid, {
              text: "❌ Error displaying help menu!",
            });
          }
          break;
        case "logo":
          try {
            const response = await axios.get(
              `https://api-pink-venom.vercel.app/api/logo?url=https://en.ephoto360.com/create-a-blackpink-style-logo-with-members-signatures-810.html&name=${q}`
            );
            const data = response.data;
            await sock.sendMessage(jid, {
              image: { url: data.result.download_url },
            });
          } catch (error) {
            console.error("Error in logo command:", error);
            await sock.sendMessage(jid, {
              text: "❌ Error generating logo! Please try again later.",
            });
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
            await sock.sendMessage(jid, {
              contacts: {
                displayName: "Sadaru",
                contacts: [{ vcard }],
              },
            });
            await sock.sendMessage(jid, {
              location: {
                degreesLatitude: 7.4807035,
                degreesLongitude: 80.3165805,
              },
            });
          } catch (error) {
            console.error("Error in owner command:", error);
            await sock.sendMessage(jid, {
              text: "❌ Error get owner contact! Please try again later.",
            });
          }
          break;
        case "ping":
          try {
            const startTime = Date.now();
            await sock.sendMessage(jid, {
              text: "*🔄 Checking bot speed...*",
            });
            const endTime = Date.now();
            const ping = endTime - startTime;
            await sock.sendMessage(jid, {
              text: `*⚡ Bot speed:* ${ping}ms`,
            });
          } catch (error) {
            console.error("Error in ping command:", error);
            await sock.sendMessage(jid, {
              text: "❌ Error checking bot speed! Please try again later.",
            });
          }
          break;
        case "youtube":
          try {
            if (!q) {
              await sock.sendMessage(jid, {
                text: "❌ Please provide a search term!\n\nExample: .youtube despacito",
              });
              return;
            }
            const { ytsearch, ytmp3, ytmp4 } = require("@dark-yasiya/yt-dl.js");
            const searchResults = await ytsearch(q);
            if (!searchResults.results.length) {
              await sock.sendMessage(jid, {
                text: "❌ No results found!",
              });
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
            await sock.sendMessage(jid, {
              image: { url: ytDl.result.thumbnail },
              caption: infoMessage,
            });
          } catch (error) {
            console.error("Error in song command:", error);
            await sock.sendMessage(jid, {
              text: "❌ Error fetching details. Please try again later.",
            });
          }
          break;
      }
    }
  });
};
process.on("uncaughtException", console.error);
connectToWhatsApp();
