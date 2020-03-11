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

export async function processDisplayForMagicNumber(magicnumber, context={}) {

    let display_value;
    if (magicnumber.mined_price) {
         display_value = magicnumber.mined_price;
    } else {
        const bsvusd = (context.bsvusd ? context.bsvusd : await helpers.bsvusd());
        display_value = helpers.satoshisToDollars(magicnumber.value, bsvusd);
    }

    magicnumber.display_value = display_value;
    magicnumber.display_date = timeago.format(magicnumber.created_at * 1000);
    magicnumber.display_mined_date = timeago.format((magicnumber.mined_at || magicnumber.created_at) * 1000);
    magicnumber.display_target = (magicnumber.target.length > 10 ? magicnumber.target.substr(0, 10) + "..." : magicnumber.target);
    return magicnumber;
}



export async function process(tx) {

    tx = processDisplayForMagicNumber(tx);

    if (tx.mined_at) {
        tx.mined_in = helpers.humanReadableInterval(Math.floor(((tx.mined_at - tx.created_at) * 100)) / 100);
    }

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

