import * as timeago from "timeago.js"

import * as helpers from "./helpers"
import { connect } from "./db"

export async function dashboard(view={}, db=null) {

    if (!view.bsvusd) { throw new Error(`expected bsvusd to be able to price dashboard`) }

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

export async function mined(view={}, db) {

    if (!view.bsvusd) { throw new Error(`expected bsvusd to be able to price mined`) }

    const recentlyMined = await (db.collection("magicnumbers").find({"mined": true}).sort({"created_at": -1}).limit(10).toArray());

    view.mined = recentlyMined.map(m => {
        return processMagicNumber(m, view);
    });

    return view;
}

export async function unmined(view={}, db) {

    if (!view.bsvusd) { throw new Error(`expected bsvusd to be able to price mined`) }

    const pending = await (db.collection("magicnumbers").find({"mined": false}).sort({"value": -1}).limit(10).toArray());

    view.unmined = pending.map(m => {
        return processMagicNumber(m, view);
    });

    return view;
}

export async function blockviz(view={}, db) {

    const now = Math.floor((new Date()).getTime() / 1000);
    const interval = 86400 / 16;
    const num = 112;
    const earliest_time = now - (interval * num);
    const txs = await db.collection("magicnumbers").find({"created_at": {"$gte": earliest_time}}).sort({"created_at": 1}).toArray();


    let buckets = [], bucket = [];
    let before = earliest_time;
    let after = earliest_time + interval;

    for (const tx of txs) {
        const created_at = tx.created_at;
        const inside = created_at >= before && created_at <= after;
        if (inside) {
            bucket.push({
                mined: tx.mined,
                power: tx.magicnumber.length,
            });
        } else {
            if (bucket.length > 0) {
                buckets.push(bucket);
                bucket = [];
            }
            before = after;
            after += interval
        }
    }

    if (bucket.length > 0) {
        buckets.push(bucket);
        bucket = [];
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
    view = await mined(view, db);
    view = await unmined(view, db);

    return view;
}

