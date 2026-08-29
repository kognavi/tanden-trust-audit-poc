require("@nomicfoundation/hardhat-ethers");
require("dotenv").config({ quiet: true });

const { SEPOLIA_RPC_URL, ANCHOR_PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

module.exports = {
  solidity: "0.8.19",
  networks: {
    sepolia: {
      url: SEPOLIA_RPC_URL || "",
      accounts: ANCHOR_PRIVATE_KEY ? [ANCHOR_PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
};
