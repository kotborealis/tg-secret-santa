const env = require('chen.js').env();
const TelegramBot = require('node-telegram-bot-api');
const md5 = require('md5');
const btoa = require('btoa');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const l10n = require('./l10n');

const token = env["TOKEN"];

if(!token) {
    console.error("Env variable TOKEN is missing.");
    process.exit(1);
}

const db = low(new FileSync('.db.json'));
db.defaults({users: [], santa: []}).write();

const bot = new TelegramBot(token, {polling: true});

function checkUserExists(id, username) {
    if(db.get('users').value().map(({username}) => username).indexOf(username) < 0)
        return false;

    bot.sendMessage(id, l10n.alreadyAccepted() + '\n' + userList());
    return true;
}

function signUp(id, username) {
    if(checkUserExists(id, username))
        return;

    db.get('users').push({username, id}).write();
    bot.sendMessage(id, l10n.offerAccepted() + '\n' + userList());
}

function userList() {
    return db.get('users').value().map(({username}) => l10n.formatUserInList(username)).join('\n');
}

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
        msg.chat.id, 
        l10n.offerSignUp(),
        {
            reply_markup: {
                keyboard: [[l10n.signUpButton()]]
            }
        }
    );
});

bot.onText(new RegExp(l10n.signUpButton()), (msg) => {
    signUp(msg.chat.id, msg.from.username);
});

bot.onText(/\/reduce/, (msg) => {
    const users = db.get('users').value().map(({username}) => username);
    const usersBag = users.map(a => [Math.random(), a])
                          .sort((a, b) => a[0] - b[0])
                          .map(a => a[1]);
    const usersCycledBag = [...usersBag, usersBag[0]];

    const santa = {};

    for(let i = 0; i < usersCycledBag.length - 1; i++) {
        const hash = md5(usersCycledBag[i]);
        santa[hash] = usersCycledBag[i+1];
    }

    db.set('santa', santa).write();

    bot.sendMessage(msg.chat.id, "Generated!\n" + JSON.stringify(santa) + "\n" + JSON.stringify(users));

    return;
});

bot.onText(/\/notify/, (msg) => {
    for(let user of db.get('users').value()) {
        bot.sendMessage(user.id, l10n.targetReady(db.get('santa').value()[md5(user.username)]), {parse_mode: "MarkdownV2"});
    }
});
