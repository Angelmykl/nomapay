import { ethers } from "ethers";
import { readFileSync } from "fs";
import solc from "solc";

const PRIVATE_KEY = "0xa82cb52bfd3179aa73b4a576eed076be621cbbdf6b840b82dbaa3b786ca04e4c";
const RPC_URL = "https://rpc.testnet.arc.network";

const source = readFileSync("contracts/NomaPay.sol", "utf8");

const input = {
  language: "Solidity",
  sources: { "NomaPay.sol": { content: source } },
  settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } } },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const contract = output.contracts["NomaPay.sol"]["NomaPay"];
const abi = contract.abi;
const bytecode = contract.evm.bytecode.object;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const factory = new ethers.ContractFactory(abi, bytecode, wallet);

console.log("Deploying NomaPay...");
const deployed = await factory.deploy(
  "0x3600000000000000000000000000000000000000",
  "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  500000n, 50n, 20n
);
await deployed.waitForDeployment();
console.log("✅ NomaPay deployed to:", await deployed.getAddress());