import * as timeago from "timeago.js"

import * as helpers from "./helpers"
import { connect } from "./db"

export async function dashboard(view={}, db=null) {

    if (!view.bsvusd) { throw new Error(`expected bsvusd to be able to price dashboard`) }

    const mined_num = await db.collection("magicnumbers").find({"mined": true}).count();
    const unmined_num = await db.collection("magicnumbers").find({"mined": false}).count();

    const mined_satoshis = (await (db.collection("magicnumbers").aggregate([{"$match": {mined: true}}, {"$group": {_id: null, "amount": {"$sum": "$value"}}}])).toArray())[0].amount;
    const unmined_satoshis = (await db.collection("magicnumbers").aggregate([{"$match": {mined: false}}, {"$group": {_id: null, "amount": {"$sum": "$value"}}}]).toArray())[0].amount;

    return {
        mined_num: helpers.numberWithCommas(mined_num),
        mined_earnings: helpers.satoshisToDollars(mined_satoshis, view.bsvusd),
        unmined_num: helpers.numberWithCommas(unmined_num),
        unmined_earnings: helpers.satoshisToDollars(unmined_satoshis, view.bsvusd)
    };
}


export async function mined(view={}) {
    const { bsvusd, magicnumbers } = view;

    console.log("VIEW", view);
    console.log("BSVUSD", bsvusd);
    console.log("MAGIC", magicnumbers);

    let totalpaidsats = 0;
    const mined = magicnumbers.filter(m => { return m.mined }).map(m => {
        m.display_date = timeago.format(m.created_at * 1000);
        m.display_mined_date = timeago.format((m.mined_at || m.created_at) * 1000);
        m.display_value = helpers.satoshisToDollars(m.value, bsvusd);
        totalpaidsats += m.value;
        return m;
    }).sort((a, b) => {
        if (a.mined_at > b.mined_at) { return -1 }
        if (a.mined_at < b.mined_at) { return 1 }
        if (a.created_at > b.created_at) { return -1 }
        if (a.created_at < b.created_at) { return 1 }
        return 0;
    }).slice(0, 10);

    const numminedtxs = mined.length;

    return Object.assign({}, view, {
        mined,
        numminedtxs,
        totalpaidsats,
    });
}

export async function homepage(view={}) {

    const db = await connect();

    const bsvusd = await helpers.bsvusd();
    if (!bsvusd) { throw new Error(`expected bsvusd to be able to price homepage`) }

    view.bsvusd = bsvusd;

    return Object.assign({}, view, {
        dashboard: await dashboard(view, db),
        //mined: await mined(view),
    });
}

/*
        const { bsvusd, magicnumbers } = await fetchMagicNumbers(null);

        let totalpendingsats = 0;
        let totalpaidsats = 0;
        const mined = magicnumbers.filter(m => { return m.mined }).map(m => {
            m.display_date = timeago.format(m.created_at * 1000);
            m.display_mined_date = timeago.format((m.mined_at || m.created_at) * 1000);
            m.display_value = helpers.satoshisToDollars(m.value, bsvusd);
            totalpaidsats += m.value;
            return m;
        }).sort((a, b) => {
            if (a.mined_at > b.mined_at) { return -1 }
            if (a.mined_at < b.mined_at) { return 1 }
            if (a.created_at > b.created_at) { return -1 }
            if (a.created_at < b.created_at) { return 1 }
            return 0;
        }).slice(0, 10);

        const unmined = magicnumbers.filter(m => { return !m.mined }).map(m => {
            m.display_date = timeago.format(m.created_at * 1000);
            m.display_value = helpers.satoshisToDollars(m.value, bsvusd);
            totalpendingsats += m.value;
            if (m.magicnumber.length > 10) {
                m.magicnumber = m.magicnumber.substring(0, 10) + "...";
            }
            return m;
        }).sort((a, b) => {
            if (a.created_at > b.created_at) { return -1 }
            if (a.created_at < b.created_at) { return 1 }
            return 0;
        });

        const numtxs = magicnumbers.length;
        const numminedtxs = mined.length;
        const numunminedtxs = unmined.length;


            mined,
            unmined,

            numtxs,
            numminedtxs,
            numunminedtxs,

        */