const log = require("debug")("pow:handlers");

import bsv from "bsv"

import * as helpers from "./helpers"
import * as data from "./data"
import * as views from "./views"
import * as database from "./db"

export const api = {};

const DEFAULT_SORT = {"mined_at": -1, "created_at": -1};

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
    if (!tx) { return res.render("404") }

    return res.render('tx', await views.tx(Object.assign(tx, {type: "TXID", header: tx.txid })));
}

export async function minedtxid(req, res) {
    const hash = req.params.hash;
    log(`/mined/${hash} request from ${helpers.getip(req)}`);

    let tx = await database.db.collection("magicnumbers").findOne({"mined_txid": hash});

    if (!tx) { return res.render("404") }

    return res.render('tx', await views.tx(Object.assign(tx, {type: "Mined TXID", header: tx.mined_txid })));
}

export async function magicnumber(req, res) {
    const hash = req.params.hash;
    log(`/magicnumber/${hash} request from ${helpers.getip(req)}`);

    let tx = await database.db.collection("magicnumbers").findOne({"magicnumber": hash});

    if (!tx) { return res.render("404") }

    return res.render('tx', await views.tx(Object.assign(tx, {type: "Magic Number", header: tx.magicnumber })));
}

export async function hash(req, res) {
    const hash = req.params.hash;
    log(`/hash/${hash} request from ${helpers.getip(req)}`);

    let offset = getoffset(req);
    let limit = getlimit(req);

    let txs = await database.db.collection("magicnumbers").find({"hash": hash}).sort(DEFAULT_SORT).skip(offset).limit(limit).toArray();

    if (!txs) { return res.render("404") }

    let dashboard = (await database.db.collection("magicnumbers").aggregate([{"$match": {"hash": hash}}, {"$sort": DEFAULT_SORT}, {"$group": {
        _id: null,
        "total_power": {"$sum": "$power"},
        "total_numbers": {"$sum": 1},
    }}]).toArray())[0];

    const view = await views.txs(Object.assign({ txs }, { type: "Hash", header: hash, offset, limit }));

    view.total_power = dashboard.total_power;
    view.total_numbers = dashboard.total_numbers;

    view.display_total_power = data.processDisplayForPower(dashboard.total_power);
    view.display_total_numbers = helpers.numberWithCommas(dashboard.total_numbers);

    if (view.txs.length === view.limit) {
        view.show_more = true;
        view.next_offset = view.offset + view.limit;
    }

    return res.render('txs', view);
}

export async function target(req, res) {
    const hash = req.params.hash;
    log(`/target/${hash} request from ${helpers.getip(req)}`);

    let offset = getoffset(req);
    let limit = getlimit(req);

    let txs = await database.db.collection("magicnumbers").find({"target": hash}).sort(DEFAULT_SORT).skip(offset).limit(limit).toArray();
    if (!txs) { return res.render("404") }

    let dashboard = (await database.db.collection("magicnumbers").aggregate([{"$match": {"target": hash}}, {"$sort": DEFAULT_SORT}, {"$group": {
        _id: null,
        "total_power": {"$sum": "$power"},
        "total_numbers": {"$sum": 1},
    }}]).toArray())[0];

    const view = await views.txs(Object.assign({ txs }, { type: "Target", header: hash, offset, limit }));

    view.total_power = dashboard.total_power;
    view.total_numbers = dashboard.total_numbers;

    view.display_total_power = data.processDisplayForPower(dashboard.total_power);
    view.display_total_numbers = helpers.numberWithCommas(dashboard.total_numbers);

    if (view.txs.length === view.limit) {
        view.show_more = true;
        view.next_offset = view.offset + view.limit;
    }

    return res.render('txs', view);
}


export async function wildcard(req, res) {
    let hash = req.params.hash;
    log(`/${hash} request from ${helpers.getip(req)}`);

    let tx = await database.db.collection("magicnumbers").findOne({"txid": hash});
    if (tx) {
        return res.redirect(`/txid/${hash}`);
    }

    tx = await database.db.collection("magicnumbers").findOne({"mined_txid": hash});
    if (tx) {
        return res.redirect(`/mined/${hash}`);
    }

    tx = await database.db.collection("magicnumbers").findOne({"magicnumber": hash});
    if (tx) {
        return res.redirect(`/magicnumber/${hash}`);
    }

    tx = await database.db.collection("magicnumbers").findOne({"hash": hash});
    if (tx) {
        return res.redirect(`/hash/${hash}`);
    }

    tx = await database.db.collection("magicnumbers").findOne({"target": hash});
    if (tx) {
        return res.redirect(`/target/${hash}`);
    }

    // let's try to sha256 and see if that matches anything
    hash = bsv.crypto.Hash.sha256(Buffer.from(hash)).toString("hex");
    tx = await database.db.collection("magicnumbers").findOne({"hash": hash});
    if (tx) {
        return res.redirect(`/hash/${hash}`);
    }

    return res.render("404");
}


