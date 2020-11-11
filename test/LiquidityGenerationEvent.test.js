const Hal9kToken = artifacts.require("HAL9K");
const Hal9kVault = artifacts.require("Hal9kVault");
const { expectRevert, time } = require("@openzeppelin/test-helpers");
const WETH9 = artifacts.require("WETH9");
const UniswapV2Pair = artifacts.require("UniswapV2Pair");
const UniswapV2Factory = artifacts.require("UniswapV2Factory");
const FeeApprover = artifacts.require("FeeApprover");
const UniswapV2Router02 = artifacts.require("UniswapV2Router02");

contract(
  "Liquidity Generation tests",
  ([
    alice,
    john,
    minter,
    dev,
    burner,
    clean,
    clean2,
    clean3,
    clean4,
    clean5,
  ]) => {
    beforeEach(async () => {
      this.factory = await UniswapV2Factory.new(alice, { from: alice });
      this.weth = await WETH9.new({ from: john });
      this.router = await UniswapV2Router02.new(
        this.factory.address,
        this.weth.address,
        { from: alice }
      );
      this.hal9k = await Hal9kToken.new(
        this.router.address,
        this.factory.address,
        { from: alice }
      );
      await this.hal9k.startLiquidityGenerationEventForHAL9K();
      this.feeapprover = await FeeApprover.new({ from: alice });
      await this.feeapprover.initialize(
        this.hal9k.address,
        this.weth.address,
        this.factory.address
      );
      await this.feeapprover.setPaused(false, { from: alice });

      await this.hal9k.setShouldTransferChecker(this.feeapprover.address, {
        from: alice,
      });
      this.hal9kvault = await Hal9kVault.new({ from: alice });
      await this.hal9kvault.initialize(this.hal9k.address, dev, clean5);
      await this.feeapprover.setHal9kVaultAddress(this.hal9kvault.address, {
        from: alice,
      });
    });

    it("Should have a correct balance starting", async () => {
      assert.equal(
        (await web3.eth.getBalance(this.hal9k.address)).valueOf().toString(),
        "0"
      );
      assert.equal(
        (await this.hal9k.balanceOf(this.hal9k.address)).valueOf().toString(),
        9000e18
      );
    });

    it("Should not let anyone contribute after timer ", async () => {
      await time.increase(60 * 60 * 24 * 7 + 1);
      await expectRevert(
        this.hal9k.addLiquidity({ from: clean }),
        "Liquidity Generation Event over"
      );
    });
    it("Should not let anyone contribute without agreement timer", async () => {
      assert.equal(
        (await web3.eth.getBalance(this.hal9k.address)).valueOf().toString(),
        "0"
      );
      assert.equal(
        (await this.hal9k.balanceOf(this.hal9k.address)).valueOf().toString(),
        9000e18
      );
      await expectRevert(
        this.hal9k.addLiquidity(null, { from: clean }),
        "No agreement provided"
      );
    });
    it("Should handle deposits of nothing", async () => {
      assert.equal(
        (await web3.eth.getBalance(this.hal9k.address)).valueOf().toString(),
        "0"
      );
      assert.equal(
        (await this.hal9k.balanceOf(this.hal9k.address)).valueOf().toString(),
        9000e18
      );
      await this.hal9k.addLiquidity(true, { from: clean });
      assert.equal(
        (await web3.eth.getBalance(this.hal9k.address)).valueOf().toString(),
        "0"
      );
      assert.equal(
        (await this.hal9k.balanceOf(this.hal9k.address)).valueOf().toString(),
        9000e18
      );
      assert.equal(
        (await this.hal9k.ethContributed(clean)).valueOf().toString(),
        "0"
      );
    });

    it("Should update peoples balances", async () => {
      assert.equal(
        (await web3.eth.getBalance(this.hal9k.address)).valueOf().toString(),
        "0"
      );
      assert.equal(
        (await this.hal9k.balanceOf(this.hal9k.address)).valueOf().toString(),
        9000e18
      );
      await this.hal9k.addLiquidity(true, { from: clean, value: 99 });
      assert.equal(
        (await web3.eth.getBalance(this.hal9k.address)).valueOf().toString(),
        "99"
      );
      assert.equal(
        (await this.hal9k.balanceOf(this.hal9k.address)).valueOf().toString(),
        9000e18
      );
      assert.equal(
        (await this.hal9k.ethContributed(clean)).valueOf().toString(),
        "99"
      );
      await this.hal9k.addLiquidity(true, { from: clean, value: 101 });
      assert.equal(
        (await web3.eth.getBalance(this.hal9k.address)).valueOf().toString(),
        "200"
      );
      assert.equal(
        (await this.hal9k.ethContributed(clean)).valueOf().toString(),
        "200"
      );
      await this.hal9k.addLiquidity(true, { from: clean2, value: 100 });
      assert.equal(
        (await web3.eth.getBalance(this.hal9k.address)).valueOf().toString(),
        "300"
      );
      assert.equal(
        (await this.hal9k.ethContributed(clean)).valueOf().toString(),
        "200"
      );
      assert.equal(
        (await this.hal9k.ethContributed(clean2)).valueOf().toString(),
        "100"
      );
    });

    it("Should create the pair liquidity generation", async () => {
      assert.equal(
        (await web3.eth.getBalance(this.hal9k.address)).valueOf().toString(),
        "0"
      );
      assert.equal(
        (await this.hal9k.balanceOf(this.hal9k.address)).valueOf().toString(),
        9000e18
      );
      await this.hal9k.addLiquidity(true, { from: clean, value: 100 });
      assert.equal(
        (await this.hal9k.ethContributed(clean)).valueOf().toString(),
        "100"
      );
      assert.equal(
        (await web3.eth.getBalance(this.hal9k.address)).valueOf().toString(),
        "100"
      );
      await time.increase(60 * 60 * 24 * 7 + 1);
      this.hal9kWETHPair = await UniswapV2Pair.at(
        await this.factory.getPair(this.weth.address, this.hal9k.address)
      );
      await this.hal9k.addLiquidityToUniswapHAL9KxWETHPair();
    });

    it("Should create the pair liquidity with lots of eth", async () => {
      assert.equal(
        (await web3.eth.getBalance(this.hal9k.address)).valueOf().toString(),
        "0"
      );
      assert.equal(
        (await this.hal9k.balanceOf(this.hal9k.address)).valueOf().toString(),
        9000e18
      );
      await this.hal9k.addLiquidity(true, {
        from: clean,
        value: "9899998457311999999700",
      });
      assert.equal(
        (await this.hal9k.ethContributed(clean)).valueOf().toString(),
        "9899998457311999999700"
      );
      assert.equal(
        (await web3.eth.getBalance(this.hal9k.address)).valueOf().toString(),
        "9899998457311999999700"
      );
      console.log("this.weth.address =========>", this.weth.address);
      console.log("this.hal9k.address =========>", this.hal9k.address);
      await time.increase(60 * 60 * 24 * 7 + 1);
      this.hal9kWETHPair = await UniswapV2Pair.at(
        await this.factory.getPair(this.weth.address, this.hal9k.address)
      );
      await this.hal9k.addLiquidityToUniswapHAL9KxWETHPair();
      assert.notEqual(
        (await this.hal9kWETHPair.balanceOf(this.hal9k.address))
          .valueOf()
          .toString(),
        "0"
      );
      assert.equal(
        (await this.hal9kWETHPair.balanceOf(this.hal9k.address))
          .valueOf()
          .toString(),
        (await this.hal9k.totalLPTokensMinted()).valueOf().toString()
      );
    });

    it("Should give out LP tokens up to 1 LP value precision", async () => {
      assert.equal(
        (await web3.eth.getBalance(this.hal9k.address)).valueOf().toString(),
        "0"
      );
      assert.equal(
        (await this.hal9k.balanceOf(this.hal9k.address)).valueOf().toString(),
        9000e18
      );
      await this.hal9k.addLiquidity(true, {
        from: clean2,
        value: "9899998457311999999700",
      });
      assert.equal(
        (await this.hal9k.ethContributed(clean2)).valueOf().toString(),
        "9899998457311999999700"
      );
      assert.equal(
        (await web3.eth.getBalance(this.hal9k.address)).valueOf().toString(),
        "9899998457311999999700"
      );
      await time.increase(60 * 60 * 24 * 7 + 1);
      this.hal9kWETHPair = await UniswapV2Pair.at(
        await this.factory.getPair(this.weth.address, this.hal9k.address)
      );
      await this.hal9k.addLiquidityToUniswapHAL9KxWETHPair();
      const LPCreated =
        (await this.hal9k.totalLPTokensMinted()).valueOf() / 1e18; // To a certain significant
      await this.hal9k.claimLPTokens({ from: clean2 });
      assert.equal(
        (await this.hal9kWETHPair.balanceOf(clean2)).valueOf() / 1e18,
        LPCreated
      );
      assert.equal(
        (await this.hal9kWETHPair.balanceOf(this.hal9k.address)).valueOf() /
          1e18 <
          1,
        true
      ); // smaller than 1 LP token
    });

    it("Should let people withdraw LP proportionally", async () => {
      assert.equal(
        (await web3.eth.getBalance(this.hal9k.address)).valueOf().toString(),
        "0"
      );
      assert.equal(
        (await this.hal9k.balanceOf(this.hal9k.address)).valueOf().toString(),
        9000e18
      );
      await this.hal9k.addLiquidity(true, {
        from: clean3,
        value: "5000000000",
      });
      await this.hal9k.addLiquidity(true, {
        from: clean4,
        value: "5000000000",
      });
      assert.equal(
        (await this.hal9k.ethContributed(clean3)).valueOf().toString(),
        "5000000000"
      );
      assert.equal(
        (await this.hal9k.ethContributed(clean3)).valueOf().toString(),
        "5000000000"
      );
      assert.equal(
        (await web3.eth.getBalance(this.hal9k.address)).valueOf().toString(),
        "10000000000"
      );
      await time.increase(60 * 60 * 24 * 7 + 1);
      this.hal9kWETHPair = await UniswapV2Pair.at(
        await this.factory.getPair(this.weth.address, this.hal9k.address)
      );
      await this.hal9k.addLiquidityToUniswapHAL9KxWETHPair();
      const LPCreated =
        (await this.hal9k.totalLPTokensMinted()).valueOf() / 1e18; // To a certain significant
      await this.hal9k.claimLPTokens({ from: clean3 });
      await expectRevert(
        this.hal9k.claimLPTokens({ from: clean3 }),
        "Nothing to claim, move along"
      );
      await this.hal9k.claimLPTokens({ from: clean4 });
      await expectRevert(
        this.hal9k.claimLPTokens({ from: clean4 }),
        "Nothing to claim, move along"
      );
      await expectRevert(
        this.hal9k.claimLPTokens({ from: clean3 }),
        "Nothing to claim, move along"
      );
      assert.equal(
        (await this.hal9kWETHPair.balanceOf(clean3)).valueOf() / 1e18,
        LPCreated / 2
      );
      assert.equal(
        (await this.hal9kWETHPair.balanceOf(clean4)).valueOf() / 1e18,
        LPCreated / 2
      );
      assert.equal(
        (await this.hal9kWETHPair.balanceOf(this.hal9k.address)).valueOf() /
          1e18 <
          1,
        true
      ); // smaller than 1 LP token
    });

    it("Should handle emergency withdrawal correctly", async () => {
      assert.equal(
        (await web3.eth.getBalance(this.hal9k.address)).valueOf().toString(),
        "0"
      );
      assert.equal(
        (await this.hal9k.balanceOf(this.hal9k.address)).valueOf().toString(),
        9000e18
      );
      await this.hal9k.addLiquidity(true, {
        from: clean3,
        value: "500000000000000000",
      });
      await this.hal9k.addLiquidity(true, {
        from: clean4,
        value: "500000000000000000",
      });
      await time.increase(60 * 60 * 24 * 7 + 1); // 7 days
      await expectRevert(
        this.hal9k.emergencyDrain24hAfterLiquidityGenerationEventIsDone({
          from: alice,
        }),
        "Liquidity generation grace period still ongoing"
      );
      await time.increase(60 * 60 * 24 * 1); // 8 days
      assert.equal(
        (await web3.eth.getBalance(this.hal9k.address)).valueOf().toString(),
        "1000000000000000000"
      );
      assert.equal(
        (await this.hal9k.balanceOf(this.hal9k.address)).valueOf().toString(),
        9000e18
      );

      const aliceETHPerviously =
        (await web3.eth.getBalance(alice)).valueOf() / 1e18; /// more or less cause gas costs
      await this.hal9k.emergencyDrain24hAfterLiquidityGenerationEventIsDone({
        from: alice,
      });

      assert.equal(
        (await web3.eth.getBalance(this.hal9k.address)).valueOf().toString(),
        "0"
      );
      assert.equal(
        parseInt((await web3.eth.getBalance(alice)).valueOf() / 1e18),
        parseInt(aliceETHPerviously + 1000000000000000000 / 1e18).toString()
      );

      assert.equal(
        (await this.hal9k.balanceOf(alice)).valueOf().toString(),
        9000e18
      );
    });

    it("Super admin works as expected", async () => {
      await expectRevert(
        this.hal9kvault.setStrategyContractOrDistributionContractAllowance(
          this.hal9k.address,
          "1",
          this.hal9k.address,
          { from: alice }
        ),
        "Super admin : caller is not super admin."
      );
      await expectRevert(
        this.hal9kvault.setStrategyContractOrDistributionContractAllowance(
          this.hal9k.address,
          "1",
          this.hal9k.address,
          { from: clean5 }
        ),
        "Governance setup grace period not over"
      );
    });
  }
);
