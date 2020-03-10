// todo: all of this should be rewritten in react

let content = "";
let hash = "";

function toggleExtendedDisplay() {
  document.getElementById("blockviz").classList.toggle("extended");
}

function toggleAddMagicNumber() {
  document.getElementById("add-magic-modal").classList.toggle("is-active");
}

function handleFormSubmit() {
  //console.log("CONTENT", content);
  let target = document.getElementById("target").value;
  if (target < 75) {
    const len = String(target).length;
    if (len == 1) {
      target = `000${target}`;
    } else {
      target = `00${target}`;
    }

    document.getElementById("target").value = target;
  }

  let amount = document.getElementById("price").value;

  if (!hash || !target || !amount) {
    alert("Error while submitting form...please check data");
    return;
  }

  const mb = document.getElementById("money-button");
  moneyButton.render(mb, {
    outputs: [{
      "script": `${hash} ${target} OP_SIZE OP_4 OP_PICK OP_SHA256 OP_SWAP OP_SPLIT OP_DROP OP_EQUALVERIFY OP_DROP OP_CHECKSIG`,
      "amount": amount,
      "currency": "USD",
    }],

    "onPayment": function(response) {
      console.log(response.txid);
      console.log("Successfully paid");

      document.getElementById("content").value = "";
      document.getElementById("content").hash = "";

      clearMoneyButton();

      setTimeout(function() {
        document.location.reload();
      }, 1000);



    },
    "onError": function(e) {
      console.log("ERROR", e);
      alert("Error while sending proof-of-work request, please try again");
    },
  });

  mb.classList.add("is-active");

  return false;
}

function handleKeyUp() {
  content = document.getElementById("content").value;
  if (content) {
    hash = sha256(content);
  } else {
    hash = "";
  }

  document.getElementById("hash").value = hash;

  clearMoneyButton();
}

function handleHashKeyUp() {
  const oldHash = hash;
  hash = document.getElementById("hash").value;
  if (oldHash !== hash) {
    document.getElementById("content").value = "";
  }
}

function handleMoneyKeyUp() {
  clearMoneyButton();
}

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

const emojis = ["👍", "👎", "🙏", "💥", "❤️", "🔥", "🤪", "😠", "🤔", "😂", ];
const emojiTargets = emojis.map(emojiUnicode);

function handleTargetKeyUp() {

  let target = document.getElementById("target").value;
  if (emojis.indexOf(target) !== -1) {
    target = emojiUnicode(target);
    if ((target.length % 2) === 1) {
      target = target + "0";
    }
    document.getElementById("target").value = target;
  }

  clearMoneyButton();
}

function clearMoneyButton() {
  const mb = document.getElementById("money-button-wrapper");
  mb.innerHTML = "<div class='money-button' id='money-button'></div>";
}

