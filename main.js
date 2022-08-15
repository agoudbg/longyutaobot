process.env.NTBA_FIX_319 = 1;
process.env.NTBA_FIX_350 = 1;

const config = require('./config');
const mysql = require('mysql2/promise');
const xss = require('xss');
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(config.token, { polling: true });

const sql = mysql.createPool(config.mysql);

var adminUploadBind = {};

bot.on("polling_error", console.log);

bot.on('message', async (msg) => {
    console.log(msg);
    if (msg.text) {
        if (msg.text.charAt(0) == '/') {
            command = msg.text.substring(1, msg.text.length).replace("@" + config.username, "").split(' ');
        }
        else command = [undefined];
    }
    else command = [undefined];

    switch (command[0]) {
        case 'long':
            scksList = await getLong(command.slice(1));
            if (scksList.length == 0) {
                scksList = await getLong();
            }
            randomNum = Math.floor(Math.random() * scksList.length);
            bot.sendSticker(msg.chat.id, scksList[randomNum].id, { reply_to_message_id: (msg.reply_to_message ? msg.reply_to_message.message_id : msg.message_id), allow_send_without_reply: true });
            break;
        case 'help':
        case 'start':
            bot.sendMessage(msg.chat.id, "Hi，我是龙图小助手。\n\n/long [关键词] - 发送随机龙图\n\n在聊天中打出 @" + config.username + " 即可快速获取龙图。", { reply_to_message_id: msg.message_id, allow_send_without_reply: true });
            return;
        case 'add':
        case 'addset':
        case 'del':
        case 'edit':
            if (!msg.reply_to_message?.sticker) {
                return bot.sendMessage(msg.chat.id, "请回复一张贴纸。", { reply_to_message_id: msg.message_id, allow_send_without_reply: true });
            }
            else if (config.admin.indexOf(msg.from.id) == -1) {
                return bot.sendMessage(msg.chat.id, "您没有权限执行此操作。", { reply_to_message_id: msg.message_id, allow_send_without_reply: true });
            }
            else {
                if (command[0] == 'add') {
                    uIdTry = await sql.query("SELECT * FROM `stickers` WHERE `unique_id` = ?", [msg.reply_to_message.sticker.file_unique_id]);
                    if (uIdTry[0].length > 0) {
                        return bot.sendMessage(msg.chat.id, "该贴纸已存在。", { reply_to_message_id: msg.message_id, allow_send_without_reply: true });
                    }
                    await sql.query("INSERT INTO `stickers` (`id`, `keyword`, `unique_id`) VALUES (?, ?, ?)", [msg.reply_to_message.sticker.file_id, command.slice(1).join(' '), msg.reply_to_message.sticker.file_unique_id]);
                    bot.sendMessage(msg.chat.id, "添加成功。", { reply_to_message_id: msg.message_id, allow_send_without_reply: true });
                }
                else if (command[0] == 'addset') {
                    if (!msg.reply_to_message.sticker.set_name) {
                        return bot.sendMessage(msg.chat.id, "请回复一张属于贴纸包的贴纸。", { reply_to_message_id: msg.message_id, allow_send_without_reply: true });
                    }
                    else {
                        set = await bot.getStickerSet(msg.reply_to_message.sticker.set_name);
                        imgWord = `正在将贴纸包 ${set.title} 添加到龙图资料库。\n已完成 {finished} 个，共 ${set.stickers.length} 个。`;
                        noticeMsg = await bot.sendMessage(msg.chat.id, imgWord.replace('{finished}', '0'), { reply_to_message_id: msg.message_id, allow_send_without_reply: true });
                        finished = 0;
                        duplicate = 0;
                        set.stickers.forEach(async (sticker) => {
                            uIdTry = await sql.query("SELECT * FROM `stickers` WHERE `unique_id` = ?", [sticker.file_unique_id]);
                            if (uIdTry[0].length > 0) {
                                duplicate++;
                                return;
                            }
                            await sql.query("INSERT INTO `stickers` (`id`, `keyword`, `unique_id`) VALUES (?, ?, ?)", [sticker.file_id, '', sticker.file_unique_id]);
                            finished++;
                            // if (finished % 100 == 0) await bot.editMessageText(imgWord.replace('{finished}', finished), { chat_id: msg.chat.id, message_id: noticeMsg.message_id });
                        });
                        await bot.editMessageText(`已将贴纸包 ${set.title} 添加到龙图资料库。\n共添加 ${set.stickers.length} 个${duplicate != 0 ? `，已排除重复贴纸 ${duplicate} 张` : ''}。`, { chat_id: msg.chat.id, message_id: noticeMsg.message_id });
                    }
                }
                else if (command[0] == 'del') {
                    await sql.query("DELETE FROM `stickers` WHERE `unique_id` = ?", [msg.reply_to_message.sticker.file_unique_id]);
                    bot.sendMessage(msg.chat.id, "删除成功。", { reply_to_message_id: msg.message_id, allow_send_without_reply: true });
                }
                else if (command[0] == 'edit') {
                    await sql.query("UPDATE `stickers` SET `keyword` = ? WHERE `unique_id` = ?", [command.slice(1).join(' '), msg.reply_to_message.sticker.file_unique_id]);
                    bot.sendMessage(msg.chat.id, "修改成功。", { reply_to_message_id: msg.message_id, allow_send_without_reply: true });
                }
            }
            break;
        default:
            if (config.admin.indexOf(msg.chat.id) > -1) {
                switch (command[0]) {
                    case 'create':
                        if (command.length < 3) {
                            return bot.sendMessage(msg.chat.id, "请输入贴纸包名称和 ID。", { reply_to_message_id: msg.message_id, allow_send_without_reply: true });
                        }
                        if (!msg.reply_to_message || !msg.reply_to_message.sticker) {
                            return bot.sendMessage(msg.chat.id, "请回复一张贴纸。", { reply_to_message_id: msg.message_id, allow_send_without_reply: true });
                        }
                        sticker = msg.reply_to_message.sticker;
                        newSet = await bot.createNewStickerSet(msg.from.id, command[2] + "_by_" + config.username, command[1].replace(/\&nbsp;/g, ' '), sticker.file_id, sticker.emoji || '🐉');
                        await sql.query("INSERT INTO `stickers` (`id`, `keyword`, `unique_id`) VALUES (?, ?, ?) IF NOT EXISTS", [sticker.file_id, '', sticker.file_unique_id]);
                        bot.sendMessage(msg.chat.id, "创建成功。", { reply_to_message_id: msg.message_id, allow_send_without_reply: true });
                    case 'set':
                        if (command.length < 2) {
                            return bot.sendMessage(msg.chat.id, "请输入贴纸包 ID。", { reply_to_message_id: msg.message_id, allow_send_without_reply: true });
                        }
                        adminUploadBind[msg.from.id] = { id: command[1] };
                        bot.sendMessage(msg.chat.id, `成功绑定 ${command[1]}，bot 重启后重置。`, { reply_to_message_id: msg.message_id, allow_send_without_reply: true });
                        break;
                    case 'done':
                        adminUploadBind[msg.from.id] = null;
                        bot.sendMessage(msg.chat.id, `成功解除绑定。`, { reply_to_message_id: msg.message_id, allow_send_without_reply: true });
                        break;
                }
                if (msg.sticker && adminUploadBind[msg.from.id]) {
                    uIdTry = await sql.query("SELECT * FROM `stickers` WHERE `unique_id` = ?", [msg.sticker.file_unique_id]);
                    if (uIdTry[0].length > 0) {
                        return bot.sendMessage(msg.chat.id, "该贴纸已存在。", { reply_to_message_id: msg.message_id, allow_send_without_reply: true });
                    }
                    stickerAddStatus = false;
                    stickerAddStatus = await bot.addStickerToSet(msg.from.id, adminUploadBind[msg.from.id].id + "_by_" + config.username, msg.sticker.file_id, msg.sticker.emoji || '🐉');
                    if (stickerAddStatus) {
                        setStks = await bot.getStickerSet(adminUploadBind[msg.from.id].id + "_by_" + config.username);
                        if (setStks) stkInfo = setStks['stickers'][setStks['stickers'].length - 1];
                        await sql.query("INSERT INTO `stickers` (`id`, `keyword`, `unique_id`) VALUES (?, ?, ?)", [stkInfo.file_id, '', stkInfo.file_unique_id]);
                        bot.sendMessage(msg.chat.id, "添加成功。", { reply_to_message_id: msg.message_id, allow_send_without_reply: true });
                    }
                    else {
                        bot.sendMessage(msg.chat.id, "添加失败。", { reply_to_message_id: msg.message_id, allow_send_without_reply: true });
                    }
                }
            }
    }
});

