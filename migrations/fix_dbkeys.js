import { connect } from "../src/db"
import * as helpers from "../src/helpers"

(async function() {
    const db = await connect();

    const backupBsvPrice = await helpers.bsvusd();
    const results = await db.collection("magicnumbers").find().toArray();

    console.log("BEGIN");
    for (const result of results) {
        let hash = result.target;
        let target = result.magicnumber;
        let magicnumber = result.mined_number;

        console.log("FLIPPED", result.txid);
        await db.collection("magicnumbers").updateOne({"txid": result.txid}, {"$set": {
            hash,
            target,
            magicnumber,
        }, "$unset": {
            "mined_number": true,
            "usdprice": true,
            "mined_bsvusd": true,
        }});
    }
    console.log("END");

    db.close();
})();
