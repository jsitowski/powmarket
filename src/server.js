const log = require("debug")("pow:server");

import express from "express"

import bsv from "bsv"

import compression from "compression"
import mustacheExpress from "mustache-express"
import bodyParser from "body-parser"

import { connect } from "./db"
let database = require("./db");

import * as helpers from "./helpers"

import * as views from "./views"

function getip(req) {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
}

export async function start(port=8000) {

    database.db = await database.connect();
    const db = database.db;

    const app = express();

    app.use(express.static(__dirname + "/../public"))
    app.use(compression());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    app.engine('html', mustacheExpress());
    app.set('view engine', 'html');
    app.set('views', __dirname + '/../views');

    app.get('/api/mined', async function(req, res) {
        log(`/api/mined request from ${getip(req)}`);
        let view = await views.mined(await views.dashboard());
        const response = helpers.apiify(view.mined);
        return res.json({
            bsvusd: view.bsvusd,
            magicnumbers: response
        });
    });

    app.get('/api/unmined', async function(req, res) {
        log(`/api/unmined request from ${getip(req)}`);
        let view = await views.unmined(await views.dashboard());
        const response = helpers.apiify(view.unmined);
        return res.json({
            bsvusd: view.bsvusd,
            magicnumbers: response
        });
    });

    app.get('/api', async function(req, res) {
        log(`/api request from ${getip(req)}`);
        let view = await views.all(await views.dashboard());
        const response = helpers.apiify(view.mined);
        return res.json({
            bsvusd: view.bsvusd,
            magicnumbers: response
        });
    });

    app.get('/mined', async function(req, res) {
        log(`/mined request from ${getip(req)}`);
        let view = await views.mined();
        res.render('mined', view);
    });

    app.get('/unmined', async function(req, res) {
        log(`/unmined request from ${getip(req)}`);
        let view = await views.unmined();
        res.render('unmined', view);
    });

    app.get('/:hash', async function(req, res) {
        const hash = req.params.hash;
        log(`/${hash} request from ${getip(req)}`);

        let tx = await db.collection("magicnumbers").findOne({"txid": hash});
        if (tx) {
            return res.render('tx', await views.tx({ tx, hash, type: "TXID", header: tx.txid, db }));
        }

        tx = await db.collection("magicnumbers").findOne({"mined_txid": hash});
        if (tx) {
            return res.render('tx', await views.tx({ tx, hash, type: "Mined TXID", header: tx.mined_txid, db }));
        }

        tx = await db.collection("magicnumbers").findOne({"mined_number": hash});
        if (tx) {
            return res.render('tx', await views.tx({ tx, hash, type: "Magic Number", header: tx.mined_number, db }));
        }

        let txs = await db.collection("magicnumbers").find({"target": hash}).toArray();
        if (txs.length > 0) {
            return res.render('txs', await views.txs({ txs, hash, type: "Hash", header: hash, db }));
        }

        txs = await db.collection("magicnumbers").find({"magicnumber": hash}).toArray();
        if (txs.length > 0) {
            return res.render('txs', await views.txs({ txs, hash, type: "Target", header: hash, db }));
        }

        res.render('404');
    });

    app.get('/', async function(req, res) {
        log(`/ request from ${getip(req)}`);
        res.render('index', await views.homepage());
    });

    log(`starting server at http://localhost:${port}`);

    return app.listen(port);
}


start();