bot.on('inline_query', async (event) => {
    console.log(event);
    scksList = await getLong(event.query.split(' '));
    if (scksList.length == 0) {
        scksList = await getLong();
    }
    seletedNum = Math.min(scksList.length, 20);
    seletedScks = [];
    for (let i = 0; i < seletedNum; i++) {
        randomNum = Math.floor(Math.random() * scksList.length);
        isDuplicate = false;
        seletedScks.forEach(function (sck) {
            if (sck.id == scksList[randomNum].unique_id) {
                i--;
                isDuplicate = true;
                console.log('duplicate');
            }
        });
        if (!isDuplicate) {
            seletedScks.push({ type: 'sticker', id: scksList[randomNum].unique_id, sticker_file_id: scksList[randomNum].id });
        }
    }
    bot.answerInlineQuery(event.id, seletedScks, { cache_time: event.query == "" ? 0 : 120 });
});

async function getLong(search = []) {
    console.log("Search: " + JSON.stringify(search));
    if (!search || search.length == 0 || search[0] == '') {
        scksList = await sql.query("SELECT * FROM `stickers`");
    }
    else {
        // spilt search query by space
        searchSQL = "1 AND ";
        search.forEach((item) => {
            if (item) searchSQL += "`keyword` LIKE '%" + xss(item) + "%' AND ";
        });
        // query database
        scksList = await sql.query("SELECT * FROM `stickers` WHERE " + searchSQL + "1");
    }
    scksList = scksList[0];
    return scksList;
}

console.log('Bot started');