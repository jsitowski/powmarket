import * as timeago from "timeago.js"

import * as helpers from "./helpers"
import { connect } from "./db"

export async function dashboard(view={}, db=null) {

    if (!view.bsvusd) {
        view.bsvusd = await helpers.bsvusd();
    }

    const mined_num = await db.collection("magicnumbers").find({"mined": true}).count();
    const unmined_num = await db.collection("magicnumbers").find({"mined": false}).count();

    const mined_satoshis = (await (db.collection("magicnumbers").aggregate([{"$match": {mined: true}}, {"$group": {_id: null, "amount": {"$sum": "$value"}}}])).toArray())[0].amount;
    const unmined_satoshis = (await db.collection("magicnumbers").aggregate([{"$match": {mined: false}}, {"$group": {_id: null, "amount": {"$sum": "$value"}}}]).toArray())[0].amount;

    return Object.assign(view, {
        "dashboard": {
            mined_num: helpers.numberWithCommas(mined_num),
            mined_earnings: helpers.satoshisToDollars(mined_satoshis, view.bsvusd),
            unmined_num: helpers.numberWithCommas(unmined_num),
            unmined_earnings: helpers.satoshisToDollars(unmined_satoshis, view.bsvusd)
        }
    });
}


function processMagicNumber(m, view) {
    m.display_date = timeago.format(m.created_at * 1000);
    m.display_mined_date = timeago.format((m.mined_at || m.created_at) * 1000);
    m.display_value = helpers.satoshisToDollars(m.value, view.bsvusd);
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


export async function tx({ tx, txid, type, header }) {
    const bsvusd = await helpers.bsvusd();
    if (!bsvusd) { throw new Error(`expected bsvusd to be able to price homepage`) }

    tx.bsvusd = helpers.satoshisToDollars(tx.value, bsvusd);

    tx = processMagicNumber(tx, { bsvusd });

    if (tx.mined_at) {
        tx.mined_in = helpers.humanReadableInterval(Math.floor(((tx.mined_at - tx.created_at) * 100)) / 100);
    }

    tx.type = type;
    tx.header = header;
    if (tx.mined_number) {
        tx.pow = helpers.countpow(tx.mined_number, tx.magicnumber);
    }

    return tx;
}

export async function txs({ txs, hash, type, header }) {
    const bsvusd = await helpers.bsvusd();
    if (!bsvusd) { throw new Error(`expected bsvusd to be able to price homepage`) }

    for (let tx of txs) {
        tx = processMagicNumber(tx, { bsvusd });

        tx.bsvusd = helpers.satoshisToDollars(tx.value, bsvusd);

        if (tx.mined_at) {
            tx.mined_in = helpers.humanReadableInterval(Math.floor(((tx.mined_at - tx.created_at) * 100)) / 100);
        }

        tx.type = type;
        tx.header = header;
        if (tx.mined_number) {
            tx.pow = helpers.countpow(tx.mined_number, tx.magicnumber);
        }
    }

    return {
        txs,
        hash,
        header,
        type,
    };
}


export async function hash({ input }) {
    const db = await connect();

    const bsvusd = await helpers.bsvusd();
    if (!bsvusd) { throw new Error(`expected bsvusd to be able to price homepage`) }

    const view = {
        hash: input,
    };

    db.close();
    return view;
}
