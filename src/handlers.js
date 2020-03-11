const log = require("debug")("pow:handlers");

import * as helpers from "./helpers"
import * as data from "./data"
import * as views from "./views"
import * as database from "./db"

export const api = {};


function getoffset(req) {
    let offset = Number(req.param("offset"));
    if (isNaN(offset)) { offset = 0 }
    return offset;
}

function getlimit(req) {
    let limit = Number(req.param("limit"));
    if (!limit || isNaN(limit) || limit < 0 || limit > 100) {
        limit = 100;
    }

    return limit;
}

async function handleResults(req, query={}) {
    let offset = getoffset(req);
    let limit = getlimit(req);

    let bsvusd = await helpers.bsvusd();

    let magicnumbers = await data.results(Object.assign({}, query, { offset, limit }));

    return {
        offset,
        limit,
        bsvusd,
        magicnumbers
    };
}

api.all = async function(req, res) {
    log(`/api request from ${helpers.getip(req)}`);
    res.json(Object.assign(await handleResults(req), { "type": "all" }));
}

api.unmined = async function(req, res) {
    log(`/api/unmined request from ${helpers.getip(req)}`);
    res.json(Object.assign(await handleResults(req, {"mined": false}), { "type": "unmined" }));
}

api.mined = async function(req, res) {
    log(`/api/mined request from ${helpers.getip(req)}`);
    res.json(Object.assign(await handleResults(req, {"mined": true, "sort": {"mined_at": -1}}), { "type": "mined" }));
}

export async function mined(req, res) {
    log(`/mined request from ${helpers.getip(req)}`);
    let offset = getoffset(req);
    let limit = getlimit(req);
    const view = await views.mined({ limit, offset });
    if (view.mined.length === view.limit) {
        view.show_more = true;
        view.next_offset = view.offset + view.limit;
    }
    res.render('mined', view);
}

export async function unmined(req, res) {
    log(`/unmined request from ${helpers.getip(req)}`);
    let offset = getoffset(req);
    let limit = getlimit(req);
    const view = await views.unmined({ limit, offset });
    if (view.unmined.length === view.limit) {
        view.show_more = true;
        view.next_offset = view.offset + view.limit;
    }
    res.render('unmined', view);
}

export async function homepage(req, res) {
    log(`/ request from ${helpers.getip(req)}`);
    res.render('index', await views.homepage());
}


export async function txid(req, res) {
    const hash = req.params.hash;
    log(`/txid/${hash} request from ${helpers.getip(req)}`);

    let tx = await database.db.collection("magicnumbers").findOne({"txid": hash});
    if (!tx) {
        return res.render("404");
    }

    return res.render('tx', await views.tx(Object.assign(tx, {type: "TXID", header: tx.txid })));
}

export async function minedtxid(req, res) {
    const hash = req.params.hash;
    log(`/mined/${hash} request from ${helpers.getip(req)}`);

    let tx = await database.db.collection("magicnumbers").findOne({"mined_txid": hash});

    if (!tx) {
        return res.render("404");
    }

    return res.render('tx', await views.tx(Object.assign(tx, {type: "Mined TXID", header: tx.mined_txid })));
}

export async function hash(req, res) {
    const hash = req.params.hash;
    log(`/${hash} request from ${helpers.getip(req)}`);

    let tx = await database.db.collection("magicnumbers").findOne({"txid": hash});
    if (tx) {
        return res.redirect(`/txid/${hash}`);
    }

    tx = await db.collection("magicnumbers").findOne({"mined_txid": hash});
    if (tx) {
        return res.redirect(`/mined/${hash}`);
    }

    return res.render("404");

    /*
    app.get('/:hash', async function(req, res) {
        const hash = req.params.hash;
        log(`/${hash} request from ${getip(req)}`);


        tx = await db.collection("magicnumbers").findOne({"magicnumber": hash});
        if (tx) {
            return res.render('tx', await views.tx({ tx, hash, type: "Magic Number", header: tx.magicnumber, db }));
        }

        let txs = await db.collection("magicnumbers").find({"hash": hash}).toArray();
        if (txs.length > 0) {
            return res.render('txs', await views.txs({ txs, hash, type: "Hash", header: hash, db }));
        }

        txs = await db.collection("magicnumbers").find({"target": hash}).toArray();
        if (txs.length > 0) {
            return res.render('txs', await views.txs({ txs, hash, type: "Target", header: hash, db }));
        }

        res.render('404');
    });
    */

}
