const log = require("debug")("bit:scripts:patch");
const axios = require('axios');

import { wait } from "./helpers"
import { connect } from "./db"

import request from "request-promise"

import POWMarketStateMachine from "./state_machine"

import Hummingbird from "hummingbird-bitcoin"

export async function patch(inputs) {
    const db = await connect();

    const heights = await Promise.all(inputs.map(async (input) => {
        if (input.indexOf(":") > -1) {
            const [txid, vout] = input.split(":");
            log(`can't find utxo ${txid}:${vout} locally...checking external API`);
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

            log(`found block height ${blockdata.height} from whatsonchain API for utxo ${input}`);

            return Number(blockdata.height);
        } else {
            return Number(input);
        }
    }));

    log(`patching heights ${heights.join(" ")}`);

    return new Promise((resolve, reject) => {
        const state_machines = [
            new POWMarketStateMachine(),
        ];

        for (const state_machine of state_machines) {
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
        const heights = process.argv.slice(2);
        patch(heights).then(() => {
            process.exit();
        });
    })();
}
