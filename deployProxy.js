const { ethers, Wallet, ContractFactory, Contract } = require("ethers");
const fs = require("fs");
require("dotenv").config();

//----------artifact path-------------
const proxyAdminArtifact = "./prodartifacts/ProxyAdmin.json";
const hal9kVaultArtifact = "./prodartifacts/Hal9kVault.json";
const hal9kArtifact = "./prodartifacts/HAL9K.json";
const adminUpgradeabilityProxyArtifact = "./prodartifacts/AdminUpgradeabilityProxy.json";
const feeApproverArtifact = "./prodartifacts/FeeApprover.json";

const unpackArtifact = (artifactPath) => {
  let contractData = JSON.parse(fs.readFileSync(artifactPath));
  const contractBytecode = contractData["bytecode"];
  const contractABI = contractData["abi"];
  const constructorArgs = contractABI.filter((itm) => {
    return itm.type == "constructor";
  });
  let constructorStr;
  if (constructorArgs.length < 1) {
    constructorStr = "    -- No constructor arguments -- ";
  } else {
    constructorJSON = constructorArgs[0].inputs;
    constructorStr = JSON.stringify(
      constructorJSON.map((c) => {
        return {
          name: c.name,
          type: c.type,
        };
      })
    );
  }
  return {
    abi: contractABI,
    bytecode: contractBytecode,
    contractName: contractData.contractName,
    constructor: constructorStr,
  };
};

let provider;
let wethAddress;
if (process.env.NETWORK == "mainnet") {
  provider = ethers.getDefaultProvider("homestead");
  wethAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
} else {
  provider = ethers.getDefaultProvider("kovan");
  wethAddress = "0xd0a1e359811322d97991e03f863a0c30c2cf029c";
}
let wallet, connectedWallet;
wallet = Wallet.fromMnemonic(process.env.MNEMONIC);
connectedWallet = wallet.connect(provider);

const deployContract = async (
  contractABI,
  contractBytecode,
  args = []
) => {
  try {
    const factory = new ContractFactory(
      contractABI,
      contractBytecode,
      connectedWallet
    );
    return await factory.deploy(...args);
    
  } catch (error) {
    console.log("deployContract====>", error);
  }
};

const deploy = async (artifactPath, args) => {
  try {
    let tokenUnpacked = unpackArtifact(artifactPath);
    console.log(`${tokenUnpacked.contractName} \n Constructor: ${tokenUnpacked.constructor}`);
  
    const token = await deployContract(
      tokenUnpacked.abi,
      tokenUnpacked.bytecode,
      args
    );
    console.log(`⌛ Deploying ${tokenUnpacked.contractName}...`);
    await connectedWallet.provider.waitForTransaction(
      token.deployTransaction.hash
    );
    console.log(`✅ Deployed ${tokenUnpacked.contractName} to ${token.address}`);
  } catch(err) {
    console.log("deploy ======>", err);
  }
};

const initHal9kVault = async () => {
  try {
    let tokenUnpacked = unpackArtifact(hal9kVaultArtifact);
    let hal9kVault = new Contract(deployedHal9kVaultProxy, tokenUnpacked.abi, connectedWallet);
    let initTxn = await hal9kVault.initialize(hal9kTokenAddress, devAddr, devAddr);
    console.log(`⌛ Initialize Hal9kVault...`);
    await connectedWallet.provider.waitForTransaction(initTxn.hash);
    console.log(`✅ Initialized Hal9kVault on token at ${hal9kVault.address}`)
    
  } catch (error) {
    console.log("initHal9kVault ====>", error);
  }
};

const initFeeApprover = async() => {
  try {
    let tokenUnpacked = unpackArtifact(feeApproverArtifact);
    let feeApprover = new Contract(deployedFeeApproverProxy, tokenUnpacked.abi, connectedWallet);
    let initTxn = await feeApprover.initialize(hal9kTokenAddress, wethAddress, process.env.UNISWAPFACTORY);
    console.log(`⌛ Initialize FeeApprover...`);
    await connectedWallet.provider.waitForTransaction(initTxn.hash);
    console.log(`✅ Initialized FeeApprover on token at ${feeApprover.address}`);
    
    let hal9kTokenUnpacked = unpackArtifact(hal9kArtifact);
    let token = new Contract(hal9kTokenAddress, hal9kTokenUnpacked.abi, connectedWallet);
    let setTransferCheckerResult = await token.setShouldTransferChecker(feeApprover.address);
    console.log(`⌛ setShouldTransferChecker...`)
    await connectedWallet.provider.waitForTransaction(setTransferCheckerResult.hash)
    console.log(`✅ Called setShouldTransferChecker(${feeApprover.address} on token at ${token.address}`);
    
    let setFeeDistributorResult = await token.setFeeDistributor(wallet.address);
    console.log(`⌛ setFeeDistributor...`)
    await connectedWallet.provider.waitForTransaction(setFeeDistributorResult.hash)
    console.log(`✅ Called setFeeDistributor(${wallet.address} on token at ${token.address})`)
  
    console.log("All done!")

  } catch(err) {
    console.log("initFeeApprover ===>", err);
  }
};
const devAddr = "0x5518876726C060b2D3fCda75c0B9f31F13b78D07";
const hal9kTokenAddress = "0x3536E583f7fA9395219A81580588b57dD6D0B13b";
const deployedProxyAdminAddress = "0x21BC39dD06AE5A7f93Dc43CDB69E71881BFbFb0B";

const deployedHal9kVaultAddress = "0x2CFda202f6043400284C2E07d400C48d94f82774";
const deployedHal9kVaultProxy = "0xA182e0275d4a1c9A5a593D0A95BB96E22118102e";

const hal9kVaultInited = true;

const deployedFeeApproverAddress = "0xD1addDf943BdA90Af421044A3F3D0576D0E6b09c";
const deployedFeeApproverProxy = "0x11E76bA18CAea05c7e7E8C764FA4629CB174b0Fb";

const feeApproverInited = false;

// Step 1.
// Deploy proxy admin contract and get the address..
if (!deployedProxyAdminAddress) {
  deploy(proxyAdminArtifact);
  return;
}

// Step 2.
// Deploy the Hal9kVault logic
if (!deployedHal9kVaultAddress) {
  deploy(hal9kVaultArtifact);
  return;
}

// Step 3.
// Deploy the proxy for Hal9kVault logic
if (!deployedHal9kVaultProxy) {
  deploy(
    adminUpgradeabilityProxyArtifact,
    [
      deployedHal9kVaultAddress /*logic*/,
      deployedProxyAdminAddress /*admin*/,
      [],
    ]
  );
  return;
}
// Step 4.
// Call initializer on the proxied Hal9kVault
if (!hal9kVaultInited) {
  initHal9kVault();
  return;
}
// Step 5.

// Deploy FeeApprover
if (!deployedFeeApproverAddress) {
  deploy(feeApproverArtifact);
  return;
}

// Step 6.

//Deploy FeeApproverProxy
if (!deployedFeeApproverProxy) {
  deploy(
    adminUpgradeabilityProxyArtifact,
    [
      deployedFeeApproverAddress /*logic*/,
      deployedProxyAdminAddress /*admin*/,
      []
    ]
  );
  return;
}

//Step 7.

//Initalize the feeApprover

if (!feeApproverInited) {
  initFeeApprover();
  return;
}