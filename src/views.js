import * as timeago from "timeago.js"

import * as helpers from "./helpers"
import * as data from "./data"
import * as database from "./db"

// TODO: Store power to easily aggregate in database

export async function dashboard(view={}) {
    if (!database.db) { throw new Error("expected db") }
    if (!view.bsvusd) { throw new Error("expected bsvusd") }

    const mined_results = (await database.db.collection("magicnumbers").aggregate([{"$match": {mined: true}}, {"$group": {
        _id: null,
        "mined_earnings": {"$sum": "$mined_price"},
        "mined_num": {"$sum": 1},
    }}]).toArray())[0];

    const mined_num = mined_results["mined_num"];
    const mined_earnings = mined_results["mined_earnings"];

    const unmined_num = await database.db.collection("magicnumbers").find({"mined": false}).count();
    const unmined_satoshis = (await database.db.collection("magicnumbers").aggregate([{"$match": {mined: false}}, {"$group": {_id: null, "amount": {"$sum": "$value"}}}]).toArray())[0].amount;

    return Object.assign(view, {
        "dashboard": {
            mined_num: helpers.numberWithCommas(mined_num),
            mined_earnings,
            unmined_num: helpers.numberWithCommas(unmined_num),
            unmined_earnings: helpers.satoshisToDollars(unmined_satoshis, view.bsvusd)
        }
    });
}


export async function blockviz(view={}) {
    if (!database.db) { throw new Error("expected db") }

    const now = Math.floor((new Date()).getTime() / 1000);
    const interval = 86400 / 16;
    const num = 112;

    let before = now - (interval * num);
    const txs = await database.db.collection("magicnumbers").find({"created_at": {"$gte": before}}).sort({"created_at": 1}).toArray();

    let buckets = [];
    while (before < now) {

        let after = before + interval;
        let bucket = [];

        while (txs.length && (txs[0].created_at < after)) {
            const tx = txs.shift();
            bucket.push({
                mined: tx.mined,
                power: tx.target.length, // Get polarity from fn
                txid: tx.txid,
            });
        }

        buckets.push(bucket);

        before += interval;
    }

    return Object.assign(view, {
        blockviz: buckets
    });
}

export async function mined(view={}) {
    if (!view.bsvusd) { view.bsvusd = await helpers.bsvusd() }
    if (!view.dashboard) { view = await dashboard(view) }
    const mined = await data.results(Object.assign({}, view, {"mined": true, "sort": {"mined_at": -1}}));
    view.mined = await Promise.all(mined.map(async (m) => { return await data.processDisplayForMagicNumber(m, view)}));
    return view;
}

export async function unmined(view={}) {
    if (!view.bsvusd) { view.bsvusd = await helpers.bsvusd() }
    if (!view.dashboard) { view = await dashboard(view) }
    const unmined = await data.results(Object.assign({}, view, {"mined": false}));
    view.unmined = await Promise.all(unmined.map(async (m) => { return await data.processDisplayForMagicNumber(m, view)}));
    return view;
}

export async function homepage(view={}) {
    if (!database.db) { throw new Error("expected db") }

    const bsvusd = await helpers.bsvusd();
    if (!bsvusd) { throw new Error(`expected bsvusd to be able to price homepage`) }

    view.bsvusd = bsvusd;
    view.limit = 10;

    const views = [blockviz, dashboard, mined, unmined];
    for (const viewhandler of views) {
        view = await viewhandler(view);
    }

    return view;
}


export async function tx({ tx, hash, type, header }) {
    if (!database.db) { throw new Error("expected db") }

    tx = await data.process({ tx, type, header });

    tx.type = type;
    tx.header = header;

    const txs = (await database.db.collection("magicnumbers").find({
        "$or": [
            {"hash": tx.txid},
            {"hash": tx.magicnumber},
        ]
    }).limit(10).toArray()).filter(t => {
        return t.txid !== tx.txid;
    }).map(async (t) => {
        return await data.process({ tx: t, bsvusd, type, header });
    });

    if (txs.length > 0) {
        tx.txs = txs;
    }

    const powers = [];
    powers.push({ power: tx.power, polarity: (data.BAD_EMOJIS.indexOf(tx.emoji) >= 0 ? -1 : 1)});

    for (const t of txs) {
        powers.push({ power: t.power, polarity: (data.BAD_EMOJIS.indexOf(t.emoji) >= 0 ? -1 : 1)});
    }

    tx.power = Math.floor(helpers.aggregatepower(powers) * 100) / 100;

    return tx;
}

export async function txs({ txs, hash, type, header }) {
    if (!database.db) { throw new Error("expected db") }

    const bsvusd = await helpers.bsvusd();
    if (!bsvusd) { throw new Error(`expected bsvusd to be able to price homepage`) }

    const powers = [];

    for (let tx of txs) {
        tx = await data.processDisplayForMagicNumber(tx, { bsvusd });

        /*
        if (tx.mined_price) {
            tx.bsvusd = helpers.satoshisToDollars(tx.value, tx.mined_bsvusd);
        } else {
            tx.bsvusd = helpers.satoshisToDollars(tx.value, bsvusd);
        }
        */

        if (tx.mined_at) {
            tx.mined_in = helpers.humanReadableInterval(Math.floor(((tx.mined_at - tx.created_at) * 100)) / 100);
        }

        tx.type = type;
        tx.header = header;
        if (tx.magicnumber) {
            tx.power = helpers.countpow(tx.magicnumber, tx.target);
            powers.push({ power: tx.power, polarity: (data.BAD_EMOJIS.indexOf(tx.emoji) >= 0 ? -1 : 1)});
        }
    }


    const aggregatepower = Math.floor(helpers.aggregatepower(powers) * 100) / 100;

    return {
        aggregatepower,
        txs,
        hash,
        header,
        type,
    };
}


