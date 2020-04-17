import { connect } from "../src/db"
import * as helpers from "../src/helpers"

(async function() {
    const db = await connect();

    const backupBsvPrice = await helpers.bsvusd();
    const results = await db.collection("magicnumbers").find({"mined_price": {"$ne": null}}).toArray();

    let i = 0;
    console.log("BEGIN");
    for (const result of results) {
        if (typeof result.mined_price === "string") {
            i += 1;
            const mined_price = Number(result.mined_price);

            console.log("RESULT", mined_price, result.txid);
            await db.collection("magicnumbers").updateOne({"txid": result.txid}, {"$set": { mined_price }});
        }
    }
    console.log("NUM", i);
    console.log("END");

    db.close();
})();
