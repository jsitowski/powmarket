const log = require("debug")("pow:server");

import express from "express"

import bsv from "bsv"

import compression from "compression"
import mustacheExpress from "mustache-express"
import bodyParser from "body-parser"

import * as database from "./db"
import * as helpers from "./helpers"
import * as views from "./views"
import * as data from "./data"

import * as handlers from "./handlers"

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

    app.get('/api/mined', handlers.api.mined);
    app.get('/api/unmined', handlers.api.unmined);
    app.get('/api', handlers.api.all);

    app.get('/mined', handlers.mined);
    app.get('/unmined', handlers.unmined);


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

    app.get('/', handlers.homepage);

    log(`starting server at http://localhost:${port}`);

    return app.listen(port);
}

start();

