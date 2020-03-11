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

    app.get('/txid/:hash', handlers.txid);
    app.get('/mined/:hash', handlers.minedtxid);
    app.get('/magicnumber/:hash', handlers.magicnumber);
    app.get('/hash/:hash', handlers.hash);
    app.get('/target/:hash', handlers.target);

    app.get('/', handlers.homepage);
    app.get('/:hash', handlers.wildcard);

    log(`starting server at http://localhost:${port}`);

    return app.listen(port);
}

start();

