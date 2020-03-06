const log = require("debug")("pow:server");

import express from "express"

import bsv from "bsv"

import compression from "compression"
import mustacheExpress from "mustache-express"
import bodyParser from "body-parser"

import { connect } from "./db"
import * as helpers from "./helpers"

import * as views from "./views"

export async function start(port=8000) {

    const app = express();

    app.use(express.static(__dirname + "/../public"))
    app.use(compression());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    app.engine('html', mustacheExpress());
    app.set('view engine', 'html');
    app.set('views', __dirname + '/../views');

    app.get('/api/mined', async function(req, res) {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        log(`/api/mined request from ${ip}`);
        const db = await connect();
        let view = await views.dashboard({}, db);
        view = await views.mined(view, db);
        const response = helpers.apiify(view.mined);
        db.close();
        return res.json(response);
    });

    app.get('/api/unmined', async function(req, res) {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        log(`/api/unmined request from ${ip}`);
        const db = await connect();
        let view = await views.dashboard({}, db);
        view = await views.unmined(view, db);
        const response = helpers.apiify(view.unmined);
        db.close();
        return res.json(response);
    });

    app.get('/api', async function(req, res) {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        log(`/api request from ${ip}`);
        const db = await connect();
        let view = await views.dashboard({}, db);
        view = await views.all(view, db);
        const response = helpers.apiify(view.mined);
        db.close();
        return res.json(response);
    });

    app.get('/mined', async function(req, res) {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        log(`/ request from ${ip}`);
        const db = await connect();
        let view = await views.dashboard({}, db);
        view = await views.mined(view, db);
        db.close();
        res.render('mined', view);
    });

    app.get('/unmined', async function(req, res) {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        log(`/ request from ${ip}`);
        const db = await connect();
        let view = await views.dashboard({}, db);
        view = await views.unmined(view, db);
        db.close();
        res.render('unmined', view);
    });

    app.get('/', async function(req, res) {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        log(`/ request from ${ip}`);
        const homepage = await views.homepage();
        res.render('index', homepage);
    });

    log(`starting server at http://localhost:${port}`);

    return app.listen(port);
}


start();
