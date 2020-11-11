const chai = require("chai");
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;
const assert = chai.assert;

const { artifacts } = require("hardhat");
const HAL9KLtd = artifacts.require('HAL9KLtd');
const Hal9kVault = artifacts.require("Hal9kVault");
const HAL9KNFTPool = artifacts.require("HAL9KNFTPool");

describe("HAL9K NFT Pool", () => {
  let alice, john;

  before(async () => {
      [alice, john] = await web3.eth.getAccounts();
      // Alice:  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
      // John:  0x70997970C51812dc3A010C7d01b50e0d17dc79C8
      // Owner:  0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
  })

  beforeEach(async () => {
    this.hal9kVault = await Hal9kVault.new(alice, { from: alice });
    this.hal9kLtd = await HAL9KLtd.new(alice, { from: alice });
    this.hal9kPool = await HAL9KNFTPool.new(alice, john);
  });
  
  it("Should create and mint the nft card correctly", async () => {
    const firstCardId = await this.hal9kLtd.create.call(100, 0, "https://images.hal9k.ai/1", []);
    expect(firstCardId.toNumber()).to.equal(1);
  });

  it("Should start hal9k nft card reward", async () => {
    await expect(this.hal9kPool.getDaysPassedAfterStakingStart()).to.eventually.be.rejectedWith("LP token hasn't claimed yet");

    await this.hal9kPool.startHal9KStaking();
    let passedDays = await this.hal9kPool.getDaysPassedAfterStakingStart()
    assert.equal(passedDays, 0);
  })

  it("Should able to move and back one stage", async () => {
    await expect(this.hal9kPool.moveStageBackOrForth(false)).to.eventually.be.rejectedWith("LP token hasn't claimed yet");
    await expect(this.hal9kPool.getCurrentStage()).to.eventually.be.rejectedWith("LP token hasn't claimed yet");
  })

  describe("MoveStageBackOrForth", () => {
    beforeEach(async () => {
      await this.hal9kPool.startHal9KStaking();
    })

    it("Stage should be 0 when stake started", async () => {
      let currentStage = await this.hal9kPool.getCurrentStage();
      assert.equal(currentStage, 0);
    })

    it("Stage should be 1 after moving forward", async () => {
      this.hal9kPool.moveStageBackOrForth(false);
      let currentStage = await this.hal9kPool.getCurrentStage();
      assert.equal(currentStage, 0);
    })

    it("Stage should be 0 after moving backward", async () => {
      this.hal9kPool.moveStageBackOrForth(true);
      let currentStage = await this.hal9kPool.getCurrentStage();
      assert.equal(currentStage, 0);
    })
  });

});
