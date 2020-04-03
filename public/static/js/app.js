// todo: all of this should be rewritten in react

const emojis = ["👍", "👎", "🙏", "💥", "❤️", "🔥", "🤪", "😠", "🤔", "😂", "💸", "💰", "☭"];
const emojiTargets = emojis.map(emojiUnicode);

function isEmoji(str) {
    const emoji_regex = /<% emojiSequence %>|\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}/gu;
    const unicode_regex = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])+$/;

    if (emoji_regex.test(str)) { return true }
    if (unicode_regex.test(str)) { return true }

    return false;
}

function hexEncode(str) {
    var arr1 = [];
    for (var n = 0, l = str.length; n < l; n ++) {
        var hex = Number(str.charCodeAt(n)).toString(16);
        arr1.push(hex);
    }
    return arr1.join('');
}

let content = "";
let hash = "";

function toggleExtendedDisplay() {
  document.getElementById("blockviz").classList.toggle("extended");
}

function toggleAddMagicNumber() {
  document.getElementById("add-magic-modal").classList.toggle("is-active");
}

function handleBlurSearch() {
    let str = document.getElementById("search").value.trim();
    var hexstr = new RegExp(/^[0-9A-Fa-f]+$/g);

    if (str) {
        if (isEmoji(str)) {
            str = emojiUnicode(str);
        }

        const ishex = hexstr.test(str);
        if (ishex) {
            str = evenHexStr(str);
        } else {
            str = sha256(str);
        }
        document.getElementById("search").value = str;
    }
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

function handleSearchKeyUp(e) {
    if (e.keyCode === 13) {
        handleBlurSearch();
        handleSubmitSearch();
    }
}

function emojiUnicode(emoji) {
    return emoji.codePointAt(0).toString(16);
}

function hexify(str) {
    var hexstr = /^[0-9A-Fa-f]+$/g;

    if (str) {
        if (!hexstr.test(str)) {
            if (isEmoji(str)) {
                str = emojiUnicode(str);
            } else {
                str = hexEncode(str);
            }
        }
    }

    str = evenHexStr(str);
    return str;
}

function evenHexStr(hexstr) {
    if ((hexstr.length % 2) === 1) {
        hexstr = hexstr + "0";
    }
    return hexstr;
}

function handleTargetBlur() {
    let target = hexify(document.getElementById("target").value.trim());
    document.getElementById("target").value = target;
    clearMoneyButton();
}

function clearMoneyButton() {
  const mb = document.getElementById("money-button-wrapper");
  mb.innerHTML = "<div class='money-button' id='money-button'></div>";
}

function handleSubmitSearch() {
    document.location = "/" + document.getElementById("search").value;
}

document.addEventListener('DOMContentLoaded', (event) => {
    const search = document.getElementById("search");
    if (search) {
        search.addEventListener("keyup", handleSearchKeyUp);
    }
});
