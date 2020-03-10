const log = require("debug")("pow:state_machine");

import Hummingbird from "hummingbird-bitcoin"

import { connect, good, dupe } from "./db"

import * as helpers from "./helpers"

import bsv from "bsv"

const Opcode = bsv.Opcode;

const utxos = new Set();

// Allow any emoji? Any is technically allowed...but how do we make sense of them?
const emojis = ["👍", "👎", "🙏", "💥", "❤️", "🔥", "🤪", "😠", "🤔", "😂", ];

function emojiUnicode(emoji) {
    var comp;
    if (emoji.length === 1) {
        comp = emoji.charCodeAt(0);
    }
    comp = (
        (emoji.charCodeAt(0) - 0xD800) * 0x400
        + (emoji.charCodeAt(1) - 0xDC00) + 0x10000
    );
    if (comp < 0) {
        comp = emoji.charCodeAt(0);
    }
    return comp.toString("16");
};

const emojiTargets = emojis.map(emojiUnicode);

function isEmojiMagicNumber(target) {
    for (const emojiTarget of emojiTargets) {
        if (target.indexOf(emojiTarget) === 0) {
            return emojiTarget;
        }
    }

    return null;
}

function isMagicNumber(target) {
    return isEmojiMagicNumber(target);
}

function is21e8MinerScript(script) {
    return !!(
        script.chunks.length === 12 &&
        script.chunks[0].buf &&
        script.chunks[0].buf.length >= 1 &&
        script.chunks[1].buf &&
        script.chunks[1].buf.length >= 1 &&
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

function debugScript(script) {
    try {
        console.log(script.chunks.length, 12, "CHUNKS", (script.chunks.length == 12));
        console.log(script.chunks[0].buf, 1, !!script.chunks[0].buf);
        console.log(script.chunks[0].buf.length, 1, "BUF0", (script.chunks[0].buf.length >= 1));
        console.log(script.chunks[1].buf, 1, !!script.chunks[1].buf);
        console.log(script.chunks[1].buf.length, 1, "BUF1", (script.chunks[1].buf.length >= 1));

        console.log(script.chunks[2].opcodenum, Opcode.OP_SIZE, (script.chunks[2].opcodenum == Opcode.OP_SIZE));
        console.log(script.chunks[3].opcodenum, Opcode.OP_4, (script.chunks[3].opcodenum == Opcode.OP_4));
        console.log(script.chunks[4].opcodenum, Opcode.OP_PICK, (script.chunks[4].opcodenum == Opcode.OP_PICK));
        console.log(script.chunks[5].opcodenum, Opcode.OP_SHA256, (script.chunks[5].opcodenum == Opcode.OP_SHA256));
        console.log(script.chunks[6].opcodenum, Opcode.OP_SWAP, (script.chunks[6].opcodenum == Opcode.OP_SWAP));
        console.log(script.chunks[7].opcodenum, Opcode.OP_SPLIT, (script.chunks[7].opcodenum == Opcode.OP_SPLIT));
        console.log(script.chunks[8].opcodenum, Opcode.OP_DROP, (script.chunks[8].opcodenum == Opcode.OP_DROP));
        console.log(script.chunks[9].opcodenum, Opcode.OP_EQUALVERIFY, (script.chunks[9].opcodenum == Opcode.OP_EQUALVERIFY));
        console.log(script.chunks[10].opcodenum, Opcode.OP_DROP, (script.chunks[10].opcodenum == Opcode.OP_DROP));
        console.log(script.chunks[11].opcodenum, Opcode.OP_CHECKSIG, (script.chunks[11].opcodenum == Opcode.OP_CHECKSIG));
    } catch (e) {
        console.log("err while debugging");
    }
}

function isCoinguruStyleScript(script) {
    return !!(
        script.chunks.length >= 13 &&
        script.chunks[0].buf &&
        script.chunks[0].buf.length >= 1 &&
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
        script.chunks[11].opcodenum === Opcode.OP_CODESEPARATOR &&
        script.chunks[12].opcodenum === Opcode.OP_CHECKSIG
    );
}

function isPuzzle(script) {
    return is21e8MinerScript(script) || isCoinguruStyleScript(script);
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

        // log(tx.tx.h);

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
                        mined_at: created_at,
                        mined_bsvusd: await helpers.bsvusd(),
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
            if (isPuzzle(script)) {
                const value = out.e.v;
                const txid = tx.tx.h;
                const parts = out.str.split(" "); // TODO: use script
                const target = parts[0]; // these are backwards
                const magicnumber = parts[1]; // backwards

                const emoji = isEmojiMagicNumber(magicnumber);

                try {
                    const obj = {
                        txid,
                        vout,
                        from: tx.in[0].e.a,
                        value,
                        confirmed,
                        magicnumber,
                        target,
                        mined: false,
                        created_at,
                    };

                    if (emoji) {
                        obj.emoji = String.fromCodePoint(parseInt(emoji, 16));
                    }

                    await this.db.collection("magicnumbers").insertOne(obj);

                    const utxo = `${txid}:${vout}`;
                    if (confirmed) {
                        log(`inserted confirmed magic number into the pool ${txid}`);
                    } else {
                        log(`inserted new magic number into the pool ${txid}`);
                    }

                    utxos.add(utxo);
                } catch (e) {
                    if (dupe(e, ["txid"])) {
                        log(`already added ${tx.tx.h}`);

                        if (confirmed) {
                            await this.db.collection("magicnumbers").updateOne({ txid }, {
                                "$set": {
                                    confirmed: true
                                }
                            });
                        }
                    } else {
                        throw e;
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
