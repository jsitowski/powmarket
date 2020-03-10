const log = require("debug")("pow:helpers");

export function satoshisToDollars(satoshis, bsvprice) {
    if (satoshis < 0) {
        return null;
    }

    if ((!bsvprice && bsvprice !== 0) || isNaN(bsvprice) || bsvprice < 0) {
        return null;
    }

    var val = ((satoshis / 100000000.0) * bsvprice).toLocaleString("en-US", {'minimumFractionDigits':2, 'maximumFractionDigits':2});

    if (val == "0.00" || val == "0.01") {
        val = ((satoshis / 100000000.0) * bsvprice).toLocaleString("en-US", {'minimumFractionDigits':3, 'maximumFractionDigits':3});

        // ends in 0
        if (val.length == 5 && val[4] == "0") {
            val = val.slice(0, 4);
        }
    }

    if (isNaN(val) && isNaN(val.replace(",", ""))) {
        return null;
    }

    return val;
}

let cryptocompare_price_timeout = 0;
let cryptocompare_expire = 60 * 10;
let cryptocompare_price = null;

export async function bsvusd() {

    return new Promise((resolve, reject) => {

        const now = Math.floor(Date.now() / 1000);
        const diff = now - cryptocompare_price_timeout;
        if (diff >= cryptocompare_expire) {
            log(`cache busting backup bsvusd price`);
            cryptocompare_price_timeout = now;
        } else {
            if (cryptocompare_price !== null) {
                log(`using cached BSVUSD price of ${cryptocompare_price} from cryptocompare API for ${cryptocompare_expire - diff} more seconds`);
                resolve(cryptocompare_price);
                return;
            }
        }

        const url = "https://min-api.cryptocompare.com/data/price?fsym=BSV&tsyms=USD&api_key=d78f5c433def7aae505eb702a4040508a5741f612e8038e5581c8302054a2f15";

        const https = require('https');

        https.get(url, (resp) => {
            log(`live hitting cryptocompare API for bsvusd price`);

            let data = '';

            // A chunk of data has been recieved.
            resp.on('data', (chunk) => {
                data += chunk;
            });

            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                try {
                    const obj = JSON.parse(data);
                    if (!obj || !obj.USD) {
                        throw new Error(`invalid bsvusd price data object from cryptocompare ${data}`);
                    }

                    const num = Number(obj.USD);
                    if (isNaN(num)) {
                        throw new Error(`invalid bsvusd price data returned from cryptocompare ${num}`);
                    }

                    log(`fetched BSVUSD price ${num} from cryptocompare API`);
                    cryptocompare_price = num;

                    resolve(num);
                } catch (e) {
                    reject(`error while parsing cryptocompare price data ${e.message}`);
                }
            });

        }).on("error", (err) => {
            reject(`error while fetching cryptocompare price data ${err.message}`);
        });
    });
}

export async function wait(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export function stripid(results) {
    return results.map(result => {
        delete result["_id"];
        return result;
    });
}

export function apiify(results) {
    return results.map(result => {
        delete result["_id"];
        delete result["display_date"];
        delete result["display_mined_date"];
        delete result["display_value"];
        delete result["display_magicnumber"];
        return result;
    });
}

export async function magicnumbers(query={}, sort=null, db=null) {
    if (sort=null) {
        sort = {"mined_at": -1, "created_at": -1};
    }

    return await db.collection("magicnumbers").find(query).sort(sort).toArray();
}

export function numberFormat(number, length=3) {
    if (number > 0) {
        const val = number.toLocaleString("en-US", {'minimumFractionDigits':2, 'maximumFractionDigits':length});
        return val;
    } else {
        return "0";
    }
}

export function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function countpow(hash, target) {
    if (hash.length == 64 && target && hash.indexOf(target) === 0) {
        const letters = hash.split("");
        for (var i = 0; i < target.length; i++) {
            letters.shift();
        }

        let pow = 0;
        let letter = 0;
        while (letter = letters.shift()) {
            if (letter === "0") { pow++ }
            else { break }
        }

        return target.length + pow;
    }

    return 0;
}

export function humanReadableInterval(inputSeconds) {
    const days = Math.floor( inputSeconds / (60 * 60 * 24) );
    const hour = Math.floor((inputSeconds % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor(((inputSeconds % (60 * 60 * 24)) % (60 * 60)) / 60 );
    const seconds = Math.floor(((inputSeconds % (60 * 60 * 24)) % (60 * 60)) % 60 );
    const parts = [];

    if (days > 0){
        parts.push(days + ' day' + (days > 1 ? 's': ''));
    }
    if (hour > 0){
        parts.push(hour + ' hour' + (hour > 1 ? 's': ''));
    }

    if (minutes > 0){
        parts.push(minutes + ' minute' + (minutes > 1 ? 's' : ''));
    }

    if (seconds > 0){
        parts.push(seconds + ' seconds' + (seconds > 1 ? 's': ''));
    }

    return parts.join(" ");
}
