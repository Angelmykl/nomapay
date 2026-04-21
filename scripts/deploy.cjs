const { ethers } = require("hardhat");

async function main() {
  const NomaPay = await ethers.getContractFactory("NomaPay");
  const contract = await NomaPay.deploy(
    "0x3600000000000000000000000000000000000000",
    "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    500000,
    50,
    20
  );
  await contract.waitForDeployment();
  console.log("NomaPay deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});