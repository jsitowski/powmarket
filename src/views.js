import * as timeago from "timeago.js"

import * as helpers from "./helpers"
import { connect } from "./db"

export async function dashboard(view={}, db=null) {

    if (!view.bsvusd) {
        view.bsvusd = await helpers.bsvusd();
    }

    const unmined_num = await db.collection("magicnumbers").find({"mined": false}).count();

    let mined_num = 0, mined_earnings = 0;
    const mined = await db.collection("magicnumbers").find({"mined": true}, {"value": 1, "mined_bsvusd": 1}).toArray();
    for (const m of mined) {
        mined_earnings += Number(helpers.satoshisToDollars(m.value, m.mined_bsvusd));
        mined_num += 1;
    }

    mined_earnings = Math.floor(mined_earnings * 100) / 100;
    
    const unmined_satoshis = (await db.collection("magicnumbers").aggregate([{"$match": {mined: false}}, {"$group": {_id: null, "amount": {"$sum": "$value"}}}]).toArray())[0].amount;

    return Object.assign(view, {
        "dashboard": {
            mined_num: helpers.numberWithCommas(mined_num),
            mined_earnings,
            unmined_num: helpers.numberWithCommas(unmined_num),
            unmined_earnings: helpers.satoshisToDollars(unmined_satoshis, view.bsvusd)
        }
    });
}


function processMagicNumber(m, view) {

    let bsvusd;

    if (m.mined_bsvusd) {
        bsvusd = m.mined_bsvusd;
    } else {
        bsvusd = view.bsvusd;
    }

    m.display_date = timeago.format(m.created_at * 1000);
    m.display_mined_date = timeago.format((m.mined_at || m.created_at) * 1000);
    m.display_value = helpers.satoshisToDollars(m.value, bsvusd);
    m.display_magicnumber = (m.magicnumber.length > 10 ? m.magicnumber.substr(0, 10) + "..." : m.magicnumber);
    return m;
}

export async function all(view={}, db, limit=10000) {

    if (!view.bsvusd) {
        view.bsvusd = await helpers.bsvusd();
    }

    const recentlyMined = await (db.collection("magicnumbers").find({}).sort({"created_at": -1}).limit(limit).toArray());

    view.mined = recentlyMined.map(m => {
        return processMagicNumber(m, view);
    });

    return view;
}


export async function mined(view={}, db, limit=10000) {

    if (!view.bsvusd) {
        view.bsvusd = await helpers.bsvusd();
    }

    const recentlyMined = await (db.collection("magicnumbers").find({"mined": true}).sort({"created_at": -1}).limit(limit).toArray());

    view.mined = recentlyMined.map(m => {
        return processMagicNumber(m, view);
    });

    return view;
}

export async function unmined(view={}, db, limit=10000, sortby=null) {

    if (!view.bsvusd) {
        view.bsvusd = await helpers.bsvusd();
    }

    const sort = {};
    if (sortby === "profitable") {
        sort["value"] = -1;
    } else {
        sort["created_at"] = -1;
    }

    const pending = await (db.collection("magicnumbers").find({"mined": false}).sort(sort).limit(limit).toArray());

    view.unmined = pending.map(m => {
        return processMagicNumber(m, view);
    });

    return view;
}


export async function blockviz(view={}, db) {

    const now = Math.floor((new Date()).getTime() / 1000);
    const interval = 86400 / 16;
    const num = 112;

    let before = now - (interval * num);
    const txs = await db.collection("magicnumbers").find({"created_at": {"$gte": before}}).sort({"created_at": 1}).toArray();

    let buckets = [];
    while (before < now) {

        let after = before + interval;
        let bucket = [];

        while (txs.length && (txs[0].created_at < after)) {
            const tx = txs.shift();
            bucket.push({
                mined: tx.mined,
                power: tx.magicnumber.length,
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

export async function homepage(view={}) {

    const db = await connect();

    const bsvusd = await helpers.bsvusd();
    if (!bsvusd) { throw new Error(`expected bsvusd to be able to price homepage`) }

    view.bsvusd = bsvusd;
    view = await blockviz(view, db);
    view = await dashboard(view, db);
    view = await mined(view, db, 10);
    view = await unmined(view, db, 10);

    db.close();

    return view;
}


function process({ tx, bsvusd, type, header }) {

    if (tx.mined_bsvusd) {
        tx.bsvusd = helpers.satoshisToDollars(tx.value, tx.mined_bsvusd);
    } else {
        tx.bsvusd = helpers.satoshisToDollars(tx.value, bsvusd);
    }

    tx = processMagicNumber(tx, { bsvusd });

    if (tx.mined_at) {
        tx.mined_in = helpers.humanReadableInterval(Math.floor(((tx.mined_at - tx.created_at) * 100)) / 100);
    }

    tx.type = type;
    tx.header = header;
    if (tx.mined_number) {
        tx.pow = helpers.countpow(tx.mined_number, tx.magicnumber);
    }

    if (!tx.emoji) {
        tx.emoji = null;
    }

    return tx;
}

export async function tx({ tx, hash, type, header, db }) {
    const bsvusd = await helpers.bsvusd();
    if (!bsvusd) { throw new Error(`expected bsvusd to be able to price homepage`) }

    tx = process({ tx, bsvusd, hash, type, header });

    const txs = (await db.collection("magicnumbers").find({
        "$or": [
            {"target": tx.txid},
            {"target": tx.target},
            {"target": tx.mined_number},
            {"target": tx.mined_txid},
        ]
    }).limit(10).toArray()).filter(t => {
        return t.txid !== tx.txid;
    }).map(t => {
        return process({ tx: t, bsvusd, type, hash, header });
    });

    if (txs.length > 0) {
        tx.txs = txs;
    }

    db.close();

    return tx;
}

export async function txs({ txs, hash, type, header, db }) {
    const bsvusd = await helpers.bsvusd();
    if (!bsvusd) { throw new Error(`expected bsvusd to be able to price homepage`) }

    for (let tx of txs) {
        tx = processMagicNumber(tx, { bsvusd });

        if (tx.mined_bsvusd) {
            tx.bsvusd = helpers.satoshisToDollars(tx.value, tx.mined_bsvusd);
        } else {
            tx.bsvusd = helpers.satoshisToDollars(tx.value, bsvusd);
        }

        if (tx.mined_at) {
            tx.mined_in = helpers.humanReadableInterval(Math.floor(((tx.mined_at - tx.created_at) * 100)) / 100);
        }

        tx.type = type;
        tx.header = header;
        if (tx.mined_number) {
            tx.pow = helpers.countpow(tx.mined_number, tx.magicnumber);
        }
    }

    db.close();

    return {
        txs,
        hash,
        header,
        type,
    };
}


