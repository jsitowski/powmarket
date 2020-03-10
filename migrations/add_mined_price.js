import { connect } from "../src/db"
import * as helpers from "../src/helpers"

(async function() {
    const db = await connect();

    const backupBsvPrice = await helpers.bsvusd();
    const results = await db.collection("magicnumbers").find({"mined_price": null}).toArray();

    console.log("BEGIN");
    for (const result of results) {
        const bsvprice = result.mined_bsvusd || backupBsvPrice;
        const satoshis = result.value
        const mined_price = Number(helpers.satoshisToDollars(satoshis, bsvprice));

        console.log("RESULT", result.txid);
        if (mined_price === null) {
            console.log("RESULT", bsvprice, satoshis, JSON.stringify(result, null, 4));
            throw new Error("unexpected usd price");
        } else {
            console.log("MIGRATING", "bsvprice", bsvprice, "satoshis", satoshis, "to", mined_price);
            await db.collection("magicnumbers").updateOne({"txid": result.txid}, {"$set": { mined_price }});
        }
    }
    console.log("END");

    db.close();
})();
