const log = require("debug")("pow:handlers");

import * as helpers from "./helpers"
import * as data from "./data"

export const api = {};

async function handleResults(req, query={}) {
    let offset = Number(req.param("offset"));
    if (isNaN(offset)) { offset = 0 }

    let limit = Number(req.param("limit"));
    if (!limit || isNaN(limit) || limit < 0 || limit > 100) {
        limit = 100;
    }

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
    res.json(Object.assign(await handleResults(req, {"mined": true}), { "type": "mined" }));
}
