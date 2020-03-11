import { connect } from "../src/db"
import * as helpers from "../src/helpers"
import { isBadEmoji } from "../src/data"

(async function() {
    const db = await connect();

    const backupBsvPrice = await helpers.bsvusd();
    const results = await db.collection("magicnumbers").find({"power": null, mined: true}).toArray();

    console.log("BEGIN");
    for (const result of results) {
        let power = helpers.countpower(result.magicnumber, result.target);

        if (result.emoji && isBadEmoji(result.emoji)) {
            power = power * -1;
        }

        console.log("RESULT", power, result.txid);
        await db.collection("magicnumbers").updateOne({"txid": result.txid}, {"$set": { power }});
    }
    console.log("END");

    db.close();
})();
