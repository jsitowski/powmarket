import * as timeago from "timeago.js"

const database = require("./db");

import * as helpers from "./helpers"

export const BAD_EMOJIS = ["👎", "😠"];

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

export function processDisplayForMagicNumber(m, { bsvusd }) {

    let display_value;

    if (m.mined_price) {
        display_value = m.mined_price;
    } else {
        display_value = helpers.satoshisToDollars(m.value, bsvusd);
    }

    m.display_date = timeago.format(m.created_at * 1000);
    m.display_mined_date = timeago.format((m.mined_at || m.created_at) * 1000);
    m.display_value = display_value;
    m.display_target = (m.target.length > 10 ? m.target.substr(0, 10) + "..." : m.target);
    return m;
}



export function process({ tx, bsvusd, type, header }) {

    if (tx.mined_bsvusd) {
        tx.bsvusd = helpers.satoshisToDollars(tx.value, tx.mined_bsvusd);
    } else {
        tx.bsvusd = helpers.satoshisToDollars(tx.value, bsvusd);
    }

    tx = processDisplayForMagicNumber(tx, { bsvusd });

    if (tx.mined_at) {
        tx.mined_in = helpers.humanReadableInterval(Math.floor(((tx.mined_at - tx.created_at) * 100)) / 100);
    }

    tx.type = type;
    tx.header = header;
    if (tx.magicnumber) {
        tx.power = helpers.countpow(tx.magicnumber, tx.target);
    }

    if (!tx.emoji) {
        tx.emoji = null;
    }

    if (!tx.magicnumber) {
        tx.magicnumber = null;
    }

    return tx;
}

