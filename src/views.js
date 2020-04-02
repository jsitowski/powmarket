import * as timeago from "timeago.js"

import * as helpers from "./helpers"
import * as data from "./data"
import * as database from "./db"

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
    if (!database.db) { throw new Error("expected db") }
    if (!view.bsvusd) { view.bsvusd = await helpers.bsvusd() }
    if (!view.dashboard) { view = await dashboard(view) }
    const mined = await data.results(Object.assign({}, view, {"mined": true, "sort": {"mined_at": -1}}));
    view.mined = await Promise.all(mined.map(async (m) => { return await data.processDisplayForMagicNumber(m, view)}));
    return view;
}

export async function unmined(view={}) {
    if (!database.db) { throw new Error("expected db") }
    if (!view.bsvusd) { view.bsvusd = await helpers.bsvusd() }
    if (!view.dashboard) { view = await dashboard(view) }
    const unmined = await data.results(Object.assign({}, view, {"mined": false}));
    view.unmined = await Promise.all(unmined.map(async (m) => {
        return await data.processDisplayForMagicNumber(Object.assign(m, view));
    }));
    return view;
}

export async function best(view={}) {
    if (!database.db) { throw new Error("expected db") }

    let txs = await database.db.collection("magicnumbers").aggregate([
        {
            "$sort": {"power": -1, "mined_at": -1, "created_at": -1}
        },
    ]).toArray();

    const limit = 20;
    const hashes = {};
    const magicnumbers = {};
    const targets = {};

    function bypower(a, b) {
        if (a[1] > b[1]) { return -1 }
        if (a[1] < b[1]) { return 1 }
        return 0;
    }

    for (const tx of txs) {
        const power = tx.power || 0;

        if (hashes[tx.hash]) {
            hashes[tx.hash] += power;
        } else {
            hashes[tx.hash] = power;
        }

        if (targets[tx.target]) {
            targets[tx.target] += power;
        } else {
            targets[tx.target] = power;
        }

        if (tx.magicnumber) {
            if (magicnumbers[tx.magicnumber]) {
                magicnumbers[tx.magicnumber] += power;
            } else {
                magicnumbers[tx.magicnumber] = power;
            }
        }
    }

    const sortedHashes = Object.entries(hashes).sort(bypower);
    const sortedTargets = Object.entries(targets).sort(bypower);
    const sortedMagicNumbers = Object.entries(magicnumbers).sort(bypower);

    function process(arr) {
        arr[1] = data.processDisplayForPower(arr[1]);
        const emojicode = data.isEmojiMagicNumber(arr[0]);
        if (emojicode) {
            const emoji = String.fromCodePoint(`0x${emojicode}`);
            arr[2] = emoji;
        }
        return arr;
    }

    view.worst = {
        hashes: sortedHashes.filter(arr => { return arr[1] < 0 }).slice(limit * -1).map(process),
        targets: sortedTargets.filter(arr => { return arr[1] < 0 }).slice(limit * -1).map(process),
        magicnumbers: sortedMagicNumbers.filter(arr => { return arr[1] < 0 }).slice(limit * -1).map(process),
    };


    view.best = {
        hashes: sortedHashes.slice(0, limit).map(process),
        targets: sortedTargets.slice(0, limit).map(process),
        magicnumbers: sortedMagicNumbers.slice(0, limit).map(process),
    };
    
    return view;
}

export async function homepage(view={}) {
    if (!database.db) { throw new Error("expected db") }

    const bsvusd = await helpers.bsvusd();
    if (!bsvusd) { throw new Error(`expected bsvusd to be able to price homepage`) }

    view.bsvusd = bsvusd;
    view.limit = 10;

    const views = [blockviz, dashboard, mined, unmined, best];
    for (const viewhandler of views) {
        view = await viewhandler(view);
    }

    return view;
}


export async function tx(view={}) {
    if (!database.db) { throw new Error("expected db") }
    if (!view.bsvusd) {
        view.bsvusd = await helpers.bsvusd();
    }

    view = await data.processDisplayForMagicNumber(view);

    const query = {
        "$or": [
            {"hash": view.txid},
            {"hash": view.magicnumber},
            {"hash": view.mined_txid},
        ]
    };

    let txs = await database.db.collection("magicnumbers").find(query).limit(10).toArray();

    txs = await Promise.all(txs.filter(t => {
        return t.txid !== view.txid;
    }).map(async (t) => {
        return await data.processDisplayForMagicNumber(t, { bsvusd: view.bsvusd });
    }));

    if (txs.length > 0) {
        view.txs = txs;
        for (const t of txs) { view.power += t.power }
        view.display_power = data.processDisplayForPower(view.power);
    }

    return view;
}

export async function txs(view={}) {
    if (!database.db) { throw new Error("expected db") }
    if (!view.bsvusd) {
        view.bsvusd = await helpers.bsvusd();
    }

    for (let tx of view.txs) {
        tx = await data.processDisplayForMagicNumber(tx, { bsvusd: view.bsvusd });
    }

    return view;
}

