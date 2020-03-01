const chalk = require('chalk');
const bsv = require("bsv");
const PrivateKey = bsv.PrivateKey;
const Opcode = bsv.Opcode;
const Transaction = bsv.Transaction;
const BN = bsv.crypto.BN;

const sigtype = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID;
const flags = bsv.Script.Interpreter.SCRIPT_VERIFY_MINIMALDATA | bsv.Script.Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID | bsv.Script.Interpreter.SCRIPT_ENABLE_MAGNETIC_OPCODES | bsv.Script.Interpreter.SCRIPT_ENABLE_MONOLITH_OPCODES;

const privKey = PrivateKey("L3PLGxANGuLAR85QyYaHdhFJFaBBuAuLwNKJKbCFnhpEansv5czm");
const pubKey = bsv.PublicKey.fromPrivateKey(privKey);
const addr = bsv.Address.fromPrivateKey(privKey);
console.log("privKey", privKey);
console.log("pubKey", pubKey);
console.log("addr", addr);


const targetScript = bsv.Script.fromHex("2000000000000000000021e800c1e8df51b22c1588e5a624bea17e9faa34b2dc4a0221e8825479a87c7f758875ac");

console.log(targetScript);

const txid = "fe46e6856791fde51918abc9b8cd4c1ad30dee02c2805caf0bf31981b058e6fd";
const vout = 0;
const target = targetScript.toASM().split(" ")[1].toString('hex');
const value = 1001340;

console.log(target);

function sign(tx, target='') {
    const privKey = PrivateKey("a8a2622ce718a1bb8d517be1988c82762d80e713a6171fa5e15a67fa950b8467");
    //if(!is21e8Out(tx.inputs[0].output.script)){
    //throw("Not a valid 21e8 script");
    //}
    const signature = Transaction.sighash.sign(tx, privKey, sigtype, 0, tx.inputs[0].output.script, new BN(tx.inputs[0].output.satoshis), flags);
    //console.log("target", target);
    console.log("signature", signature);
    let presig;

    if(target!=''){
        console.log("SIGTYPE", sigtype.toString(16));
        console.log("SIGNATURE A", signature.toString("hex"));

        presig = Buffer.concat([signature.toBuffer(), Buffer.from(sigtype.toString(16), 'hex')]);
        console.log("PRESIG", presig);

        const sig256 = bsv.crypto.Hash.sha256(presig).toString('hex');
        console.log("SIG256", sig256);
        if(!sig256.startsWith(target)){
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(chalk.red(sig256));
            //return(false);
        } else {
            console.log();
            console.log(chalk.green(sig256));
            console.log(privKey);
        }
    }

    const unlockingScript = new bsv.Script({});
    unlockingScript
        .add(presig)
        .add(privKey.toPublicKey().toBuffer());
    console.log("unlocking", unlockingScript);
    console.log("unlocking", unlockingScript.toString("hex"));

    tx.inputs[0].setScript(unlockingScript);
    console.log(chalk.green(`Signed ${target} with ${privKey.toString()}`));
    console.log("TX", tx.uncheckedSerialize());
    throw new Error("BOOM TOWN");
}


let tx = new Transaction();
tx.addInput(
    new Transaction.Input({
        output: new Transaction.Output({
            script: targetScript,
            satoshis: value
        }),
        prevTxId: txid,
        outputIndex: vout,
        script: bsv.Script.empty()
    })
);

tx.addOutput(
    new Transaction.Output({
        satoshis: value-218,
        script: bsv.Script.buildPublicKeyHashOut("1HHYzyYzcw7v1XhmS8VKFN5Du7n5WNH1Aw")
    })
);

console.log("TX", tx);


let newTX;
while (!newTX){
    newTX = sign(tx, target);
}

/*
const signature = Transaction.sighash.sign(tx, privKey, sigtype, 0, tx.inputs[0].output.script, new BN(tx.inputs[0].output.satoshis), flags);

console.log("signature", signature);
*/
