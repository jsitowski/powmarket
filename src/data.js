import * as timeago from "timeago.js"

const database = require("./db");

import * as helpers from "./helpers"

export const EMOJIS = ["👍", "👎", "🙏", "💥", "❤️", "🔥", "🤪", "😠", "🤔", "😂"];
export const BAD_EMOJIS = ["👎", "😠"];
export const EMOJI_TARGETS = EMOJIS.map(helpers.emojiUnicode);

export function isBadEmoji(emoji) {
    return BAD_EMOJIS.indexOf(emoji) >= 0;
}

export function isEmojiMagicNumber(target) {
    for (const emojiTarget of EMOJI_TARGETS) {
        if (target.indexOf(emojiTarget) === 0) {
            return emojiTarget;
        }
    }

    return null;
}

export async function results({ bsvusd, offset=0, limit=100, mined, sort={"created_at": -1} }) {
    if (!database.db) { throw new Error("expected db") }

    let query = {};
    if (mined === true) {
        query = {"mined": true };
    } else if (mined === false) {
        query = {"mined": false };
    }

    const magicnumbers = await database.db.collection("magicnumbers").find(query).sort(sort).skip(offset).limit(limit).toArray();

    return magicnumbers.map(magicnumber => {
        delete magicnumber._id;
        return magicnumber;
    });
}

export function processDisplayForPower(power) {
    if (power) {
        if (power < 0) {
            return (Math.round(Math.log(power * -1) / Math.log(10) * 100) * -1) / 100;
        } else {
            return Math.round((Math.log(power) / Math.log(10)) * 100) / 100;
        }
    }

    return 0;
}

export async function processDisplayForMagicNumber(tx={}) {

    let display_value;
    if (tx.mined_price) {
         display_value = tx.mined_price;
    } else {
        const bsvusd = (tx.bsvusd ? tx.bsvusd : await helpers.bsvusd());
        display_value = helpers.satoshisToDollars(tx.value, bsvusd);
    }

    tx.display_value = display_value;
    tx.display_date = timeago.format(tx.created_at * 1000);
    tx.display_mined_date = timeago.format((tx.mined_at || tx.created_at) * 1000);

    tx.display_target = (tx.target.length > 10 ? tx.target.substr(0, 10) + "..." : tx.target);

    if (tx.mined_at) {
        tx.mined_in = helpers.humanReadableInterval(Math.floor(((tx.mined_at - tx.created_at) * 100)) / 100);
    }

    if (tx.power) {
        tx.display_power = processDisplayForPower(tx.power);
    }

    // mustache scoping bugs
    if (!tx.emoji) { tx.emoji = null }
    if (!tx.magicnumber) {tx.magicnumber = null }

    return tx;
}


