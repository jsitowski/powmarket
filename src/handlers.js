const log = require("debug")("pow:handlers");

import * as helpers from "./helpers"
import * as data from "./data"
import * as views from "./views"

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
    res.render('mined', await views.mined({ limit, offset }));
}

export async function unmined(req, res) {
    log(`/unmined request from ${helpers.getip(req)}`);
    let offset = getoffset(req);
    let limit = getlimit(req);
    res.render('unmined', await views.unmined({ limit, offset }));
}

export async function homepage(req, res) {
    log(`/ request from ${helpers.getip(req)}`);
    res.render('index', await views.homepage());
}

