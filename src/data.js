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

    if (tx.magicnumber) {
        tx.power = helpers.countpow(tx.magicnumber, tx.target);
    }

    // mustache scoping bugs
    if (!tx.emoji) { tx.emoji = null }
    if (!tx.magicnumber) {tx.magicnumber = null }

    return tx;
}


