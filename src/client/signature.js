/*
** BidTorrent auction component.
** copyright the BidTorrent team 2015
*/

var crypto = require('./jsrsasign').crypto;
var KEYUTIL = require('./jsrsasign').KEYUTIL;

if (!window.atob) {
    var tableStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var table = tableStr.split("");

    window.atob = function (base64) {
        if (/(=[^=]+|={3,})$/.test(base64)) throw new Error("String contains an invalid character");
        base64 = base64.replace(/=/g, "");
        var n = base64.length & 3;
        if (n === 1) throw new Error("String contains an invalid character");
        for (var i = 0, j = 0, len = base64.length / 4, bin = []; i < len; ++i) {
            var a = tableStr.indexOf(base64[j++] || "A"), b = tableStr.indexOf(base64[j++] || "A");
            var c = tableStr.indexOf(base64[j++] || "A"), d = tableStr.indexOf(base64[j++] || "A");
            if ((a | b | c | d) < 0) throw new Error("String contains an invalid character");
            bin[bin.length] = ((a << 2) | (b >> 4)) & 255;
            bin[bin.length] = ((b << 4) | (c >> 2)) & 255;
            bin[bin.length] = ((c << 6) | d) & 255;
        };
        return String.fromCharCode.apply(null, bin).substr(0, bin.length + n - 4);
    };
}

function base64ToHex(str) {
    for (var i = 0, bin = atob(str.replace(/[ \r\n]+$/, "")), hex = []; i < bin.length; ++i) {
        var tmp = bin.charCodeAt(i).toString(16);
        if (tmp.length === 1) tmp = "0" + tmp;
        hex[hex.length] = tmp;
    }
    return hex.join("");
}

var Signature = {
    check: function (price, auctionId, impId, publisherId, bidfloor, key, signature) {
        data = price.toFixed(6) + '|' + auctionId + '|' + impId + '|' + publisherId + '|' + bidfloor.toFixed(6);
        keyTyped = KEYUTIL.getKey(key);
        var sig = new crypto.Signature({"alg": "SHA1withRSA", "prov": "cryptojs/jsrsa"});
        sig.initVerifyByPublicKey(keyTyped);
        sig.updateString(data);
        return sig.verify(base64ToHex(signature));
    }
};

// Module exports
exports.Signature = Signature;
