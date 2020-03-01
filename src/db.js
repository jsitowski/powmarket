const log = require("debug")("pow:db");

const MongoClient = require("mongodb");

export function connect() {
    return new Promise((resolve, reject) => {
        MongoClient.connect("mongodb://localhost:27017", { useNewUrlParser: true, useUnifiedTopology: true }, function(err, client) {
            if (err) {
                setTimeout(function() {
                    log("retrying...");
                    connect().then(resolve);
                }, 1000);
            } else {
                log(`connected to powmarket`);
                const db = client.db("powmarket");
                db.close = function() { return client.close() }
                resolve(db);
            }
        });
    });
};

export function ok(response) {
    if (!response) return false;
    if (!response.result) return false;
    if (!response.result.ok) return false;
    return true;
}

export function good(response) {
    if (!response) return false;
    if (!response.result) return false;
    if (!response.result.ok) return false;
    if (response.result.n !== 1) return false;
    return true;
}

export function updated(response) {
    if (!response) return false;
    if (!response.result) return false;
    if (!response.result.ok) return false;
    if (response.result.n !== 1) return false;
    if (response.result.nModified !== 1) return false;
    return true;
}


export function dupe(e, keys=[]) {
    if (e.name !== "MongoError") {
        //console.log("wrong error during dupe", JSON.stringify(e, null, 4), keys);
        return false;
    }
    if (e.code !== 11000) {
        //console.log("wrong error code during dupe", JSON.stringify(e, null, 4), keys);
        return false;
    }

    if (e.keyPattern) {
        for (const key of keys) {
            if (!e.keyPattern[key]) {
                //console.log("wrong key pattern", key, "in keyPattern during dupe", JSON.stringify(e, null, 4), keys);
                return false;
            }
        }
    } else {
        for (const key of keys) {
            if (e.errmsg.indexOf(key) == -1) {
                //console.log("wrong key pattern", key, "in errmsg during dupe", JSON.stringify(e, null, 4), keys);
                return false;
            }
        }
    }

    return true;
}

