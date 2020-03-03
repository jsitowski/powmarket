const log = require("debug")("pow:server");

import express from "express"

import bsv from "bsv"

import compression from "compression"
import mustacheExpress from "mustache-express"
import bodyParser from "body-parser"
import * as timeago from "timeago.js"

import { connect } from "./db"
import * as helpers from "./helpers"

export async function start(port=8000) {

    const app = express();

    app.use(express.static(__dirname + "/../public"))
    app.use(compression());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    app.engine('html', mustacheExpress());
    app.set('view engine', 'html');
    app.set('views', __dirname + '/../views');

    async function fetchMagicNumbers(type) {
        const bsvusd = await helpers.backup_bsvusd();

        const db = await connect();

        const query = {};
        if (type === "mined") {
            query["mined"] = true;
        } else if (type === "unmined") {
            query["mined"] = false;
        }

        const magicnumbers = helpers.stripid(await db.collection("magicnumbers").find(query).sort({"mined_at": -1, "created_at": -1}).limit(10000).toArray());

        db.close();

        return {
            bsvusd,
            magicnumbers,
        };
    }


    app.get('/api/mined', async function(req, res) {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        log(`/api/mined request from ${ip}`);
        return res.json(await fetchMagicNumbers("mined"));
    });

    app.get('/api/unmined', async function(req, res) {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        log(`/api/unmined request from ${ip}`);
        return res.json(await fetchMagicNumbers("unmined"));
    });

    app.get('/api', async function(req, res) {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        log(`/api request from ${ip}`);
        return res.json(await fetchMagicNumbers(null));
    });

    app.get('*', async function(req, res) {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        log(`/ request from ${ip}`);

        const { bsvusd, magicnumbers } = await fetchMagicNumbers(null);

        const mined = magicnumbers.filter(m => { return m.mined }).map(m => {
            m.display_date = timeago.format(m.created_at * 1000);
            m.display_mined_date = timeago.format((m.mined_at || m.created_at) * 1000);
            m.display_value = helpers.satoshisToDollars(m.value, bsvusd);
            return m;
        }).sort((a, b) => {
            if (a.mined_at > b.mined_at) { return -1 }
            if (a.mined_at < b.mined_at) { return 1 }
            if (a.created_at > b.created_at) { return -1 }
            if (a.created_at < b.created_at) { return 1 }
            return 0;
        });
        const unmined = magicnumbers.filter(m => { return !m.mined }).map(m => {
            m.display_date = timeago.format(m.created_at * 1000);
            m.display_value = helpers.satoshisToDollars(m.value, bsvusd);
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

        res.render('index', {
            bsvusd,

            mined,
            unmined,

            numtxs,
            numminedtxs,
            numunminedtxs,
        });
    });

    log(`starting server at http://localhost:${port}`);

    return app.listen(port);
}


start();
