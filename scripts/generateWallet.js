// scripts/generateWallet.js
const { ethers } = require("ethers");

const wallet = ethers.Wallet.createRandom();

console.log("========================================");
console.log("New Address:    ", wallet.address);
console.log("New PrivateKey: ", wallet.privateKey);
console.log("========================================");
console.log("⚠️ コピーしたら、このターミナル出力を clear コマンドで消すこと！");
