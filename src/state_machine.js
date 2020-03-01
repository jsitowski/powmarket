const log = require("debug")("pow:state_machine");

import Hummingbird from "hummingbird-bitcoin"

import { connect, good } from "./db"

import bsv from "bsv"

const Opcode = bsv.Opcode;

const utxos = new Set();

// from 21e8miner
function is21e8Out(script) {
    return !!(
        script.chunks.length === 12 &&
        script.chunks[0].buf &&
        script.chunks[0].buf.length === 32 &&
        script.chunks[1].buf &&
        script.chunks[1].buf.length > 1 &&
        script.chunks[2].opcodenum === Opcode.OP_SIZE &&
        script.chunks[3].opcodenum === Opcode.OP_4 &&
        script.chunks[4].opcodenum === Opcode.OP_PICK &&
        script.chunks[5].opcodenum === Opcode.OP_SHA256 &&
        script.chunks[6].opcodenum === Opcode.OP_SWAP &&
        script.chunks[7].opcodenum === Opcode.OP_SPLIT &&
        script.chunks[8].opcodenum === Opcode.OP_DROP &&
        script.chunks[9].opcodenum === Opcode.OP_EQUALVERIFY &&
        script.chunks[10].opcodenum === Opcode.OP_DROP &&
        script.chunks[11].opcodenum === Opcode.OP_CHECKSIG
    );
}

export default class POWMarketStateMachine {
    async onstart() {
        this.db = await connect();

        const pendingMagicNumbers = await this.db.collection("magicnumbers").find({ mined: false }).toArray();
        for (const magicnumber of pendingMagicNumbers) {
            const utxo = `${magicnumber.txid}:${magicnumber.vout}`;
            log(`adding pending magic number ${magicnumber.target} at utxo ${utxo}`);
            utxos.add(utxo);
        }
    }

    async ontransaction(tx) {
        const confirmed = !!tx.blk;
        const created_at = Math.floor(tx.blk ? tx.blk.t : Date.now() / 1000);

        for (const input of tx.in) {
            const utxo = `${input.e.h}:${input.e.i}`;

            if (utxos.has(utxo)) {
                const asm = input.str;
                const script = bsv.Script.fromASM(asm);
                const presig = script.chunks[0].buf;
                const hash = bsv.crypto.Hash.sha256(presig).toString("hex");

                log(`🌟 r-puzzle mined ${hash} at ${tx.tx.h}`);

                const response = await this.db.collection("magicnumbers").updateOne({
                    "txid": input.e.h,
                    "vout": input.e.i,
                }, {
                    "$set": {
                        mined: true,
                        mined_number: hash,
                        mined_txid: tx.tx.h,
                        mined_address: input.e.a,
                    }
                });

                if (!good(response)) {
                    console.log(response);
                    throw new Error(`error while processing r-puzzle solution ${tx.tx.h}`);
                }

                utxos.delete(utxo);
            }
        }

        let vout = 0;
        for (const out of tx.out) {
            const script = bsv.Script.fromASM(out.str); // TODO: slow
            if (is21e8Out(script)) {
                const value = out.e.v;
                const txid = tx.tx.h;
                const parts = out.str.split(" "); // TODO: use script
                const target = parts[0];
                const magicnumber = parts[1];

                try {
                    await this.db.collection("magicnumbers").insertOne({
                        txid,
                        vout,
                        from: tx.in[0].e.a,
                        value,
                        confirmed,
                        magicnumber,
                        target,
                        mined: false,
                        created_at,
                    });

                    const utxo = `${txid}:${vout}`;
                    if (confirmed) {
                        log(`inserted confirmed magic number into the pool ${txid}`);
                        utxos.add(utxo);
                    } else {
                        log(`inserted new magic number into the pool ${txid}`);
                    }
                } catch (e) {
                    log(`already added ${tx.tx.h}`);

                    if (confirmed) {
                        await this.db.collection("magicnumbers").updateOne({ txid }, {
                            "$set": {
                                confirmed: true
                            }
                        });
                    }
                }
            }

            vout += 1;
        }

        return true;
    }

    async onrealtime() {
        log("block processing has caught up");
    }
}

if (require.main === module) {
    const hummingbird = new Hummingbird({
        rpc: { host: process.env.RPC_HOST, user: process.env.RPC_USER, pass: process.env.RPC_PASS },
        peer: { host: process.env.PEER_HOST },
        from: 624058,
        state_machines: [
            new POWMarketStateMachine(),
        ],
    });

    hummingbird.start();
}
