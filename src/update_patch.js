const log = require("debug")("bit:scripts:patch");
const axios = require('axios');

import { wait } from "./helpers"
import { connect } from "./db"

import request from "request-promise"

import POWMarketStateMachine from "./state_machine"

import Hummingbird from "hummingbird-bitcoin"

export async function patch(txids) {
    const db = await connect();

    const result_txids = [];
    for (const txid of txids) {
        const magicnumber = await db.collection("magicnumbers").findOne({ txid });
        if (magicnumber && magicnumber.mined_txid) {
            result_txids.push(magicnumber.mined_txid);
        }
    }

    txids = Array.from(new Set(txids.concat(result_txids)));

    const heights = Array.from(new Set(await Promise.all(txids.map(async (input) => {
        const txid = input;
        let txdata = await request(`https://api.whatsonchain.com/v1/bsv/main/tx/hash/${txid}`);
        if (!txdata) {
            throw new Error(`error while fetching tx data from whatsonchain ${txdata}`);
        }

        txdata = JSON.parse(txdata);

        let blockdata = await request(`https://api.whatsonchain.com/v1/bsv/main/block/hash/${txdata.blockhash}`);
        if (!blockdata) {
            throw new Error(`error while fetching block data from whatsonchain ${blockdata}`);
        }

        blockdata = JSON.parse(blockdata);

        log(`found block height ${blockdata.height} from whatsonchain API for ${input}`);

        return Number(blockdata.height);
    })))).sort((a, b) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    });

    log(`patching heights ${heights.join(" ")}`);

    return new Promise((resolve, reject) => {
        const state_machines = [
            new POWMarketStateMachine(),
        ];

        for (const state_machine of state_machines) {
            state_machine.updating = true;
            state_machine.patching = true;
            state_machine.recursive = true;
        }

        const hum = new Hummingbird({
            rpc: { host: process.env.RPC_HOST, user: process.env.RPC_USER, pass: process.env.RPC_PASS },
            peer: { host: process.env.PEER_HOST },
            tapefile: "patching_tape.txt",
            state_machines,
        });

        hum.onconnect = async function() {
            for (const height of heights) {
                await hum.crawlblock(height);
            }

            hum.reconnect = false;
            await hum.disconnect();
            log(`finished crawling ${heights.length} heights`);
            resolve();
        };

        hum.start();
    });
}

if (require.main === module) {
    (async function() {
        const txids = process.argv.slice(2);
        patch(txids).then(() => {
            process.exit();
        });
    })();
}
